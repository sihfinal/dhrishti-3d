#!/usr/bin/env python3
"""
scripts/create_deployment_dataset.py
=====================================

Creates a representative deployment dataset (~700–900 MB) from the full
Sagar Netra 3D scientific dataset (~17 GB) for constrained cloud deployment.

This script:
  1. Selects 7 representative daily model timesteps from the 90-day Q1 2026 archive
  2. Converts physical model data from float64 → float32 with zlib compression
  3. Performs stratified geographic/temporal/depth sampling of observation casts
  4. Preserves all geospatial boundary data (EEZ)
  5. Generates a MANIFEST.md documenting the subset
  6. Validates the resulting dataset

Usage:
    cd /path/to/dhrishti-3d
    .venv/bin/python scripts/create_deployment_dataset.py

    # Overwrite existing deployment dataset:
    .venv/bin/python scripts/create_deployment_dataset.py --force

Prerequisites:
    - numpy, netCDF4, xarray (installed in .venv)

The full dataset at data/ is NEVER modified.
Output is written to sagar-netra-deployment-data/
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

# ── CONFIGURATION ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FULL_DATA_DIR = PROJECT_ROOT / "data"
DEPLOY_DATA_DIR = PROJECT_ROOT / "sagar-netra-deployment-data"

# 6 representative dates spread across Q1 2026 (Jan 1 – Mar 31)
# Selected for ~18-day intervals to fit within the 850–950 MB Supabase Storage budget
REPRESENTATIVE_DATES = [
    "2026-01-01",   # Period start
    "2026-01-15",   # Mid-January
    "2026-02-01",   # February start
    "2026-02-15",   # Mid-February
    "2026-03-01",   # March start
    "2026-03-31",   # Period end
]

# Observation sampling targets (stratified by geography/time/depth)
ARGO_TARGET_CASTS = 2000      # from 22,231 total
ARGO_MIN_BGC_CASTS = 300      # ensure BGC-equipped casts are well represented
CTD_TARGET_CASTS = 200        # from 619 total
GLIDER_TARGET_CASTS = 500     # from 2,591 total

# Compression settings
COMPRESSION_LEVEL = 4  # zlib level (1=fast, 9=best compression)

# Data variables safe for float64 → float32 conversion (physical model only)
# These oceanographic variables have value ranges well within float32 precision.
SAFE_FLOAT32_VARS = {"thetao", "so", "uo", "vo"}

# Geographic grid edges for stratified sampling (10° × 10° cells)
LAT_EDGES = np.arange(-35, 35, 10)   # [-35, -25, -15, -5, 5, 15, 25]
LON_EDGES = np.arange(40, 105, 10)   # [40, 50, 60, 70, 80, 90, 100]

# BGC-indicating variables in WOD observation files
BGC_VARIABLES = {"Chlorophyll", "Oxygen", "Nitrate", "pH"}

# ── LOGGING ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("create_deployment_dataset")

# ── UTILITIES ────────────────────────────────────────────────────────────────


def format_size(nbytes: int | float) -> str:
    """Human-readable file size."""
    n = float(nbytes)
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def dir_size(path: Path) -> int:
    """Total size of all files under a directory."""
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total


def file_count(path: Path) -> int:
    """Count all files under a directory."""
    return sum(1 for f in path.rglob("*") if f.is_file())


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: MODEL DATA PROCESSING
# ═════════════════════════════════════════════════════════════════════════════


def process_model_files() -> Tuple[int, int]:
    """
    Select representative daily model files and create optimized copies.

    Physical model (thetao, so, uo, vo):
      - Original: float64, ~172 MB per daily file
      - Output: float32 + zlib compression → ~40–60 MB per file

    BGC model (chl):
      - Original: float32, ~6.4 MB per daily file
      - Output: + zlib compression → ~3–4 MB per file
    """
    import xarray as xr

    phy_src = FULL_DATA_DIR / "model" / "copernicus_daily"
    chl_src = FULL_DATA_DIR / "model" / "copernicus_chlorophyll_daily"
    phy_dst = DEPLOY_DATA_DIR / "model" / "copernicus_daily"
    chl_dst = DEPLOY_DATA_DIR / "model" / "copernicus_chlorophyll_daily"

    phy_dst.mkdir(parents=True, exist_ok=True)
    chl_dst.mkdir(parents=True, exist_ok=True)

    total_phy_written = 0
    total_chl_written = 0

    for date_str in REPRESENTATIVE_DATES:
        date_tag = date_str + "T00-00-00"

        # ── Physical model files (split per variable: each file is ≤ 40 MB for Supabase Free limit) ──
        phy_files = sorted(phy_src.glob(f"*{date_tag}*.nc"))
        if phy_files:
            src_file = phy_files[0]
            log.info(
                f"PHY model: {date_str}  "
                f"({format_size(src_file.stat().st_size)} → float32+zlib split by variable)"
            )

            ds = xr.open_dataset(src_file)

            for var in ["thetao", "so", "uo", "vo"]:
                if var not in ds.data_vars:
                    continue
                var_dst_name = src_file.name.replace("thetao-so-uo-vo", var)
                dst_file = phy_dst / var_dst_name
                sub_ds = ds[[var]]

                encoding = {var: {"zlib": True, "complevel": COMPRESSION_LEVEL}}
                if sub_ds[var].dtype == np.float64 and var in SAFE_FLOAT32_VARS:
                    encoding[var]["dtype"] = np.float32
                for coord in sub_ds.coords:
                    encoding[coord] = {"zlib": True, "complevel": COMPRESSION_LEVEL}

                sub_ds.to_netcdf(dst_file, encoding=encoding)
                written = dst_file.stat().st_size
                total_phy_written += written
                log.info(f"  → {dst_file.name} ({format_size(written)})")

            ds.close()
        else:
            log.warning(f"PHY model: No file found for date {date_str}")

        # ── Chlorophyll BGC model file ───────────────────────────────────
        chl_files = sorted(chl_src.glob(f"*{date_tag}*.nc"))
        if chl_files:
            src_file = chl_files[0]
            dst_file = chl_dst / src_file.name
            log.info(
                f"CHL model: {date_str}  "
                f"({format_size(src_file.stat().st_size)} → zlib)"
            )

            ds = xr.open_dataset(src_file)
            encoding = {}
            for var in ds.data_vars:
                encoding[var] = {"zlib": True, "complevel": COMPRESSION_LEVEL}
            for coord in ds.coords:
                encoding[coord] = {"zlib": True, "complevel": COMPRESSION_LEVEL}

            ds.to_netcdf(dst_file, encoding=encoding)
            written = dst_file.stat().st_size
            total_chl_written += written
            log.info(f"  → {dst_file.name} ({format_size(written)})")
            ds.close()
        else:
            log.warning(f"CHL model: No file found for date {date_str}")

    log.info(
        f"Model totals: PHY={format_size(total_phy_written)}, "
        f"CHL={format_size(total_chl_written)}"
    )
    return total_phy_written, total_chl_written


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2: STRATIFIED OBSERVATION SAMPLING
# ═════════════════════════════════════════════════════════════════════════════


def stratified_sample(
    lats: np.ndarray,
    lons: np.ndarray,
    dates: np.ndarray,
    target_count: int,
    bgc_mask: Optional[np.ndarray] = None,
    min_bgc: int = 0,
    rng_seed: int = 42,
    forced_indices: Optional[list[int]] = None,
) -> np.ndarray:
    """
    Stratified geographic + temporal sampling of observation casts.

    Divides the study region into 10°×10° geographic bins and temporal
    quarters, then samples proportionally from each stratum. BGC-equipped
    casts are prioritized to ensure biogeochemical coverage.
    Benchmark/regression casts specified in forced_indices are guaranteed.

    Returns sorted array of selected cast indices.
    """
    rng = np.random.default_rng(rng_seed)
    n_total = len(lats)

    if n_total <= target_count:
        log.info(f"  Keeping all {n_total} casts (≤ target {target_count})")
        return np.arange(n_total)

    # Assign geographic bin indices
    lat_bin = np.clip(np.digitize(lats, LAT_EDGES) - 1, 0, len(LAT_EDGES) - 1)
    lon_bin = np.clip(np.digitize(lons, LON_EDGES) - 1, 0, len(LON_EDGES) - 1)

    # Assign temporal bin indices (quarterly from date integer YYYYMMDD)
    time_bin = np.zeros(n_total, dtype=np.int32)
    for i in range(n_total):
        d = dates[i]
        if d is None or (hasattr(d, "__class__") and "Masked" in type(d).__name__):
            time_bin[i] = 0
            continue
        try:
            if np.ma.is_masked(d):
                time_bin[i] = 0
                continue
        except (TypeError, ValueError):
            pass
        try:
            d_int = int(d)
            month = (d_int // 100) % 100
            time_bin[i] = max(0, (month - 1) // 3)  # Q1=0, Q2=1, Q3=2, Q4=3
        except (ValueError, TypeError):
            time_bin[i] = 0

    # Build strata: (lat_bin, lon_bin, time_bin) → list of cast indices
    strata: dict[tuple, list[int]] = defaultdict(list)
    for i in range(n_total):
        key = (int(lat_bin[i]), int(lon_bin[i]), int(time_bin[i]))
        strata[key].append(i)

    selected: set[int] = set()

    # Pre-select guaranteed benchmark casts
    if forced_indices:
        for fi in forced_indices:
            if 0 <= fi < n_total:
                selected.add(int(fi))
        if selected:
            log.info(f"  Guaranteed benchmark casts pre-selected: {len(selected)}")

    # Phase 1: Ensure minimum BGC casts if requested
    if bgc_mask is not None and min_bgc > 0:
        bgc_indices = np.where(bgc_mask)[0]
        # Exclude already selected
        bgc_available = [idx for idx in bgc_indices if idx not in selected]
        needed_bgc = max(0, min_bgc - len([s for s in selected if bgc_mask[s]]))
        if needed_bgc > 0 and len(bgc_available) > 0:
            n_bgc = min(needed_bgc, len(bgc_available))
            bgc_selected = rng.choice(bgc_available, size=n_bgc, replace=False)
            selected.update(bgc_selected.tolist())
            log.info(f"  BGC priority: selected {n_bgc} additional BGC-equipped casts")

    remaining = target_count - len(selected)

    # Phase 2: Proportional allocation across geographic/temporal strata
    if remaining > 0:
        # Remove already-selected indices from strata pools
        available_strata = {
            k: [i for i in v if i not in selected]
            for k, v in strata.items()
        }
        available_strata = {k: v for k, v in available_strata.items() if v}
        total_available = sum(len(v) for v in available_strata.values())

        if total_available <= remaining:
            # Take everything remaining
            for v in available_strata.values():
                selected.update(v)
        else:
            # Proportional allocation with minimum 1 per non-empty stratum
            quotas: dict[tuple, int] = {}
            for k, v in available_strata.items():
                quota = max(1, round(len(v) / total_available * remaining))
                quotas[k] = min(quota, len(v))

            # Adjust to hit exact target
            allocated = sum(quotas.values())
            sorted_keys = sorted(
                available_strata.keys(),
                key=lambda x: len(available_strata[x]),
                reverse=True,
            )

            # Add to largest strata to reach target
            while allocated < remaining:
                added = False
                for k in sorted_keys:
                    if quotas[k] < len(available_strata[k]):
                        quotas[k] += 1
                        allocated += 1
                        added = True
                        if allocated >= remaining:
                            break
                if not added:
                    break

            # Remove from smallest strata if over target
            sorted_keys_asc = sorted(
                available_strata.keys(),
                key=lambda x: len(available_strata[x]),
            )
            while allocated > remaining:
                removed = False
                for k in sorted_keys_asc:
                    if quotas[k] > 1:
                        quotas[k] -= 1
                        allocated -= 1
                        removed = True
                        if allocated <= remaining:
                            break
                if not removed:
                    break

            # Sample from each stratum
            for k, quota in quotas.items():
                pool = np.array(available_strata[k])
                chosen = rng.choice(pool, size=min(quota, len(pool)), replace=False)
                selected.update(chosen.tolist())

    result = np.sort(np.array(list(selected), dtype=np.intp))

    # Final clip to target_count (may slightly exceed due to BGC priority)
    if len(result) > target_count:
        result = result[:target_count]

    n_strata_used = len(
        {(int(lat_bin[i]), int(lon_bin[i]), int(time_bin[i])) for i in result}
    )
    log.info(
        f"  Stratified sampling: {len(result)}/{n_total} casts "
        f"across {n_strata_used} strata"
    )

    return result


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2b: WOD RAGGED-ARRAY NETCDF SUBSETTING
# ═════════════════════════════════════════════════════════════════════════════


def subset_wod_file(
    src_path: Path,
    dst_path: Path,
    selected_indices: np.ndarray,
    label: str = "",
) -> int:
    """
    Subset a WOD/NCEI ragged-array (DSG) NetCDF file by selected cast indices.

    Preserves:
      - The ragged-array structure (contiguous ragged via *_row_size)
      - All cast-level metadata variables
      - All observation-level science variables
      - All variable and global attributes
      - Coordinate variables (lat, lon, time, z)

    Returns output file size in bytes.
    """
    import netCDF4 as nc4

    src = nc4.Dataset(str(src_path), "r")
    n_casts_orig = len(src.dimensions["casts"])
    selected = np.sort(selected_indices.astype(np.intp))
    n_selected = len(selected)

    log.info(f"  {label}: subsetting {n_selected}/{n_casts_orig} casts")

    # ── Step 1: Analyze ragged array structures ──────────────────────────
    # Each *_row_size variable on 'casts' dim maps casts to observation
    # counts for a corresponding *_obs dimension.
    ragged_arrays: dict[str, dict] = {}  # obs_dim_name → info

    for vname in src.variables:
        if not vname.endswith("_row_size"):
            continue
        var = src.variables[vname]
        if "casts" not in var.dimensions:
            continue

        prefix = vname[: -len("_row_size")]
        obs_dim = prefix + "_obs"

        if obs_dim not in src.dimensions:
            continue

        all_sizes = np.ma.filled(var[:], 0).astype(np.int64)
        all_offsets = np.zeros(n_casts_orig + 1, dtype=np.int64)
        np.cumsum(all_sizes, out=all_offsets[1:])

        sel_sizes = all_sizes[selected]
        slices = [(int(all_offsets[i]), int(all_sizes[i])) for i in selected]
        new_total = int(np.sum(sel_sizes))

        ragged_arrays[obs_dim] = {
            "rs_name": vname,
            "slices": slices,
            "new_size": new_total,
            "selected_sizes": sel_sizes,
        }

    # ── Step 2: Create output file with resized dimensions ───────────────
    dst = nc4.Dataset(str(dst_path), "w", format="NETCDF4")

    # Copy global attributes
    for attr in src.ncattrs():
        try:
            dst.setncattr(attr, src.getncattr(attr))
        except Exception:
            pass

    # Add provenance attribute
    dst.setncattr(
        "deployment_subset_info",
        f"Representative subset created {datetime.now().isoformat()} "
        f"({n_selected}/{n_casts_orig} casts selected via stratified sampling)",
    )

    # Create dimensions
    dst.createDimension("casts", n_selected)
    for obs_dim, info in ragged_arrays.items():
        dst.createDimension(obs_dim, info["new_size"])

    # Track which dimensions we skip entirely
    skip_dims = {"casts", "numberofpis"} | set(ragged_arrays.keys())
    for dname, dim in src.dimensions.items():
        if dname not in skip_dims and dname not in dst.dimensions:
            dst.createDimension(dname, len(dim) if not dim.isunlimited() else None)

    # ── Step 3: Copy variables with appropriate subsetting ───────────────
    vars_written = 0
    vars_skipped = 0

    for vname, var in src.variables.items():
        dims = var.dimensions
        dtype = var.dtype

        # Skip variables on the numberofpis dimension (PI metadata, unused by adapter)
        if "numberofpis" in dims:
            vars_skipped += 1
            continue

        try:
            if len(dims) == 0:
                # ── Scalar variable ──
                dst_var = dst.createVariable(vname, dtype)
                dst_var[:] = var[:]

            elif len(dims) == 1 and dims[0] == "casts":
                # ── Cast-level variable (lat, lon, time, date, etc.) ──
                dst_var = dst.createVariable(
                    vname,
                    dtype,
                    ("casts",),
                    zlib=True,
                    complevel=COMPRESSION_LEVEL,
                )
                data = var[:]
                dst_var[:] = data[selected]

            elif len(dims) == 1 and dims[0] in ragged_arrays:
                # ── Observation-level variable (ragged array slicing) ──
                obs_dim = dims[0]
                info = ragged_arrays[obs_dim]

                dst_var = dst.createVariable(
                    vname,
                    dtype,
                    (obs_dim,),
                    zlib=True,
                    complevel=COMPRESSION_LEVEL,
                )

                if info["new_size"] > 0:
                    # Read and concatenate selected cast observation slices
                    chunks = []
                    for start, count in info["slices"]:
                        if count > 0:
                            chunk = var[start : start + count]
                            chunks.append(chunk)
                    if chunks:
                        if isinstance(chunks[0], np.ma.MaskedArray):
                            concatenated = np.ma.concatenate(chunks)
                        else:
                            concatenated = np.concatenate(chunks)
                        dst_var[:] = concatenated
            else:
                # Skip variables with unsupported dimension structures
                vars_skipped += 1
                continue

            # Copy variable attributes (units, long_name, etc.)
            for attr in var.ncattrs():
                try:
                    dst_var.setncattr(attr, var.getncattr(attr))
                except Exception:
                    pass

            vars_written += 1

        except Exception as e:
            log.warning(f"    Warning: Could not copy variable '{vname}': {e}")
            vars_skipped += 1

    log.info(
        f"  {label}: wrote {vars_written} variables "
        f"({vars_skipped} skipped), {n_selected} casts"
    )

    dst.close()
    src.close()

    return dst_path.stat().st_size


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2c: OBSERVATION FILE PROCESSING
# ═════════════════════════════════════════════════════════════════════════════


def process_observations() -> dict[str, dict]:
    """
    Create subsetted observation files using stratified sampling.
    Preserves geographic, temporal, depth, and variable diversity.
    Ensures BGC-equipped Argo casts are well-represented.
    """
    import netCDF4 as nc4

    results: dict[str, dict] = {}

    # ── ARGO ─────────────────────────────────────────────────────────────
    argo_src = FULL_DATA_DIR / "argo" / "ocldb1788270080.21439_PFL.nc"
    argo_dst_dir = DEPLOY_DATA_DIR / "argo"
    argo_dst_dir.mkdir(parents=True, exist_ok=True)
    argo_dst = argo_dst_dir / "ocldb1788270080.21439_PFL.nc"

    if argo_src.exists():
        log.info("Processing Argo observations...")
        nc = nc4.Dataset(str(argo_src), "r")

        lats = np.ma.filled(nc.variables["lat"][:], 0).astype(np.float32)
        lons = np.ma.filled(nc.variables["lon"][:], 0).astype(np.float32)
        dates = nc.variables["date"][:] if "date" in nc.variables else np.zeros(len(lats))

        # Identify BGC-equipped casts (have chlorophyll, oxygen, nitrate, or pH)
        bgc_mask = np.zeros(len(lats), dtype=bool)
        for bgc_var in BGC_VARIABLES:
            rs_name = f"{bgc_var}_row_size"
            if rs_name in nc.variables:
                sizes = np.ma.filled(nc.variables[rs_name][:], 0)
                bgc_mask |= (sizes > 0)

        n_bgc_total = int(np.sum(bgc_mask))
        # Ensure regression & benchmark casts are guaranteed in subset
        forced_argo = []
        if "wod_unique_cast" in nc.variables:
            wuc = nc.variables["wod_unique_cast"][:]
            for cid in [20059500, 19770705, 19770706, 19770878]:
                matches = np.where(wuc == cid)[0]
                if len(matches) > 0:
                    forced_argo.append(int(matches[0]))
        log.info(f"  Guaranteed benchmark Argo casts: {forced_argo}")

        nc.close()

        # Stratified sampling with BGC priority and guaranteed benchmark casts
        selected = stratified_sample(
            lats, lons, dates,
            target_count=ARGO_TARGET_CASTS,
            bgc_mask=bgc_mask,
            min_bgc=ARGO_MIN_BGC_CASTS,
            forced_indices=forced_argo,
        )

        size = subset_wod_file(argo_src, argo_dst, selected, label="Argo")
        n_bgc_selected = int(np.sum(bgc_mask[selected]))

        results["argo"] = {
            "casts": len(selected),
            "casts_total": len(lats),
            "size": size,
        }
        results["bgc"] = {
            "casts": n_bgc_selected,
            "casts_total": n_bgc_total,
            "size": size,
        }
        log.info(
            f"  Argo result: {len(selected)} casts "
            f"({n_bgc_selected} with BGC), {format_size(size)}"
        )

        # Copy subsetted file to BGC directory (BGC casts are derived from Argo)
        bgc_dst_dir = DEPLOY_DATA_DIR / "bgc"
        bgc_dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(argo_dst, bgc_dst_dir / "ocldb1788270080.21439_PFL.nc")

        # Copy BGC provenance document
        bgc_source = FULL_DATA_DIR / "bgc" / "source.md"
        if bgc_source.exists():
            shutil.copy2(bgc_source, bgc_dst_dir / "source.md")
    else:
        log.warning("Argo source file not found!")

    # ── CTD ──────────────────────────────────────────────────────────────
    ctd_src = FULL_DATA_DIR / "ctd" / "ocldb1788270080.21439_CTD.nc"
    ctd_dst_dir = DEPLOY_DATA_DIR / "ctd"
    ctd_dst_dir.mkdir(parents=True, exist_ok=True)
    ctd_dst = ctd_dst_dir / "ocldb1788270080.21439_CTD.nc"

    if ctd_src.exists():
        log.info("Processing CTD observations...")
        nc = nc4.Dataset(str(ctd_src), "r")
        lats = np.ma.filled(nc.variables["lat"][:], 0).astype(np.float32)
        lons = np.ma.filled(nc.variables["lon"][:], 0).astype(np.float32)
        dates = nc.variables["date"][:] if "date" in nc.variables else np.zeros(len(lats))
        forced_ctd = []
        if "wod_unique_cast" in nc.variables:
            wuc = nc.variables["wod_unique_cast"][:]
            for cid in [20314995]:
                matches = np.where(wuc == cid)[0]
                if len(matches) > 0:
                    forced_ctd.append(int(matches[0]))
        log.info(f"  Guaranteed benchmark CTD casts: {forced_ctd}")
        nc.close()

        selected = stratified_sample(
            lats, lons, dates, target_count=CTD_TARGET_CASTS, forced_indices=forced_ctd
        )
        size = subset_wod_file(ctd_src, ctd_dst, selected, label="CTD")
        results["ctd"] = {
            "casts": len(selected),
            "casts_total": len(lats),
            "size": size,
        }
        log.info(f"  CTD result: {len(selected)} casts, {format_size(size)}")
    else:
        log.warning("CTD source file not found!")

    # ── GLIDER ───────────────────────────────────────────────────────────
    glider_src = FULL_DATA_DIR / "glider" / "ocldb1788270080.21439_GLD.nc"
    glider_dst_dir = DEPLOY_DATA_DIR / "glider"
    glider_dst_dir.mkdir(parents=True, exist_ok=True)
    glider_dst = glider_dst_dir / "ocldb1788270080.21439_GLD.nc"

    if glider_src.exists():
        log.info("Processing Glider observations...")
        nc = nc4.Dataset(str(glider_src), "r")
        lats = np.ma.filled(nc.variables["lat"][:], 0).astype(np.float32)
        lons = np.ma.filled(nc.variables["lon"][:], 0).astype(np.float32)
        dates = nc.variables["date"][:] if "date" in nc.variables else np.zeros(len(lats))
        forced_glider = []
        if "wod_unique_cast" in nc.variables:
            wuc = nc.variables["wod_unique_cast"][:]
            for cid in [22043437]:
                matches = np.where(wuc == cid)[0]
                if len(matches) > 0:
                    forced_glider.append(int(matches[0]))
        log.info(f"  Guaranteed benchmark Glider casts: {forced_glider}")
        nc.close()

        selected = stratified_sample(
            lats, lons, dates, target_count=GLIDER_TARGET_CASTS, forced_indices=forced_glider
        )
        size = subset_wod_file(glider_src, glider_dst, selected, label="Glider")
        results["glider"] = {
            "casts": len(selected),
            "casts_total": len(lats),
            "size": size,
        }
        log.info(f"  Glider result: {len(selected)} casts, {format_size(size)}")
    else:
        log.warning("Glider source file not found!")

    return results


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3: GEOSPATIAL AND DIRECTORY SETUP
# ═════════════════════════════════════════════════════════════════════════════


def process_geospatial() -> int:
    """Copy geospatial boundary data as-is (small enough to keep complete)."""
    src_dir = FULL_DATA_DIR / "geospatial"
    dst_dir = DEPLOY_DATA_DIR / "geospatial"

    if src_dir.exists():
        if dst_dir.exists():
            shutil.rmtree(dst_dir)
        shutil.copytree(src_dir, dst_dir)
        size = dir_size(dst_dir)
        log.info(f"Geospatial: copied as-is ({format_size(size)})")
        return size

    log.warning("Geospatial source directory not found!")
    return 0


def create_incoming_dir() -> None:
    """Create empty incoming directory for the automated ingestion service."""
    incoming = DEPLOY_DATA_DIR / "incoming"
    incoming.mkdir(parents=True, exist_ok=True)
    log.info("Created empty incoming/ directory")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 4: MANIFEST GENERATION
# ═════════════════════════════════════════════════════════════════════════════


def generate_manifest(
    obs_results: dict[str, dict],
    phy_size: int,
    chl_size: int,
    geo_size: int,
) -> None:
    """Generate MANIFEST.md documenting the deployment dataset contents."""
    total_size = dir_size(DEPLOY_DATA_DIR)
    total_files = file_count(DEPLOY_DATA_DIR)
    full_size = dir_size(FULL_DATA_DIR)
    reduction_pct = (1 - total_size / full_size) * 100 if full_size > 0 else 0

    def _r(key: str, field: str, default: Any = "N/A") -> Any:
        return obs_results.get(key, {}).get(field, default)

    manifest = f"""# Sagar Netra 3D — Deployment Dataset Manifest

