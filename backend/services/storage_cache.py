"""
backend/services/storage_cache.py
---------------------------------
Thread-safe, lazy, file-level caching and synchronization manager for Supabase Storage.

Key Design Principles:
  1. On-Demand Fetching:
     Never downloads the full 894 MB dataset on cold start. Only downloads the
     exact individual file requested by a query when it is first needed.
  2. Concurrency Safety:
     Uses per-file threading locks to ensure concurrent incoming requests for the same
     file wait for a single download rather than initiating duplicate transfers.
  3. Integrity Verification:
     Streams files into atomic temporary files (.tmp.<pid>), computes SHA-256 hashes
     during transfer, and verifies against the deployment manifest before atomic rename.
  4. Hybrid Credential Support:
     Works seamlessly with public buckets (zero credentials required) and private
     buckets (using server-side SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY).
  5. Local-First Bypass:
     If the requested file already exists locally with matching size, returns in 0ms
     without touching the network.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional

import httpx

log = logging.getLogger("sagarnetra.storage_cache")

# Manifest fallback locations
BACKEND_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATHS = [
    BACKEND_DIR / "deployment_manifest.json",
    BACKEND_DIR.parent / "sagar-netra-deployment-data" / "manifest.json",
]


class StorageCache:
    """Manages lazy downloading and caching of scientific files from Supabase Storage."""

    _instance: Optional[StorageCache] = None
    _singleton_lock = threading.Lock()

    @classmethod
    def get_instance(cls, data_dir: Optional[Path] = None) -> StorageCache:
        """Get or initialize singleton instance."""
        with cls._singleton_lock:
            if cls._instance is None:
                from backend.config import settings
                base_dir = data_dir or (Path(settings.DATA_DIR) if settings.DATA_DIR else Path("/tmp/sagar-netra-cache"))
                if not base_dir.is_absolute():
                    base_dir = BACKEND_DIR.parent / base_dir
                cls._instance = StorageCache(
                    data_dir=base_dir,
                    supabase_url=settings.SUPABASE_URL,
                    bucket=settings.SUPABASE_BUCKET,
                    api_key=settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY,
                )
            return cls._instance

    def __init__(
        self,
        data_dir: Path,
        supabase_url: str = "https://wqdzzyeisvycfnhkzomu.supabase.co",
        bucket: str = "sagar-netra-data",
        api_key: Optional[str] = None,
        timeout: float = 90.0,
    ):
        self.data_dir = Path(data_dir).resolve()
        self.supabase_url = supabase_url.rstrip("/")
        self.bucket = bucket
        self.api_key = api_key
        self.timeout = timeout

        self._meta_lock = threading.Lock()
        self._file_locks: Dict[str, threading.Lock] = {}
        self._manifest_info: Dict[str, Dict[str, Any]] = {}
        self._dates_by_var: Dict[str, List[str]] = {}
        self._var_date_to_relpath: Dict[tuple[str, str], str] = {}
        self._all_dates: List[str] = []

        self._load_manifest()

    def _load_manifest(self) -> None:
        """Load metadata and expected SHA-256 checksums from manifest.json."""
        manifest_file = None
        for p in MANIFEST_PATHS:
            if p.exists():
                manifest_file = p
                break

        if not manifest_file:
            log.warning("No deployment manifest found at %s. Lazy downloads will proceed without pre-hashes.", MANIFEST_PATHS)
            return

        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            files = data.get("files", [])
            for item in files:
                rel = item.get("relative_path", "").replace("\\", "/").lstrip("/")
                if not rel or rel.endswith((".md", ".json")):
                    continue
                self._manifest_info[rel] = item

                # Index model files by (variable, date)
                # Filename pattern: ..._<var>_..._<YYYY-MM-DD>T00-00-00.nc
                if "model/" in rel and rel.endswith(".nc"):
                    name = Path(rel).stem
                    if "T00-00-00" in name:
                        d_str = name.split("_")[-1].replace("T00-00-00", "")
                        if d_str not in self._all_dates:
                            self._all_dates.append(d_str)

                        for v in ["thetao", "so", "uo", "vo", "chl"]:
                            if f"_{v}_" in name or f"_{v}-" in name or f"-{v}_" in name or f"-{v}-" in name:
                                self._var_date_to_relpath[(v, d_str)] = rel
                                if v not in self._dates_by_var:
                                    self._dates_by_var[v] = []
                                if d_str not in self._dates_by_var[v]:
                                    self._dates_by_var[v].append(d_str)

            self._all_dates.sort()
            for v in self._dates_by_var:
                self._dates_by_var[v].sort()

            log.info("StorageCache loaded manifest with %d scientific files across dates: %s", len(self._manifest_info), self._all_dates)
        except Exception as e:
            log.error("Failed to parse deployment manifest %s: %s", manifest_file, e)

    def get_available_dates(self) -> List[str]:
        """Return all model timesteps available in the deployment manifest."""
        return list(self._all_dates)

    def get_var_dates(self, nc_var: str) -> List[str]:
        """Return available dates for a specific variable."""
        return list(self._dates_by_var.get(nc_var, self._all_dates))

    def _get_file_lock(self, rel_path: str) -> threading.Lock:
        """Acquire or create a per-file threading lock to prevent duplicate downloads."""
        with self._meta_lock:
            if rel_path not in self._file_locks:
                self._file_locks[rel_path] = threading.Lock()
            return self._file_locks[rel_path]

    def resolve_model_file(self, nc_var: str, date_str: str) -> Optional[Path]:
        """Resolve and ensure local presence of a daily model file for a given variable and date."""
        rel_path = self._var_date_to_relpath.get((nc_var, date_str))
        if not rel_path:
            avail_dates = self.get_var_dates(nc_var)
            if avail_dates:
                # Nearest date match
                target_date = min(avail_dates, key=lambda d: abs(time.mktime(time.strptime(d, "%Y-%m-%d")) - time.mktime(time.strptime(date_str, "%Y-%m-%d"))))
                rel_path = self._var_date_to_relpath.get((nc_var, target_date))

        if not rel_path:
            log.warning("No model file mapping for (%s, %s) in manifest.", nc_var, date_str)
            return None

        return self.ensure_file(rel_path)

    def ensure_file(self, relative_path: str, max_retries: int = 3) -> Path:
        """
        Ensure the requested file is cached locally, downloading and verifying SHA-256 only if absent.
        Thread-safe and concurrency-protected.
        """
        rel_path = relative_path.replace("\\", "/").lstrip("/")
        local_path = self.data_dir / rel_path

        expected_meta = self._manifest_info.get(rel_path, {})
        expected_size = expected_meta.get("size_bytes")
        expected_sha256 = expected_meta.get("sha256")

        # ── Fast path: local file exists and matches size ─────────────────────
        if local_path.exists():
            if expected_size is None or local_path.stat().st_size == expected_size:
                return local_path

        # ── Slow path: Acquire per-file lock and download ─────────────────────
        with self._get_file_lock(rel_path):
            # Double check if another worker completed the download while waiting for lock
            if local_path.exists():
                if expected_size is None or local_path.stat().st_size == expected_size:
                    return local_path

            log.info("Cache miss for '%s'. Initiating lazy download from Supabase Storage...", rel_path)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = local_path.with_suffix(local_path.suffix + f".tmp.{os.getpid()}.{time.time_ns()}")

            headers = {}
            if self.api_key:
                url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{rel_path}"
                headers["Authorization"] = f"Bearer {self.api_key}"
                headers["apiKey"] = self.api_key
            else:
                # Public bucket URL (zero credential requirement)
                url = f"{self.supabase_url}/storage/v1/object/public/{self.bucket}/{rel_path}"

            success = False
            for attempt in range(1, max_retries + 1):
                try:
                    h = hashlib.sha256()
                    downloaded_bytes = 0
                    t_start = time.time()

                    with httpx.Client(timeout=self.timeout) as client:
                        with client.stream("GET", url, headers=headers) as stream:
                            if stream.status_code == 404:
                                raise FileNotFoundError(f"File '{rel_path}' not found in Supabase bucket '{self.bucket}'.")
                            if stream.status_code not in (200, 206):
                                raise RuntimeError(f"Supabase Storage returned HTTP {stream.status_code}: {stream.read().decode('utf-8', errors='replace')[:200]}")

                            with open(tmp_path, "wb") as f_out:
                                for chunk in stream.iter_bytes(chunk_size=1024 * 1024):
                                    if chunk:
                                        f_out.write(chunk)
                                        h.update(chunk)
                                        downloaded_bytes += len(chunk)

                    # Verify SHA-256 if expected hash exists
                    calculated_sha256 = h.hexdigest()
                    if expected_sha256 and calculated_sha256.lower() != expected_sha256.lower():
                        raise ValueError(f"Checksum mismatch for '{rel_path}': expected {expected_sha256}, got {calculated_sha256}")

                    # Atomic replace to final path
                    os.replace(tmp_path, local_path)
                    elapsed = time.time() - t_start
                    rate_mb = (downloaded_bytes / (1024 * 1024)) / max(elapsed, 0.05)
                    log.info("✅ Successfully cached '%s' (%.1f MB, %.2f MB/s, sha256=%s...)", rel_path, downloaded_bytes / (1024 * 1024), rate_mb, calculated_sha256[:8])
                    success = True
                    break

                except Exception as exc:
                    log.warning("Attempt %d to download '%s' failed: %s", attempt, rel_path, exc)
                    if tmp_path.exists():
                        try:
                            tmp_path.unlink()
                        except Exception:
                            pass
                    if attempt < max_retries:
                        time.sleep(2 ** attempt)

            if not success or not local_path.exists():
                raise RuntimeError(f"Failed to fetch '{rel_path}' from Supabase Storage after {max_retries} attempts.")

            return local_path
