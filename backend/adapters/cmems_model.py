from __future__ import annotations

import collections
import glob
import logging
from pathlib import Path
import threading
from typing import Any, Optional
import numpy as np
import xarray as xr

from backend.adapters.base import BaseModelAdapter
from backend.registry.adapters import adapter_registry

log = logging.getLogger(__name__)

class DatasetCache:
    """
    Thread-safe, bounded LRU cache for open xarray Dataset handles.
    Keeps file handles open for fast lazy slicing without reading full arrays into RAM.
    Safely closes NetCDF files upon eviction or shutdown.
    """

    def __init__(self, max_size: int = 12):
        self.max_size = max_size
        self._cache: collections.OrderedDict[str, xr.Dataset] = collections.OrderedDict()
        self._lock = threading.Lock()

    def get(self, file_path: str | Path) -> xr.Dataset:
        key = str(Path(file_path).resolve())
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]

            # Lazily open NetCDF dataset (metadata only, no array loading)
            ds = xr.open_dataset(key)
            self._cache[key] = ds

            # Bounded cache: evict oldest if exceeding max_size
            while len(self._cache) > self.max_size:
                evicted_key, evicted_ds = self._cache.popitem(last=False)
                try:
                    evicted_ds.close()
                except Exception as err:
                    log.warning("Error closing evicted dataset %s: %s", evicted_key, err)

            return ds

    def close_all(self) -> None:
        """Close all open dataset handles cleanly upon application shutdown."""
        with self._lock:
            for key, ds in list(self._cache.items()):
                try:
                    ds.close()
                except Exception as err:
                    log.warning("Error closing dataset %s: %s", key, err)
            self._cache.clear()

VARIABLE_MAPPING = {
    "temperature": ("thetao", "copernicus_daily", "°C", -2.0, 35.0),
    "salinity": ("so", "copernicus_daily", "PSU", 0.0, 42.0),
    "u_velocity": ("uo", "copernicus_daily", "m/s", -3.0, 3.0),
    "v_velocity": ("vo", "copernicus_daily", "m/s", -3.0, 3.0),
    "chlorophyll": ("chl", "copernicus_chlorophyll_daily", "mg/m³", 0.01, 10.0),
    # Aliases
    "thetao": ("thetao", "copernicus_daily", "°C", -2.0, 35.0),
    "so": ("so", "copernicus_daily", "PSU", 0.0, 42.0),
    "uo": ("uo", "copernicus_daily", "m/s", -3.0, 3.0),
    "vo": ("vo", "copernicus_daily", "m/s", -3.0, 3.0),
    "chl": ("chl", "copernicus_chlorophyll_daily", "mg/m³", 0.01, 10.0),
}