## Overview

| Property | Value |
|----------|-------|
| **Dataset name** | Sagar Netra 3D Representative Deployment Subset |
| **Creation date** | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |
| **Source dataset** | `data/` (~{format_size(full_size)}) |
| **Total size** | {format_size(total_size)} |
| **File count** | {total_files} |
| **Reduction** | {reduction_pct:.1f}% from original |

> **IMPORTANT**: This is a **representative deployment subset**, NOT the complete
> scientific dataset. The full dataset remains the authoritative source for
> scientific analysis and publication.

## Purpose

This dataset is intended for:
- Live demonstration of Sagar Netra 3D functionality
- Application deployment on constrained cloud infrastructure
- UI/UX validation and end-to-end API testing
- Architecture validation (Supabase → FastAPI/Render → Frontend)

## Data Families

### CMEMS Physical Model (`model/copernicus_daily/`)
- **Variables**: thetao (temperature), so (salinity), uo (eastward velocity), vo (northward velocity)
- **Selected dates**: {', '.join(REPRESENTATIVE_DATES)}
- **Files**: {len(REPRESENTATIVE_DATES) * 4} NetCDF files (split per variable: each ≤ 40 MB for Supabase Free compliance)
- **Spatial coverage**: 40°E–100°E, 35°S–30°N (Indian Ocean basin)
- **Depth levels**: 40 standard levels (0.49–1942 m)
- **Resolution**: 0.083° (~9.2 km)
- **Optimization**: float64 → float32 + zlib compression (level {COMPRESSION_LEVEL}) + individual variable files
- **Size**: {format_size(phy_size)}

