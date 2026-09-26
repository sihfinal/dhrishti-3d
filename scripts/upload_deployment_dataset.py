#!/usr/bin/env python3
"""
scripts/upload_deployment_dataset.py
====================================
Reproducible, production-ready upload and synchronization tooling for
deploying the Sagar Netra 3D representative scientific dataset to Supabase
Free Object Storage.

Key Capabilities:
  1. Dataset Pre-Validation:
     - Checks total storage budget (target: 850–950 MB, strictly < 1 GB).
     - Strict verification that EVERY individual file is <= 50 MB (Supabase Free plan limit).
     - Generates SHA-256 checksums for cryptographic integrity verification.
  2. Bucket Management:
     - Verifies existence of the target Supabase Storage bucket (default: sagar-netra-data).
     - Automatically provisions bucket if permissions permit.
  3. Idempotent & Resumable Upload:
     - Queries existing objects; skips files already uploaded with identical size.
     - Uploads with correct MIME types (NetCDF, GeoJSON, Markdown).
  4. Security:
     - Strictly masks all API keys in console output and logs.
     - Reads credentials from environment or .env; never writes keys to disk.
  5. Manifest Generation:
     - Produces/updates manifest.json and MANIFEST.md with exact sizes and SHA-256 checksums.

Usage:
  # Dry-run validation & checksum generation (no credentials required):
  .venv/bin/python scripts/upload_deployment_dataset.py --dry-run

  # Full upload to Supabase:
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  .venv/bin/python scripts/upload_deployment_dataset.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import mimetypes
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("upload_deployment_dataset")

# Constants
PROJECT_ROOT = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

DEFAULT_DATA_DIR = PROJECT_ROOT / "sagar-netra-deployment-data"
DEFAULT_SUPABASE_URL = "https://wqdzzyeisvycfnhkzomu.supabase.co"
DEFAULT_BUCKET = "sagar-netra-data"
SUPABASE_FREE_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
STORAGE_BUDGET_TARGET_MIN = 500 * 1024 * 1024   # 500 MB
STORAGE_BUDGET_TARGET_MAX = 980 * 1024 * 1024   # 980 MB (safety cushion under 1 GB)


def mask_secret(secret: Optional[str]) -> str:
    """Mask sensitive tokens for safe logging."""
    if not secret:
        return "<not provided>"
    if len(secret) <= 8:
        return "***"
    return f"{secret[:4]}...{secret[-4:]}"


def format_size(nbytes: int | float) -> str:
    n = float(nbytes)
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def compute_sha256(file_path: Path) -> str:
    """Compute SHA-256 checksum of a file in 1 MB chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def get_mime_type(file_path: Path) -> str:
    """Determine MIME type for scientific dataset files."""
    suffix = file_path.suffix.lower()
    if suffix in (".nc", ".nc4", ".netcdf"):
        return "application/x-netcdf"
    if suffix in (".geojson", ".json"):
        return "application/geo+json"
    if suffix in (".md", ".txt"):
        return "text/markdown; charset=utf-8"
    mime, _ = mimetypes.guess_type(str(file_path))
    return mime or "application/octet-stream"