class CMEMSModelAdapter(BaseModelAdapter):
    """
    High-performance lazy adapter for CMEMS Physical & BGC daily NetCDF archives.
    Indexes daily NetCDF files without reading 16+ GB arrays into memory.
    """

    @property
    def dataset_id(self) -> str:
        return "cmems-global-ocean-physics-bgc"

    def fetch_metadata(self) -> dict[str, Any]:
        return self.get_metadata()

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.phy_dir = data_dir / "model" / "copernicus_daily"
        self.bgc_dir = data_dir / "model" / "copernicus_chlorophyll_daily"
        self._phy_files = sorted(glob.glob(str(self.phy_dir / "*.nc")))
        self._bgc_files = sorted(glob.glob(str(self.bgc_dir / "*.nc")))
        self._date_to_phy_file: dict[str, str] = {}
        self._date_to_bgc_file: dict[str, str] = {}
        self._dataset_cache = DatasetCache(max_size=12)
        self._index_files()

    def _index_files(self) -> None:
        """Map YYYY-MM-DD to specific daily NetCDF file path for instant O(1) lookup."""
        for f in self._phy_files:
            # File name pattern: ..._YYYY-MM-DDT00-00-00.nc
            name = Path(f).stem
            if "T00-00-00" in name:
                d_str = name.split("_")[-1].replace("T00-00-00", "")
                self._date_to_phy_file[d_str] = f

        for f in self._bgc_files:
            name = Path(f).stem
            if "T00-00-00" in name:
                d_str = name.split("_")[-1].replace("T00-00-00", "")
                self._date_to_bgc_file[d_str] = f

    def get_metadata(self) -> dict[str, Any]:
        """Read sample coordinate metadata lazily from the first file."""
        if not self._phy_files:
            return {}

        ds = self._dataset_cache.get(self._phy_files[0])
        lats = ds.latitude.values
        lons = ds.longitude.values
        depths = ds.depth.values

        times = sorted(list(self._date_to_phy_file.keys()))
        t_start = times[0] if times else "2026-01-01"
        t_end = times[-1] if times else "2026-03-31"

        return {
            "id": "cmems-global-ocean-physics-bgc",
            "name": "Copernicus Marine Global Ocean Analysis and Forecast (Q1 2026)",
            "source": "Copernicus Marine Service (CMEMS)",
            "product": "GLOBAL_ANALYSIS_PHY_001_024 / GLOBAL_ANALYSIS_BGC_001_028",
            "variables": ["temperature", "salinity", "u_velocity", "v_velocity", "chlorophyll"],
            "variable_mappings": {
                "temperature": "thetao",
                "salinity": "so",
                "u_velocity": "uo",
                "v_velocity": "vo",
                "chlorophyll": "chl",
            },
            "units": {
                "temperature": "°C",
                "salinity": "PSU",
                "u_velocity": "m/s",
                "v_velocity": "m/s",
                "chlorophyll": "mg/m³",
            },
            "latitude_range": (float(lats.min()), float(lats.max())),
            "longitude_range": (float(lons.min()), float(lons.max())),
            "depth_range": (float(depths.min()), float(depths.max())),
            "time_range": (t_start, t_end),
            "file_count": len(self._phy_files) + len(self._bgc_files),
            "grid": {
                "physics_res_deg": 0.083,
                "bgc_res_deg": 0.25,
                "lat_points": len(lats),
                "lon_points": len(lons),
                "depth_levels": len(depths),
            },
        }

    def get_available_times(self) -> list[str]:
        """Return list of all 90 available daily dates (YYYY-MM-DD)."""
        return sorted(list(self._date_to_phy_file.keys()))

    def get_available_depths(self, variable: str = "temperature") -> list[float]:
        """Return available depth levels from NetCDF depth coordinate."""
        if not self._phy_files:
            return []
        
        target_files = self._bgc_files if variable == "chlorophyll" else self._phy_files
        ds = self._dataset_cache.get(target_files[0])
        return [float(d) for d in ds.depth.values]

    def get_field_slice(
        self,
        variable: str,
        date_str: str,
        depth: float,
        lat_min: float = -35.0,
        lat_max: float = 30.0,
        lon_min: float = 40.0,
        lon_max: float = 100.0,
        stride: int = 1,
    ) -> dict[str, Any]:
        """
        Lazily extract a 2D spatial slice for the requested variable, date, depth, and bounding box.
        Reuses cached open dataset handles for high-speed repeated access.
        """
        var_info = VARIABLE_MAPPING.get(variable.lower())
        if not var_info:
            raise ValueError(f"Unsupported model variable '{variable}'")

        nc_var, sub_dir, unit, min_fallback, max_fallback = var_info
        file_map = self._date_to_bgc_file if sub_dir == "copernicus_chlorophyll_daily" else self._date_to_phy_file

        # Resolve nearest date file
        if date_str not in file_map:
            # Pick nearest date
            avail_dates = sorted(file_map.keys())
            if not avail_dates:
                raise FileNotFoundError(f"No model NetCDF files found for {sub_dir}")
            target_date = min(avail_dates, key=lambda d: abs(np.datetime64(d) - np.datetime64(date_str)))
        else:
            target_date = date_str

        file_path = file_map[target_date]

        # Reuse already-open dataset handle from bounded cache (lazy metadata, no full array reading)
        ds = self._dataset_cache.get(file_path)

        # Find nearest depth level
        depth_coord = ds.depth
        actual_depth = float(depth_coord.sel(depth=depth, method="nearest").values)

        # Check coordinate direction
        lat_coords = ds.latitude.values
        lon_coords = ds.longitude.values
        is_lat_desc = bool(lat_coords[0] > lat_coords[-1])
        is_lon_desc = bool(lon_coords[0] > lon_coords[-1])

        eff_lat_min = min(lat_min, lat_max)
        eff_lat_max = max(lat_min, lat_max)
        eff_lon_min = min(lon_min, lon_max)
        eff_lon_max = max(lon_min, lon_max)

        # Lazy spatial subsetting with orientation protection
        lat_slice = slice(eff_lat_max, eff_lat_min) if is_lat_desc else slice(eff_lat_min, eff_lat_max)
        lon_slice = slice(eff_lon_max, eff_lon_min) if is_lon_desc else slice(eff_lon_min, eff_lon_max)

        data_slice = ds[nc_var].sel(
            depth=actual_depth,
            latitude=lat_slice,
            longitude=lon_slice,
        )

        # Apply spatial stride if requested
        if stride > 1:
            data_slice = data_slice.isel(
                latitude=slice(None, None, stride),
                longitude=slice(None, None, stride),
            )

        # Squeeze time dim if present
        if "time" in data_slice.dims:
            data_slice = data_slice.squeeze("time")

        # Extract small 2D array
        lats = [float(x) for x in data_slice.latitude.values]
        lons = [float(x) for x in data_slice.longitude.values]
        arr = data_slice.values

        # Fast array cleaning and bounds calculation
        valid_mask = ~np.isnan(arr)
        has_valid = np.any(valid_mask)
        arr_clean = np.where(valid_mask, arr, None)
        min_val = float(np.amin(arr[valid_mask])) if has_valid else min_fallback
        max_val = float(np.amax(arr[valid_mask])) if has_valid else max_fallback

        return {
            "variable": variable,
            "nc_variable": nc_var,
            "time": target_date,
            "depth": actual_depth,
            "requested_depth": depth,
            "actual_depth": actual_depth,
            "lat_min": float(min(lats)) if lats else lat_min,
            "lat_max": float(max(lats)) if lats else lat_max,
            "lon_min": float(min(lons)) if lons else lon_min,
            "lon_max": float(max(lons)) if lons else lon_max,
            "width": len(lons),
            "height": len(lats),
            "latitudes": lats,
            "longitudes": lons,
            "values": arr_clean.tolist(),
            "min_value": min_val,
            "max_value": max_val,
            "unit": unit,
        }

    def get_field_stack(
        self,
        variable: str,
        date_str: str,
        depths: list[float],
        lat_min: float = -35.0,
        lat_max: float = 30.0,
        lon_min: float = 40.0,
        lon_max: float = 100.0,
        stride: int = 1,
    ) -> dict[str, Any]:
        """
        Extract a batch of 2D spatial slices across multiple depth levels in a single operation.
        Reuses cached open dataset handles from Step 1 and resolves nearest depths accurately.
        For 'currents', returns both 'uo' and 'vo' components in the same payload.
        """
        if not depths:
            raise ValueError("Depths list cannot be empty")

        var_lower = variable.lower()
        is_currents = (var_lower == "currents")

        if is_currents:
            sub_dir = "copernicus_daily"
            unit = "m/s"
            file_map = self._date_to_phy_file
        else:
            var_info = VARIABLE_MAPPING.get(var_lower)
            if not var_info:
                raise ValueError(f"Unsupported model variable '{variable}'")
            nc_var, sub_dir, unit, min_fallback, max_fallback = var_info
            file_map = self._date_to_bgc_file if sub_dir == "copernicus_chlorophyll_daily" else self._date_to_phy_file

        # Resolve nearest date file
        if date_str not in file_map:
            avail_dates = sorted(file_map.keys())
            if not avail_dates:
                raise FileNotFoundError(f"No model NetCDF files found for {sub_dir}")
            target_date = min(avail_dates, key=lambda d: abs(np.datetime64(d) - np.datetime64(date_str)))
        else:
            target_date = date_str

        file_path = file_map[target_date]

        # Reuse cached open dataset
        ds = self._dataset_cache.get(file_path)
        depth_coord = ds.depth

        # Resolve actual depth coordinates for each requested depth level
        actual_depths = [float(depth_coord.sel(depth=d, method="nearest").values) for d in depths]

        # Check coordinate direction
        lat_coords = ds.latitude.values
        lon_coords = ds.longitude.values
        is_lat_desc = bool(lat_coords[0] > lat_coords[-1])
        is_lon_desc = bool(lon_coords[0] > lon_coords[-1])

        eff_lat_min = min(lat_min, lat_max)
        eff_lat_max = max(lat_min, lat_max)
        eff_lon_min = min(lon_min, lon_max)
        eff_lon_max = max(lon_min, lon_max)

        # Spatial slice with coordinate orientation protection
        lat_slice = slice(eff_lat_max, eff_lat_min) if is_lat_desc else slice(eff_lat_min, eff_lat_max)
        lon_slice = slice(eff_lon_max, eff_lon_min) if is_lon_desc else slice(eff_lon_min, eff_lon_max)

        # Unique actual depths for direct vertical subsetting
        unique_actual_depths = list(dict.fromkeys(actual_depths))

        if is_currents:
            # Smart vertical, spatial, and stride subsetting for both uo and vo
            sub_u = ds["uo"].sel(depth=unique_actual_depths, latitude=lat_slice, longitude=lon_slice)
            sub_v = ds["vo"].sel(depth=unique_actual_depths, latitude=lat_slice, longitude=lon_slice)
            if stride > 1:
                sub_u = sub_u.isel(latitude=slice(None, None, stride), longitude=slice(None, None, stride))
                sub_v = sub_v.isel(latitude=slice(None, None, stride), longitude=slice(None, None, stride))
            if "time" in sub_u.dims:
                sub_u = sub_u.squeeze("time")
            if "time" in sub_v.dims:
                sub_v = sub_v.squeeze("time")

            lats = [float(x) for x in sub_u.latitude.values]
            lons = [float(x) for x in sub_u.longitude.values]

            u_slices = []
            v_slices = []

            for req_d, act_d in zip(depths, actual_depths):
                # Slice u
                arr_u = sub_u.sel(depth=act_d).values.squeeze()
                val_u = ~np.isnan(arr_u)
                has_u = np.any(val_u)
                arr_u_clean = np.where(val_u, arr_u, None)
                min_u = float(np.amin(arr_u[val_u])) if has_u else -3.0
                max_u = float(np.amax(arr_u[val_u])) if has_u else 3.0

                u_slices.append({
                    "depth": act_d,
                    "requested_depth": req_d,
                    "actual_depth": act_d,
                    "values": arr_u_clean.tolist(),
                    "min_value": min_u,
                    "max_value": max_u,
                })

                # Slice v
                arr_v = sub_v.sel(depth=act_d).values.squeeze()
                val_v = ~np.isnan(arr_v)
                has_v = np.any(val_v)
                arr_v_clean = np.where(val_v, arr_v, None)
                min_v = float(np.amin(arr_v[val_v])) if has_v else -3.0
                max_v = float(np.amax(arr_v[val_v])) if has_v else 3.0

                v_slices.append({
                    "depth": act_d,
                    "requested_depth": req_d,
                    "actual_depth": act_d,
                    "values": arr_v_clean.tolist(),
                    "min_value": min_v,
                    "max_value": max_v,
                })

            return {
                "variable": "currents",
                "time": target_date,
                "depths": actual_depths,
                "requested_depths": depths,
                "lat_min": float(min(lats)) if lats else lat_min,
                "lat_max": float(max(lats)) if lats else lat_max,
                "lon_min": float(min(lons)) if lons else lon_min,
                "lon_max": float(max(lons)) if lons else lon_max,
                "width": len(lons),
                "height": len(lats),
                "latitudes": lats,
                "longitudes": lons,
                "unit": unit,
                "slices": [],
                "u_slices": u_slices,
                "v_slices": v_slices,
            }

        else:
            # Scalar variable: temperature, salinity, chlorophyll, etc.
            sub_var = ds[nc_var].sel(depth=unique_actual_depths, latitude=lat_slice, longitude=lon_slice)
            if stride > 1:
                sub_var = sub_var.isel(latitude=slice(None, None, stride), longitude=slice(None, None, stride))
            if "time" in sub_var.dims:
                sub_var = sub_var.squeeze("time")

            lats = [float(x) for x in sub_var.latitude.values]
            lons = [float(x) for x in sub_var.longitude.values]

            slices = []
            for req_d, act_d in zip(depths, actual_depths):
                arr = sub_var.sel(depth=act_d).values.squeeze()
                val_mask = ~np.isnan(arr)
                has_val = np.any(val_mask)
                arr_clean = np.where(val_mask, arr, None)
                min_val = float(np.amin(arr[val_mask])) if has_val else min_fallback
                max_val = float(np.amax(arr[val_mask])) if has_val else max_fallback

                slices.append({
                    "depth": act_d,
                    "requested_depth": req_d,
                    "actual_depth": act_d,
                    "values": arr_clean.tolist(),
                    "min_value": min_val,
                    "max_value": max_val,
                })

            return {
                "variable": variable,
                "time": target_date,
                "depths": actual_depths,
                "requested_depths": depths,
                "lat_min": float(min(lats)) if lats else lat_min,
                "lat_max": float(max(lats)) if lats else lat_max,
                "lon_min": float(min(lons)) if lons else lon_min,
                "lon_max": float(max(lons)) if lons else lon_max,
                "width": len(lons),
                "height": len(lats),
                "latitudes": lats,
                "longitudes": lons,
                "unit": unit,
                "slices": slices,
                "u_slices": None,
                "v_slices": None,
            }

    def close(self) -> None:
        """Close all open dataset handles upon shutdown."""
        self._dataset_cache.close_all()


# Register with central adapter registry
adapter_registry.register_model_adapter("cmems", CMEMSModelAdapter)
adapter_registry.register_model_adapter("cmems-physics-bgc", CMEMSModelAdapter)
adapter_registry.register_model_adapter("cmems-daily", CMEMSModelAdapter)