### CMEMS BGC Model (`model/copernicus_chlorophyll_daily/`)
- **Variables**: chl (mass concentration of chlorophyll-a)
- **Selected dates**: {', '.join(REPRESENTATIVE_DATES)}
- **Files**: {len(REPRESENTATIVE_DATES)} daily NetCDF files (each ~6.7 MB)
- **Spatial coverage**: 40°E–100°E, 35°S–30°N
- **Depth levels**: 54 standard levels (0.51–1945 m)
- **Resolution**: 0.25°
- **Optimization**: zlib compression (level {COMPRESSION_LEVEL})
- **Size**: {format_size(chl_size)}

### Argo Profiling Floats (`argo/`)
- **Casts**: {_r('argo', 'casts', 0)} / {_r('argo', 'casts_total', '22,231')}
- **Variables**: Temperature, Salinity, Chlorophyll, Oxygen, Nitrate, pH
- **BGC-equipped casts**: {_r('bgc', 'casts', 0)}
- **Sampling**: Stratified by 10°×10° geographic grid and temporal quarter
- **Size**: {format_size(_r('argo', 'size', 0))}

### CTD Ship Casts (`ctd/`)
- **Casts**: {_r('ctd', 'casts', 0)} / {_r('ctd', 'casts_total', '619')}
- **Variables**: Temperature, Salinity, Chlorophyll, Oxygen, Nitrate
- **Sampling**: Stratified by geography and time
- **Size**: {format_size(_r('ctd', 'size', 0))}

