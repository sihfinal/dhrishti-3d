#!/usr/bin/env python3
"""
scripts/sync_data.py
====================
Authoritative scientific data synchronization utility for Sagar Netra 3D.

Operates with the backend's StorageCache to provide:
  - Explicit full sync: downloads the entire representative dataset when requested (e.g. local dev).
  - Single-file sync: downloads an exact file on-demand with SHA-256 validation.
  - Integrity verification: verifies local file sizes and SHA-256 checksums against the manifest.
  - Atomic downloads: streams into .tmp.<pid> before atomic rename to prevent corruptions.
  - Concurrency safety: per-file locking prevents duplicate concurrent transfers.

Usage:
  # Check / sync dataset for local development:
  .venv/bin/python scripts/sync_data.py --sync-all

  # Verify checksums of currently cached files:
  .venv/bin/python scripts/sync_data.py --verify

  # Download a single specific file:
  .venv/bin/python scripts/sync_data.py --file geospatial/india_eez.geojson
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.storage_cache import StorageCache

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("sync_data")


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def verify_cache(cache: StorageCache) -> int:
    """Verify all local files against the deployment manifest."""
    manifest_files = cache._manifest_info
    log.info("Verifying %d files against deployment manifest...", len(manifest_files))

    valid = 0
    missing = 0
    corrupted = 0

    for rel_path, meta in sorted(manifest_files.items()):
        local_p = cache.data_dir / rel_path
        expected_size = meta.get("size_bytes")
        expected_sha = meta.get("sha256")

        if not local_p.exists():
            log.warning("  MISSING:   %s", rel_path)
            missing += 1
            continue

        actual_size = local_p.stat().st_size
        if expected_size and actual_size != expected_size:
            log.error("  SIZE MISMATCH: %s (expected %d, got %d)", rel_path, expected_size, actual_size)
            corrupted += 1
            continue

        if expected_sha:
            actual_sha = compute_sha256(local_p)
            if actual_sha != expected_sha:
                log.error("  SHA256 MISMATCH: %s", rel_path)
                corrupted += 1
                continue

        log.info("  VALID:     %s (%s)", rel_path, meta.get("size_formatted", f"{actual_size} bytes"))
        valid += 1

    log.info("Verification Complete: %d Valid, %d Missing, %d Corrupted", valid, missing, corrupted)
    return 0 if (missing == 0 and corrupted == 0) else 1


def sync_all(cache: StorageCache) -> int:
    """Explicitly pre-download all representative dataset files."""
    manifest_files = cache._manifest_info
    log.info("Initiating full synchronization of %d scientific files to %s...", len(manifest_files), cache.data_dir)

    success_count = 0
    fail_count = 0
    t0 = time.time()

    for rel_path in sorted(manifest_files.keys()):
        try:
            cached_path = cache.ensure_file(rel_path)
            if cached_path.exists():
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            log.error("Failed to sync %s: %s", rel_path, e)
            fail_count += 1

    elapsed = time.time() - t0
    log.info("Sync finished in %.2fs: %d downloaded/cached, %d failed.", elapsed, success_count, fail_count)
    return 0 if fail_count == 0 else 1


def sync_single_file(cache: StorageCache, rel_path: str) -> int:
    """Download a single specified file lazily with SHA-256 verification."""
    log.info("Ensuring single file: %s", rel_path)
    try:
        p = cache.ensure_file(rel_path)
        log.info("✅ File ready at %s (%d bytes)", p, p.stat().st_size)
        return 0
    except Exception as e:
        log.error("Failed to ensure %s: %s", rel_path, e)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Sagar Netra 3D Data Synchronizer")
    parser.add_argument("--sync-all", action="store_true", help="Download all files in deployment manifest")
    parser.add_argument("--verify", action="store_true", help="Verify sizes and SHA-256 hashes of cached files")
    parser.add_argument("--file", type=str, help="Relative path of single file to fetch")
    parser.add_argument("--data-dir", type=str, default=None, help="Target data directory")

    args = parser.parse_args()

    data_dir_env = args.data_dir or os.environ.get("DATA_DIR") or "sagar-netra-deployment-data"
    data_path = Path(data_dir_env)
    if not data_path.is_absolute():
        data_path = PROJECT_ROOT / data_path

    cache = StorageCache.get_instance(data_path)

    if args.verify:
        return verify_cache(cache)
    elif args.file:
        return sync_single_file(cache, args.file)
    elif args.sync_all:
        return sync_all(cache)
    else:
        # Default mode: check if data exists; if not, inform user
        if not cache.data_dir.exists() or not list(cache.data_dir.glob("*")):
            log.info("Local dataset directory %s is empty.", cache.data_dir)
            log.info("Run with --sync-all to pre-fetch the full representative dataset,")
            log.info("or launch the backend to download required files lazily on demand.")
            return 0
        else:
            log.info("Local dataset directory %s contains existing files.", cache.data_dir)
            return verify_cache(cache)


if __name__ == "__main__":
    sys.exit(main())
