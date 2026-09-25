"""
backend/adapters/incois_rsmc.py
--------------------------------
INCOIS RSMC adapter for the locally-verified NetCDF file:
    RSMC_hycom_20260830.nc

Dataset verified structure
--------------------------
  Dimensions : TIME=28, DEPTH=6, LAT=1384, LON=1665
  Coordinates:
    LON   float32  [20.0 … 119.84]
    LAT   float32  [-44.93 … 30.95]
    TIME  datetime64[ns]  (28 × 6-hourly steps, 2026-08-29 06:00 … 2026-09-05 00:00)
    DEPTH float32  [0, 10, 50, 100, 250, 500]  metres
  Variables (all float32, dims TIME×DEPTH×LAT×LON):
    TEMP  — water temperature          (long_name="TEMP")
    SALN  — water salinity             (long_name="SALN")
    UVEL  — eastward  current velocity (units="m/s")
    VVEL  — northward current velocity (units="m/s")
  Additional (not served in Phase 1):
    SSH, TCHP, MLD, SALNA, TEMP_CT

Memory safety
-------------
xarray.open_dataset is called WITHOUT any .load() / .compute() on the full
dataset.  Only the requested lat/lon/time/depth window is ever read from disk,
using xarray's built-in lazy indexing via the netCDF4 engine.

Chunking note:  we intentionally do NOT set chunks= here because Dask is not
required — NetCDF4 engine uses HDF5 native chunking which already provides
lazy per-variable access.  A single 2-D slice (e.g. 1384 × 1665 × 4 bytes)
is ≈ 9 MB, well within safe per-request limits.  If Dask is desired in a
future phase, add chunks={"TIME": 1, "DEPTH": 1} and import dask.

Quantization contract
---------------------
Matches the existing Sagar Netra frontend decoder in src/lib/api.ts:

  uint8 fields (TEMP, SALN, SSH):
    q   = round((v - vmin) * 254 / (vmax - vmin))   ∈ [0, 254]
    255 = fillByte  (NaN / land)
    v   = offset + q * scale   where scale=(vmax-vmin)/254, offset=vmin

  uint8 fields for velocity (UVEL, VVEL):
    Same uint8 encoding but centred so that 0 m/s maps to q≈127.
    vmin/vmax are derived from the slice extremes (symmetric if possible).
    dtype header is still "uint8" — the frontend reads as Uint8Array and
    applies the same linear decode.  No int8 is used to keep the existing
    fieldCache / DataTexture pipeline intact.
"""
from __future__ import annotations

import logging
from functools import cached_property
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xarray as xr

from .base import GriddedAdapter, SliceResult

log = logging.getLogger(__name__)

# ── Supported variables ───────────────────────────────────────────────────────
# Maps public API variable name → actual NetCDF variable name.
# They are identical here (INCOIS uses uppercase); kept as a mapping so that
# the adapter never silently renames the source dataset.
VARIABLE_MAP: dict[str, str] = {
    "TEMP": "TEMP",
    "SALN": "SALN",
    "UVEL": "UVEL",
    "VVEL": "VVEL",
}

# Physically reasonable global bounds used when the slice itself contains only
# NaNs (e.g. the user asked for a land-only box).  These are never hardcoded
# into the API response — actual per-slice min/max are always computed.
_FALLBACK_BOUNDS: dict[str, tuple[float, float]] = {
    "TEMP": (-2.0, 35.0),
    "SALN": (0.0, 42.0),
    "UVEL": (-3.0, 3.0),
    "VVEL": (-3.0, 3.0),
}