### Glider Observations (`glider/`)
- **Casts**: {_r('glider', 'casts', 0)} / {_r('glider', 'casts_total', '2,591')}
- **Variables**: Temperature, Salinity, Chlorophyll, Oxygen
- **Sampling**: Stratified by time (narrow geographic area ~57.5°E, 24°N)
- **Size**: {format_size(_r('glider', 'size', 0))}

### Geospatial Boundary Data (`geospatial/`)
- **Files**: india_eez.geojson (complete copy)
- **Size**: {format_size(geo_size)}

## Spatial Coverage
- **Latitude**: 35°S to 30°N (Indian Ocean)
- **Longitude**: 40°E to 100°E
- **Depth**: Surface to ~2000 m (model), surface to ~6000 m (observations)

## Temporal Coverage
- **Model**: {REPRESENTATIVE_DATES[0]} to {REPRESENTATIVE_DATES[-1]} (6 selected dates spanning Q1 2026 archive)
- **Argo**: 2020–2021 (subsampled)
- **CTD**: 2020–2025 (subsampled)
- **Glider**: 2021–2022 (subsampled)

## Variables Retained

### Model Variables
| Variable | NetCDF Name | Units | dtype | Range |
|----------|-------------|-------|-------|-------|
| Temperature | thetao | °C | float32 | -2 to 35 |
| Salinity | so | PSU | float32 | 0 to 42 |
| Eastward velocity | uo | m/s | float32 | -3 to 3 |
| Northward velocity | vo | m/s | float32 | -3 to 3 |
| Chlorophyll-a | chl | mg/m³ | float32 | 0.01 to 10 |

