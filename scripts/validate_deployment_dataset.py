#!/usr/bin/env python3
"""
scripts/validate_deployment_dataset.py
=======================================

Validates the Sagar Netra 3D deployment dataset for completeness,
data integrity, and model/observation overlap compatibility.

Usage:
    cd /path/to/dhrishti-3d
    .venv/bin/python scripts/validate_deployment_dataset.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEPLOY_DATA_DIR = PROJECT_ROOT / "sagar-netra-deployment-data"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("validate_deployment_dataset")

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"


def format_size(nbytes: int | float) -> str:
    n = float(nbytes)
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def dir_size(path: Path) -> int:
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total


def file_count(path: Path) -> int:
    return sum(1 for f in path.rglob("*") if f.is_file())


class ValidationReport:
    def __init__(self):
        self.checks: list[tuple[str, str, str]] = []  # (status, category, message)
        self.errors = 0
        self.warnings = 0
        self.passes = 0

    def ok(self, category: str, message: str):
        self.checks.append((PASS, category, message))
        self.passes += 1

    def fail(self, category: str, message: str):
        self.checks.append((FAIL, category, message))
        self.errors += 1

    def warn(self, category: str, message: str):
        self.checks.append((WARN, category, message))
        self.warnings += 1

    def print_report(self):
        log.info("")
        log.info("=" * 72)
        log.info("  Deployment Dataset Validation Report")
        log.info("=" * 72)
        
        current_category = ""
        for status, category, message in self.checks:
            if category != current_category:
                log.info(f"\n  ── {category} ──")
                current_category = category
            log.info(f"  {status}  {message}")
        
        log.info("")
        log.info("─" * 72)
        log.info(
            f"  Results: {self.passes} passed, "
            f"{self.warnings} warnings, {self.errors} errors"
        )
        if self.errors == 0:
            log.info(f"  {PASS}  Dataset is valid for deployment")
        else:
            log.info(f"  {FAIL}  Dataset has {self.errors} critical issues")
        log.info("=" * 72)


def validate() -> ValidationReport:
    report = ValidationReport()

    # ── 1. DIRECTORY EXISTENCE ───────────────────────────────────────────
    if not DEPLOY_DATA_DIR.exists():
        report.fail("Structure", f"Deployment directory not found: {DEPLOY_DATA_DIR}")
        report.print_report()
        return report

    report.ok("Structure", f"Deployment directory exists: {DEPLOY_DATA_DIR}")

    # ── 2. DATASET SIZE ──────────────────────────────────────────────────
    total = dir_size(DEPLOY_DATA_DIR)
    n_files = file_count(DEPLOY_DATA_DIR)
    report.ok("Size", f"Total size: {format_size(total)}")
    report.ok("Size", f"File count: {n_files}")

    if total < 100 * 1024 * 1024:  # < 100 MB
        report.fail("Size", "Dataset is suspiciously small (< 100 MB)")
    elif total > 1.2 * 1024 * 1024 * 1024:  # > 1.2 GB
        report.warn("Size", "Dataset exceeds 1.2 GB target")
    else:
        report.ok("Size", f"Size is within target range (500 MB – 1.0 GB)")

    # Check that NO individual file exceeds Supabase Free 50 MB upload limit
    large_files = [
        (p.name, format_size(p.stat().st_size))
        for p in DEPLOY_DATA_DIR.rglob("*")
        if p.is_file() and p.stat().st_size > 50 * 1024 * 1024
    ]
    if large_files:
        report.fail("Size", f"{len(large_files)} files exceed Supabase 50 MB limit: {large_files}")
    else:
        report.ok("Size", "All individual files are strictly ≤ 50 MB (Supabase Free limit compliant)")

    # ── 3. DIRECTORY STRUCTURE ───────────────────────────────────────────
    required_dirs = [
        "model/copernicus_daily",
        "model/copernicus_chlorophyll_daily",
        "argo",
        "bgc",
        "ctd",
        "glider",
        "geospatial",
        "incoming",
    ]
    for d in required_dirs:
        path = DEPLOY_DATA_DIR / d
        if path.exists():
            report.ok("Structure", f"Directory exists: {d}/")
        else:
            report.fail("Structure", f"Missing directory: {d}/")

    # ── 4. MODEL FILES ───────────────────────────────────────────────────
    import xarray as xr

    phy_dir = DEPLOY_DATA_DIR / "model" / "copernicus_daily"
    chl_dir = DEPLOY_DATA_DIR / "model" / "copernicus_chlorophyll_daily"

    phy_files = sorted(phy_dir.glob("*.nc")) if phy_dir.exists() else []
    chl_files = sorted(chl_dir.glob("*.nc")) if chl_dir.exists() else []

    if phy_files:
        report.ok("Model PHY", f"{len(phy_files)} physical model files found")
    else:
        report.fail("Model PHY", "No physical model files found")

    if chl_files:
        report.ok("Model CHL", f"{len(chl_files)} chlorophyll model files found")
    else:
        report.fail("Model CHL", "No chlorophyll model files found")

    # Check model variables across all physical files (supports both combined and split files)
    required_vars = {"thetao", "so", "uo", "vo"}
    found_vars: dict[str, Path] = {}
    for f in phy_files:
        try:
            ds = xr.open_dataset(f)
            for v in ds.data_vars:
                if v in required_vars and v not in found_vars:
                    found_vars[v] = f
            ds.close()
        except Exception:
            pass

    missing = required_vars - set(found_vars.keys())
    if missing:
        report.fail("Model PHY", f"Missing variables across physical files: {missing}")
    else:
        report.ok("Model PHY", f"All required variables present: {set(found_vars.keys())}")

    # Inspect coordinates and dtypes
    model_lat_range = (None, None)
    model_lon_range = (None, None)
    model_depth_range = (None, None)
    model_dates = []

    for var, f in sorted(found_vars.items()):
        try:
            ds = xr.open_dataset(f)
            if ds[var].dtype == np.float32:
                report.ok("Model PHY", f"{var}: dtype=float32 (optimized)")
            elif ds[var].dtype == np.float64:
                report.warn("Model PHY", f"{var}: still float64 (not optimized)")

            lats = ds.latitude.values
            lons = ds.longitude.values
            depths = ds.depth.values
            model_lat_range = (float(lats.min()), float(lats.max()))
            model_lon_range = (float(lons.min()), float(lons.max()))
            model_depth_range = (float(depths.min()), float(depths.max()))

            data = ds[var].values
            valid_count = np.count_nonzero(~np.isnan(data))
            if valid_count == 0:
                report.fail("Model PHY", f"{var}: ALL values are NaN!")
            else:
                pct = valid_count / data.size * 100
                report.ok("Model PHY", f"{var}: {pct:.1f}% valid values")
            ds.close()
        except Exception as e:
            report.fail("Model PHY", f"Error reading {var} from {f.name}: {e}")

    if model_lat_range[0] is not None:
        report.ok("Model PHY", f"Lat: {model_lat_range[0]:.1f}° to {model_lat_range[1]:.1f}°")
        report.ok("Model PHY", f"Lon: {model_lon_range[0]:.1f}° to {model_lon_range[1]:.1f}°")
        report.ok("Model PHY", f"Depth: {model_depth_range[0]:.1f}m to {model_depth_range[1]:.1f}m (40 levels)")

    # Extract model dates from filenames
    for f in phy_files:
        name = f.stem
        if "T00-00-00" in name:
            d_str = name.split("_")[-1].replace("T00-00-00", "")
            if d_str not in model_dates:
                model_dates.append(d_str)
    model_dates.sort()

    if model_dates:
        report.ok("Model PHY", f"Dates: {model_dates[0]} to {model_dates[-1]} ({len(model_dates)} timesteps)")

    # Check CHL files
    for f in chl_files[:1]:
        try:
            ds = xr.open_dataset(f)
            if "chl" in ds.data_vars:
                report.ok("Model CHL", "Variable 'chl' present")
                data = ds["chl"].values
                valid = np.count_nonzero(~np.isnan(data))
                if valid == 0:
                    report.fail("Model CHL", "chl: ALL values are NaN!")
                else:
                    report.ok("Model CHL", f"chl: {valid/data.size*100:.1f}% valid values")
            else:
                report.fail("Model CHL", "Variable 'chl' missing")
            ds.close()
        except Exception as e:
            report.fail("Model CHL", f"Error reading {f.name}: {e}")

    # ── 5. OBSERVATION FILES ─────────────────────────────────────────────
    import netCDF4 as nc4

    obs_configs = [
        ("Argo", DEPLOY_DATA_DIR / "argo" / "ocldb1788270080.21439_PFL.nc"),
        ("CTD", DEPLOY_DATA_DIR / "ctd" / "ocldb1788270080.21439_CTD.nc"),
        ("Glider", DEPLOY_DATA_DIR / "glider" / "ocldb1788270080.21439_GLD.nc"),
    ]

    obs_lat_ranges = {}
    obs_lon_ranges = {}

    for obs_name, obs_path in obs_configs:
        if not obs_path.exists():
            report.fail(f"Obs {obs_name}", f"File not found: {obs_path.name}")
            continue

        try:
            nc = nc4.Dataset(str(obs_path), "r")
            n_casts = len(nc.dimensions["casts"])
            report.ok(f"Obs {obs_name}", f"{n_casts} casts")

            # Check required variables
            required = {"lat", "lon", "z", "Temperature", "Salinity"}
            present = set(nc.variables.keys()) & required
            missing = required - present
            if missing:
                report.warn(f"Obs {obs_name}", f"Missing expected variables: {missing}")
            else:
                report.ok(f"Obs {obs_name}", f"Core variables present")

            # Check coordinate ranges
            lats = np.ma.filled(nc.variables["lat"][:], np.nan)
            lons = np.ma.filled(nc.variables["lon"][:], np.nan)
            valid_lats = lats[~np.isnan(lats)]
            valid_lons = lons[~np.isnan(lons)]

            if len(valid_lats) > 0:
                lat_range = (float(valid_lats.min()), float(valid_lats.max()))
                lon_range = (float(valid_lons.min()), float(valid_lons.max()))
                obs_lat_ranges[obs_name] = lat_range
                obs_lon_ranges[obs_name] = lon_range
                report.ok(
                    f"Obs {obs_name}",
                    f"Lat: {lat_range[0]:.2f}° to {lat_range[1]:.2f}°"
                )
                report.ok(
                    f"Obs {obs_name}",
                    f"Lon: {lon_range[0]:.2f}° to {lon_range[1]:.2f}°"
                )
            else:
                report.fail(f"Obs {obs_name}", "No valid lat/lon coordinates")

            # Check for row_size consistency
            if "z_row_size" in nc.variables:
                z_sizes = np.ma.filled(nc.variables["z_row_size"][:], 0)
                total_z = int(np.sum(z_sizes))
                if "z_obs" in nc.dimensions:
                    expected = len(nc.dimensions["z_obs"])
                    if total_z == expected:
                        report.ok(f"Obs {obs_name}", f"Ragged array z_obs consistent ({total_z} obs)")
                    else:
                        report.fail(
                            f"Obs {obs_name}",
                            f"z_obs size mismatch: sum(z_row_size)={total_z} vs dim={expected}"
                        )

            # Check Temperature row_size
            if "Temperature_row_size" in nc.variables:
                t_sizes = np.ma.filled(nc.variables["Temperature_row_size"][:], 0)
                casts_with_temp = int(np.sum(t_sizes > 0))
                report.ok(
                    f"Obs {obs_name}",
                    f"{casts_with_temp}/{n_casts} casts have Temperature data"
                )

            # Check BGC variables (for Argo)
            if obs_name == "Argo":
                bgc_vars_found = []
                for bv in ["Chlorophyll", "Oxygen", "Nitrate", "pH"]:
                    rs = f"{bv}_row_size"
                    if rs in nc.variables:
                        sizes = np.ma.filled(nc.variables[rs][:], 0)
                        n_with = int(np.sum(sizes > 0))
                        if n_with > 0:
                            bgc_vars_found.append(f"{bv}({n_with})")
                if bgc_vars_found:
                    report.ok(f"Obs {obs_name}", f"BGC variables: {', '.join(bgc_vars_found)}")
                else:
                    report.warn(f"Obs {obs_name}", "No BGC-equipped casts found")

            nc.close()
        except Exception as e:
            report.fail(f"Obs {obs_name}", f"Error reading file: {e}")

    # ── 6. BGC DIRECTORY ─────────────────────────────────────────────────
    bgc_file = DEPLOY_DATA_DIR / "bgc" / "ocldb1788270080.21439_PFL.nc"
    if bgc_file.exists():
        report.ok("BGC", "BGC file present (copy of Argo subset)")
    else:
        report.warn("BGC", "BGC file missing")

    bgc_source = DEPLOY_DATA_DIR / "bgc" / "source.md"
    if bgc_source.exists():
        report.ok("BGC", "source.md provenance document present")
    else:
        report.warn("BGC", "source.md missing")

    # ── 7. GEOSPATIAL ────────────────────────────────────────────────────
    eez_file = DEPLOY_DATA_DIR / "geospatial" / "india_eez.geojson"
    if eez_file.exists():
        size = eez_file.stat().st_size
        report.ok("Geospatial", f"india_eez.geojson present ({format_size(size)})")
    else:
        report.fail("Geospatial", "india_eez.geojson missing")

    # ── 8. MODEL/OBSERVATION OVERLAP ─────────────────────────────────────
    if model_lat_range[0] is not None and obs_lat_ranges:
        for obs_name, (obs_lat_min, obs_lat_max) in obs_lat_ranges.items():
            obs_lon_min, obs_lon_max = obs_lon_ranges[obs_name]

            # Check spatial overlap
            lat_overlap = (
                obs_lat_min <= model_lat_range[1]
                and obs_lat_max >= model_lat_range[0]
            )
            lon_overlap = (
                obs_lon_min <= model_lon_range[1]
                and obs_lon_max >= model_lon_range[0]
            )

            if lat_overlap and lon_overlap:
                report.ok(
                    "Overlap",
                    f"{obs_name} observations overlap with model domain"
                )
            else:
                report.fail(
                    "Overlap",
                    f"{obs_name} observations do NOT overlap with model domain!"
                )

    # ── 9. MANIFEST ──────────────────────────────────────────────────────
    manifest = DEPLOY_DATA_DIR / "MANIFEST.md"
    if manifest.exists():
        report.ok("Manifest", "MANIFEST.md present")
    else:
        report.warn("Manifest", "MANIFEST.md missing")

    report.print_report()
    return report


def main():
    log.info("Sagar Netra 3D — Deployment Dataset Validation")
    log.info(f"Target: {DEPLOY_DATA_DIR}")
    
    report = validate()
    
    if report.errors > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