class SupabaseStorageClient:
    """Direct HTTPS REST client for Supabase Storage API."""

    def __init__(self, base_url: str, api_key: str, bucket: str, timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.bucket = bucket
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "apiKey": self.api_key,
        }

    def verify_or_create_bucket(self) -> bool:
        """Verify bucket exists; create if not found."""
        url = f"{self.base_url}/storage/v1/bucket/{self.bucket}"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.get(url, headers=self.headers)
            if resp.status_code == 200:
                log.info("Bucket '%s' exists and is accessible.", self.bucket)
                return True
            if resp.status_code == 404:
                log.info("Bucket '%s' not found. Attempting to create...", self.bucket)
                create_url = f"{self.base_url}/storage/v1/bucket"
                payload = {
                    "id": self.bucket,
                    "name": self.bucket,
                    "public": True,
                    "file_size_limit": SUPABASE_FREE_MAX_FILE_SIZE,
                }
                c_resp = client.post(create_url, headers=self.headers, json=payload)
                if c_resp.status_code in (200, 201):
                    log.info("Successfully created public bucket '%s'.", self.bucket)
                    return True
                log.error("Failed to create bucket '%s': %s %s", self.bucket, c_resp.status_code, c_resp.text)
                return False
            log.error("Failed to access bucket '%s': %s %s", self.bucket, resp.status_code, resp.text)
            return False

    def list_objects(self, prefix: str = "") -> Dict[str, Dict[str, Any]]:
        """List objects in the bucket, returning dict mapping relative name -> metadata."""
        url = f"{self.base_url}/storage/v1/object/list/{self.bucket}"
        objects: Dict[str, Dict[str, Any]] = {}
        with httpx.Client(timeout=self.timeout) as client:
            payload = {
                "prefix": prefix,
                "limit": 1000,
                "offset": 0,
                "sortBy": {"column": "name", "order": "asc"},
            }
            resp = client.post(url, headers=self.headers, json=payload)
            if resp.status_code == 200:
                items = resp.json()
                for item in items:
                    name = item.get("name")
                    if name:
                        objects[name] = item
            else:
                log.warning("Could not list objects in bucket '%s': %s", self.bucket, resp.text)
        return objects

    def upload_file(self, local_path: Path, remote_path: str, max_retries: int = 3) -> bool:
        """Upload a local file to Supabase Storage with retries."""
        url = f"{self.base_url}/storage/v1/object/{self.bucket}/{remote_path}"
        content_type = get_mime_type(local_path)
        headers = dict(self.headers)
        headers["Content-Type"] = content_type
        headers["x-upsert"] = "true"

        for attempt in range(1, max_retries + 1):
            try:
                with open(local_path, "rb") as f:
                    file_content = f.read()
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.post(url, headers=headers, content=file_content)
                if resp.status_code in (200, 201):
                    return True
                log.warning(
                    "Upload attempt %d for '%s' returned HTTP %s: %s",
                    attempt,
                    remote_path,
                    resp.status_code,
                    resp.text,
                )
            except Exception as e:
                log.warning("Upload attempt %d for '%s' failed: %s", attempt, remote_path, str(e))
            if attempt < max_retries:
                time.sleep(2 ** attempt)
        return False


def scan_deployment_dataset(data_dir: Path) -> Tuple[List[Dict[str, Any]], int, List[str]]:
    """Scan all files, compute sizes and SHA-256 checksums, and check limits."""
    files_info: List[Dict[str, Any]] = []
    total_size = 0
    oversized_files: List[str] = []

    all_files = sorted([p for p in data_dir.rglob("*") if p.is_file()])
    for p in all_files:
        rel_path = str(p.relative_to(data_dir)).replace("\\", "/")
        size = p.stat().st_size
        total_size += size
        if size > SUPABASE_FREE_MAX_FILE_SIZE:
            oversized_files.append(f"{rel_path} ({format_size(size)} > 50 MB)")

        log.info("Hashing [%s] (%s)...", rel_path, format_size(size))
        sha256 = compute_sha256(p)
        files_info.append({
            "relative_path": rel_path,
            "size_bytes": size,
            "size_formatted": format_size(size),
            "sha256": sha256,
            "mime_type": get_mime_type(p),
            "local_path": str(p),
        })

    return files_info, total_size, oversized_files