### Observation Variables
| Variable | Argo | CTD | Glider | BGC |
|----------|------|-----|--------|-----|
| Temperature | ✅ | ✅ | ✅ | ✅ |
| Salinity | ✅ | ✅ | ✅ | ✅ |
| Chlorophyll | ✅* | ✅ | ✅ | ✅ |
| Dissolved Oxygen | ✅* | ✅ | ✅ | ✅ |
| Nitrate | ✅* | ✅ | — | ✅ |
| pH | ✅* | — | — | ✅ |

\\* Only on BGC-equipped floats

## Sampling Methodology

1. **Model temporal sampling**: 7 dates at ~2-week intervals spanning Q1 2026
2. **Model spatial/depth**: Full spatial extent and all depth levels preserved
3. **float32 optimization**: Physical model variables converted from float64 → float32
   (negligible precision impact for oceanographic ranges)
4. **Observation stratified sampling**: Geographic (10°×10° grid) × temporal (quarterly)
   strata with proportional allocation and BGC priority
5. **Compression**: zlib level {COMPRESSION_LEVEL} applied to all NetCDF variables

## Known Limitations

1. **Temporal resolution**: 7 of 90 daily model timesteps retained (~2-week intervals);
   time-series animations will show coarser temporal evolution
2. **Observation density**: Reduced to ~{_r('argo', 'casts', 0)/22231*100:.0f}% Argo,
   ~{_r('ctd', 'casts', 0)/619*100:.0f}% CTD, ~{_r('glider', 'casts', 0)/2591*100:.0f}% Glider