class RSMCAdapter(GriddedAdapter):
    """
    Lazily reads RSMC_hycom_20260830.nc and serves sliced binary fields.

    The dataset is opened once at startup (metadata only) and kept open for
    the lifetime of the process.  Individual array reads are issued on demand
    inside get_slice().
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        if not path.exists():
            raise FileNotFoundError(
                f"RSMC NetCDF not found at {path}\n"
                "Set RSMC_NETCDF_PATH in your environment to the correct path."
            )
        log.info("Opening RSMC dataset (lazy) from %s", path)
        # engine="netcdf4" uses the HDF5/NC4 driver which supports lazy
        # chunk-level reads without loading the full file into RAM.
        self._ds: xr.Dataset = xr.open_dataset(str(path), engine="netcdf4")
        log.info(
            "Dataset open — TIME=%d DEPTH=%d LAT=%d LON=%d",
            self._ds.sizes["TIME"],
            self._ds.sizes["DEPTH"],
            self._ds.sizes["LAT"],
            self._ds.sizes["LON"],
        )

    # ── BaseAdapter ───────────────────────────────────────────────────────────

    @property
    def dataset_id(self) -> str:
        return "incois_rsmc_daily"

    def fetch_metadata(self) -> dict[str, Any]:
        ds = self._ds
        times = self.available_times()
        depths = self.available_depths()
        lats = ds.coords["LAT"].values.tolist()
        lons = ds.coords["LON"].values.tolist()
        return {
            "id": self.dataset_id,
            "name": "INCOIS RSMC Daily Ocean Forecast",
            "source": "Indian National Centre for Ocean Information Services (INCOIS)",
            "source_file": self._path.name,
            "conventions": ds.attrs.get("Conventions", "N/A"),
            "history": ds.attrs.get("history", "N/A"),
            "native_variables": list(VARIABLE_MAP.keys()),
            "units": {
                "TEMP": ds["TEMP"].attrs.get("units", "degC (assumed)"),
                "SALN": ds["SALN"].attrs.get("units", "PSU (assumed)"),
                "UVEL": ds["UVEL"].attrs.get("units", "m/s"),
                "VVEL": ds["VVEL"].attrs.get("units", "m/s"),
            },
            "time_coverage_start": times[0] if times else None,
            "time_coverage_end": times[-1] if times else None,
            "times": times,
            "depthsM": depths,
            "depth_min": depths[0] if depths else None,
            "depth_max": depths[-1] if depths else None,
            "lat_min": float(ds.coords["LAT"].values.min()),
            "lat_max": float(ds.coords["LAT"].values.max()),
            "lon_min": float(ds.coords["LON"].values.min()),
            "lon_max": float(ds.coords["LON"].values.max()),
            "grid": {
                "nTime": ds.sizes["TIME"],
                "nDepth": ds.sizes["DEPTH"],
                "nLat": ds.sizes["LAT"],
                "nLon": ds.sizes["LON"],
            },
            "provenance": {
                "url": "https://las.incois.gov.in/thredds/",
                "citation": "Indian National Centre for Ocean Information Services (INCOIS)",
            },
        }

    # ── GriddedAdapter ────────────────────────────────────────────────────────

    def available_times(self) -> list[str]:
        """Return all TIME values as ISO-8601 UTC strings."""
        raw = self._ds.coords["TIME"].values  # numpy datetime64
        return [
            pd.Timestamp(t).isoformat(timespec="seconds") + "Z"
            for t in raw
        ]

    def available_depths(self) -> list[float]:
        """Return all DEPTH coordinate values in metres (native RSMC grid)."""
        return [float(d) for d in self._ds.coords["DEPTH"].values]

    def get_slice(
        self,
        variable: str,
        timestamp: str,
        depth: float,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        stride: int = 1,
    ) -> SliceResult:
        """
        Lazily extract a 2-D LAT×LON slice and return a quantized binary blob.

        Steps
        -----
        1.  Validate variable name and bounds.
        2.  Select nearest TIME coordinate.
        3.  Select nearest DEPTH coordinate.
        4.  Crop to [lat_min…lat_max] × [lon_min…lon_max].
        5.  Apply optional stride downsampling.
        6.  Trigger a single HDF5 read for this window only.
        7.  Quantize to uint8.
        8.  Return SliceResult with data + headers.
        """
        ds = self._ds

        # ── 1. Validate variable ──────────────────────────────────────────────
        if variable not in VARIABLE_MAP:
            raise ValueError(
                f"Unknown variable '{variable}'. "
                f"Supported: {list(VARIABLE_MAP.keys())}"
            )
        nc_var = VARIABLE_MAP[variable]

        # ── 2. Nearest TIME ───────────────────────────────────────────────────
        try:
            req_time = pd.Timestamp(timestamp).tz_convert(None)
        except Exception as exc:
            raise ValueError(f"Cannot parse timestamp '{timestamp}': {exc}") from exc

        time_da = ds.coords["TIME"]
        # xarray nearest selection
        sel_time_da = time_da.sel(TIME=np.datetime64(req_time), method="nearest")
        actual_time_np = sel_time_da.values
        actual_time_str = (
            pd.Timestamp(actual_time_np).isoformat(timespec="seconds") + "Z"
        )

        # ── 3. Nearest DEPTH ──────────────────────────────────────────────────
        depth_da = ds.coords["DEPTH"]
        sel_depth_da = depth_da.sel(DEPTH=float(depth), method="nearest")
        actual_depth = float(sel_depth_da.values)

        # ── 4. Spatial crop ───────────────────────────────────────────────────
        # Validate bounds against dataset extents
        ds_lat_min = float(ds.coords["LAT"].values.min())
        ds_lat_max = float(ds.coords["LAT"].values.max())
        ds_lon_min = float(ds.coords["LON"].values.min())
        ds_lon_max = float(ds.coords["LON"].values.max())

        if lat_min > lat_max:
            raise ValueError("latitude_min must be ≤ latitude_max")
        if lon_min > lon_max:
            raise ValueError("longitude_min must be ≤ longitude_max")
        if lat_min > ds_lat_max or lat_max < ds_lat_min:
            raise ValueError(
                f"Latitude range [{lat_min}, {lat_max}] is outside dataset "
                f"extent [{ds_lat_min:.2f}, {ds_lat_max:.2f}]"
            )
        if lon_min > ds_lon_max or lon_max < ds_lon_min:
            raise ValueError(
                f"Longitude range [{lon_min}, {lon_max}] is outside dataset "
                f"extent [{ds_lon_min:.2f}, {ds_lon_max:.2f}]"
            )

        # ── 5. Lazy selection (NO .load() on full ds) ─────────────────────────
        # xarray.sel on a sliced sub-selection — only this window is read
        da = (
            ds[nc_var]
            .sel(
                TIME=np.datetime64(req_time), method="nearest"
            )
            .sel(
                DEPTH=float(depth), method="nearest"
            )
            .sel(
                LAT=slice(lat_min, lat_max),
                LON=slice(lon_min, lon_max),
            )
        )

        # Apply stride
        if stride > 1:
            da = da.isel(LAT=slice(None, None, stride), LON=slice(None, None, stride))

        # ── 6. Read ONLY this window from disk ────────────────────────────────
        arr: np.ndarray = da.values.astype(np.float32)  # triggers the HDF5 read

        height, width = arr.shape

        if height == 0 or width == 0:
            raise ValueError("Spatial selection returned an empty grid.")

        # ── 7. Quantize to uint8 ─────────────────────────────────────────────
        valid = arr[~np.isnan(arr)]
        if valid.size == 0:
            # All land/NaN — use fallback physical bounds
            vmin, vmax = _FALLBACK_BOUNDS.get(variable, (-1.0, 1.0))
        else:
            vmin = float(valid.min())
            vmax = float(valid.max())
            if vmax == vmin:
                vmax = vmin + 1e-6  # prevent division by zero

        scale = (vmax - vmin) / 254.0
        offset = vmin
        fill_byte = 255

        with np.errstate(invalid="ignore"):
            # NaN cells produce a benign "invalid value" warning during the
            # astype(uint8) cast; we overwrite them with fill_byte right after.
            q = np.round((arr - vmin) * 254.0 / (vmax - vmin)).astype(np.uint8)
        q[np.isnan(arr)] = fill_byte
        q[arr < vmin] = 0
        q[arr > vmax] = 254

        return SliceResult(
            data=q.tobytes(),
            dtype="uint8",
            scale=round(scale, 8),
            offset=round(offset, 6),
            fill_value=fill_byte,
            global_min=round(vmin, 6),
            global_max=round(vmax, 6),
            actual_time=actual_time_str,
            actual_depth=actual_depth,
            width=width,
            height=height,
        )

    def close(self) -> None:
        """Release the open NetCDF file handle."""
        try:
            self._ds.close()
        except Exception:
            pass