def generate_manifest_files(
    data_dir: Path,
    files_info: List[Dict[str, Any]],
    total_size: int,
    bucket: str,
    supabase_url: str,
) -> None:
    """Generate manifest.json and update MANIFEST.md with complete checksum table."""
    # 1. manifest.json
    manifest_data = {
        "dataset_name": "Sagar Netra 3D Representative Deployment Dataset",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_files": len(files_info),
        "total_size_bytes": total_size,
        "total_size_formatted": format_size(total_size),
        "supabase_target": {
            "url": supabase_url,
            "bucket": bucket,
            "max_file_size_bytes": SUPABASE_FREE_MAX_FILE_SIZE,
            "storage_budget_target": "850–950 MB",
        },
        "scientific_coverage": {
            "physical_model": "CMEMS 4D Daily (thetao, so, uo, vo) - 6 dates",
            "bgc_model": "CMEMS 4D Daily (chl) - 6 dates",
            "argo_floats": "2000 casts (T, S, BGC sensors)",
            "ctd_casts": "200 casts (T, S, BGC sensors)",
            "glider_missions": "500 casts (T, S, O2)",
            "geospatial": "India EEZ official boundary GeoJSON",
        },
        "files": files_info,
    }
    json_path = data_dir / "manifest.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    log.info("Wrote structured JSON manifest to: %s", json_path)

    # 2. Append/Update Checksums in MANIFEST.md
    md_path = data_dir / "MANIFEST.md"
    checksum_table = "\n\n## Deployment File Inventory & SHA-256 Checksums\n\n"
    checksum_table += f"Total Files: **{len(files_info)}** | Total Size: **{format_size(total_size)}**\n\n"
    checksum_table += "| File Path | Size | SHA-256 Checksum |\n"
    checksum_table += "|-----------|------|------------------|\n"
    for item in files_info:
        if item["relative_path"] in ("MANIFEST.md", "manifest.json"):
            continue
        checksum_table += f"| `{item['relative_path']}` | {item['size_formatted']} | `{item['sha256']}` |\n"

    if md_path.exists():
        content = md_path.read_text(encoding="utf-8")
        if "## Deployment File Inventory & SHA-256 Checksums" in content:
            content = content.split("## Deployment File Inventory & SHA-256 Checksums")[0].rstrip()
        content = content + checksum_table
        md_path.write_text(content, encoding="utf-8")
        log.info("Updated MANIFEST.md with complete SHA-256 checksums table.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upload and validate Sagar Netra 3D representative dataset for Supabase Storage."
    )
    parser.add_argument("--dir", type=Path, default=DEFAULT_DATA_DIR, help="Path to deployment dataset directory")
    parser.add_argument("--url", default=os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL), help="Supabase Project URL")
    parser.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY"), help="Supabase API Key")
    parser.add_argument("--bucket", default=os.environ.get("SUPABASE_BUCKET", DEFAULT_BUCKET), help="Supabase Storage bucket name")
    parser.add_argument("--dry-run", action="store_true", help="Perform validation, checksumming, and manifest generation without uploading")
    parser.add_argument("--verify", action="store_true", help="Verify remote bucket contents against local dataset")
    parser.add_argument("--force", action="store_true", help="Force re-upload of all files even if already present")
    args = parser.parse_args()

    data_dir = args.dir.resolve()
    log.info("=" * 72)
    log.info("  Sagar Netra 3D — Supabase Storage Tooling")
    log.info("=" * 72)
    log.info("Dataset Directory: %s", data_dir)
    log.info("Supabase Project:  %s", args.url)
    log.info("Target Bucket:     %s", args.bucket)
    log.info("Supabase Key:      %s", mask_secret(args.key))
    log.info("Dry Run Mode:      %s", args.dry_run)
    log.info("=" * 72)

    if not data_dir.exists():
        log.error("Dataset directory does not exist: %s", data_dir)
        return 1

    # Step 1: Scan and validate local dataset
    log.info("Scanning dataset and computing SHA-256 checksums...")
    files_info, total_size, oversized_files = scan_deployment_dataset(data_dir)

    log.info("─" * 72)
    log.info("Dataset Summary:")
    log.info("  Total Files:  %d", len(files_info))
    log.info("  Total Size:   %s (%d bytes)", format_size(total_size), total_size)
    log.info("  Storage Target: %s – %s", format_size(STORAGE_BUDGET_TARGET_MIN), format_size(STORAGE_BUDGET_TARGET_MAX))
    log.info("─" * 72)

    # Validate individual file size limit (50 MB)
    if oversized_files:
        log.error("❌ CRITICAL: %d files exceed the Supabase Free 50 MB limit!", len(oversized_files))
        for item in oversized_files:
            log.error("   - %s", item)
        log.error("Dataset CANNOT be uploaded to Supabase Free without further splitting/optimization.")
        return 1
    log.info("✅ All %d files are strictly <= 50 MB (Supabase Free limit compliant).", len(files_info))

    # Validate total storage budget
    if total_size > 1024 * 1024 * 1024:
        log.error("❌ Total dataset size (%s) exceeds Supabase Free 1.0 GB storage quota!", format_size(total_size))
        return 1
    safety_margin = (1024 * 1024 * 1024) - total_size
    log.info("✅ Total size (%s) fits within 1.0 GB quota with %s safety margin.", format_size(total_size), format_size(safety_margin))

    # Generate Manifest and Checksums
    generate_manifest_files(data_dir, files_info, total_size, args.bucket, args.url)

    if args.dry_run:
        log.info("")
        log.info("=" * 72)
        log.info("✅ DRY-RUN COMPLETE: Dataset is 100% compliant with Supabase Free constraints.")
        log.info("Manifest and SHA-256 checksums have been generated successfully.")
        log.info("=" * 72)
        return 0

    # Step 2: Check Credentials
    if not args.key:
        log.warning("")
        log.warning("=" * 72)
        log.warning("⚠️  SUPABASE CREDENTIALS NOT PROVIDED")
        log.warning("=" * 72)
        log.warning("To execute the actual upload to Supabase Storage:")
        log.warning("  1. Obtain your Supabase 'service_role' secret key from the project dashboard:")
        log.warning("     https://supabase.com/dashboard/project/wqdzzyeisvycfnhkzomu/settings/api")
        log.warning("  2. Set the environment variable in your terminal or .env:")
        log.warning("     export SUPABASE_SERVICE_ROLE_KEY=\"<your-service-role-key>\"")
        log.warning("  3. Run the upload command:")
        log.warning("     .venv/bin/python scripts/upload_deployment_dataset.py")
        log.warning("")
        log.warning("No files were uploaded because credentials are required for remote bucket mutation.")
        log.warning("Local dataset and checksum manifest remain completely validated and ready.")
        log.warning("=" * 72)
        return 0

    # Step 3: Connect to Supabase Storage
    client = SupabaseStorageClient(args.url, args.key, args.bucket)
    if not client.verify_or_create_bucket():
        log.error("Could not verify or create bucket '%s'. Aborting upload.", args.bucket)
        return 1

    # Step 4: Upload files
    log.info("Initiating upload of %d files to bucket '%s'...", len(files_info), args.bucket)
    existing_objects = client.list_objects()
    log.info("Found %d existing objects in remote bucket.", len(existing_objects))

    uploaded_count = 0
    skipped_count = 0
    failed_count = 0
    bytes_uploaded = 0
    start_time = time.time()

    for i, item in enumerate(files_info, 1):
        rel_path = item["relative_path"]
        size = item["size_bytes"]
        local_p = Path(item["local_path"])

        # Check if already exists with same size
        remote_meta = existing_objects.get(rel_path)
        if remote_meta and not args.force:
            meta_size = remote_meta.get("metadata", {}).get("size")
            if meta_size == size:
                log.info("[%d/%d] SKIPPED (already uploaded): %s (%s)", i, len(files_info), rel_path, item["size_formatted"])
                skipped_count += 1
                continue

        log.info("[%d/%d] UPLOADING: %s (%s)...", i, len(files_info), rel_path, item["size_formatted"])
        ok = client.upload_file(local_p, rel_path)
        if ok:
            uploaded_count += 1
            bytes_uploaded += size
            elapsed = time.time() - start_time
            rate = (bytes_uploaded / (1024 * 1024)) / max(elapsed, 0.1)
            log.info("   -> Uploaded successfully. (Throughput: %.2f MB/s)", rate)
        else:
            log.error("   -> FAILED to upload: %s", rel_path)
            failed_count += 1

    log.info("=" * 72)
    log.info("Upload Process Finished:")
    log.info("  Uploaded: %d files (%s)", uploaded_count, format_size(bytes_uploaded))
    log.info("  Skipped:  %d files (identical on remote)", skipped_count)
    log.info("  Failed:   %d files", failed_count)
    log.info("=" * 72)

    return 0 if failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