3. **Not suitable for scientific publication** — this is a demonstration/deployment subset
4. **Temporal mismatch**: Observations (2020–2025) vs model (2026); the comparison
   service uses nearest-date matching which produces large time differences
5. **BGC file**: `bgc/` directory contains a copy of the Argo subset; BGC casts are
   identified by the presence of biogeochemical sensor data within Argo profiles

## Reproduction

To recreate this dataset from the full archive:

```bash
cd /path/to/dhrishti-3d
.venv/bin/python scripts/create_deployment_dataset.py --force
```

To validate:

```bash
.venv/bin/python scripts/validate_deployment_dataset.py
```
"""

    manifest_path = DEPLOY_DATA_DIR / "MANIFEST.md"
    manifest_path.write_text(manifest)
    log.info(f"Manifest written to {manifest_path}")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create Sagar Netra 3D representative deployment dataset"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing deployment dataset directory",
    )
    parser.add_argument(
        "--skip-model",
        action="store_true",
        help="Skip model regeneration if model directory already exists in destination",
    )
    args = parser.parse_args()

    log.info("=" * 72)
    log.info("  Sagar Netra 3D — Deployment Dataset Creation")
    log.info("=" * 72)

    # ── Validate source data ─────────────────────────────────────────────
    if not FULL_DATA_DIR.exists():
        log.error(f"Source data directory not found: {FULL_DATA_DIR}")
        sys.exit(1)

    full_size = dir_size(FULL_DATA_DIR)
    log.info(f"Source dataset: {FULL_DATA_DIR} ({format_size(full_size)})")
    log.info(f"Target output:  {DEPLOY_DATA_DIR}")

    # ── Handle existing output ───────────────────────────────────────────
    if DEPLOY_DATA_DIR.exists():
        if args.skip_model and (DEPLOY_DATA_DIR / "model").exists():
            log.info("Keeping existing model files (--skip-model)")
        elif args.force:
            log.info(f"Removing existing deployment dataset: {DEPLOY_DATA_DIR}")
            shutil.rmtree(DEPLOY_DATA_DIR)
            DEPLOY_DATA_DIR.mkdir(parents=True, exist_ok=True)
        else:
            log.error(
                f"Deployment dataset directory already exists: {DEPLOY_DATA_DIR}\n"
                "Use --force to overwrite, or --skip-model to keep existing models."
            )
            sys.exit(1)

    DEPLOY_DATA_DIR.mkdir(parents=True, exist_ok=True)

    t_start = time.time()

    # ── Phase 1: Model Data ──────────────────────────────────────────────
    log.info("")
    log.info("━" * 60)
    log.info("  Phase 1: Model Data Processing")
    log.info("━" * 60)
    if args.skip_model and (DEPLOY_DATA_DIR / "model").exists():
        log.info("Skipping model regeneration (--skip-model)")
        phy_size = dir_size(DEPLOY_DATA_DIR / "model" / "copernicus_daily")
        chl_size = dir_size(DEPLOY_DATA_DIR / "model" / "copernicus_chlorophyll_daily")
    else:
        phy_size, chl_size = process_model_files()

    # ── Phase 2: Observation Data ────────────────────────────────────────
    log.info("")
    log.info("━" * 60)
    log.info("  Phase 2: Observation Data Subsetting")
    log.info("━" * 60)
    obs_results = process_observations()

    # ── Phase 3: Geospatial Data ─────────────────────────────────────────
    log.info("")
    log.info("━" * 60)
    log.info("  Phase 3: Geospatial & Supporting Data")
    log.info("━" * 60)
    geo_size = process_geospatial()
    create_incoming_dir()

    # ── Phase 4: Manifest ────────────────────────────────────────────────
    log.info("")
    log.info("━" * 60)
    log.info("  Phase 4: Manifest Generation")
    log.info("━" * 60)
    generate_manifest(obs_results, phy_size, chl_size, geo_size)

    # ── Summary ──────────────────────────────────────────────────────────
    t_elapsed = time.time() - t_start
    total_size = dir_size(DEPLOY_DATA_DIR)
    total_files = file_count(DEPLOY_DATA_DIR)
    reduction_pct = (1 - total_size / full_size) * 100 if full_size > 0 else 0

    log.info("")
    log.info("=" * 72)
    log.info("  DEPLOYMENT DATASET CREATION COMPLETE")
    log.info("=" * 72)
    log.info(f"  Output:       {DEPLOY_DATA_DIR}")
    log.info(f"  Total size:   {format_size(total_size)}")
    log.info(f"  File count:   {total_files}")
    log.info(
        f"  Reduction:    {format_size(full_size)} → {format_size(total_size)} "
        f"({reduction_pct:.1f}% reduction)"
    )
    log.info(f"  Time:         {t_elapsed:.1f}s")
    log.info("")
    log.info("  Data families:")
    log.info(f"    CMEMS PHY model:  {format_size(phy_size)}")
    log.info(f"    CMEMS CHL model:  {format_size(chl_size)}")
    for key in ("argo", "ctd", "glider"):
        r = obs_results.get(key, {})
        log.info(
            f"    {key.upper():17s} {r.get('casts', 0):>5d} casts  "
            f"{format_size(r.get('size', 0))}"
        )
    log.info(f"    Geospatial:       {format_size(geo_size)}")
    log.info("")
    log.info("  Next steps:")
    log.info("    1. .venv/bin/python scripts/validate_deployment_dataset.py")
    log.info("    2. Test the application against the deployment dataset")
    log.info("=" * 72)


if __name__ == "__main__":
    main()
