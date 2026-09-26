"""
backend/services/comparison_service.py
--------------------------------------
Scientifically rigorous comparison service between numerical ocean model outputs (CMEMS)
and real in-situ vertical observation soundings (NOAA/WOD Argo floats, gliders, CTD, BGC).
Calculates exact spatial, depth, and temporal matching, individual layer residuals,
and statistical error distributions without data fabrication.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

import numpy as np

from backend.services.model_service import ModelService
from backend.services.observation_service import ObservationService

log = logging.getLogger("sagarnetra.comparison")

# Mapping of standard variable keys to model NC variable names, units, and ranges
VARIABLE_META = {
    "temperature": {"nc_var": "thetao", "sub_dir": "copernicus_daily", "unit": "°C", "label": "Temperature"},
    "salinity": {"nc_var": "so", "sub_dir": "copernicus_daily", "unit": "PSU", "label": "Salinity"},
    "chlorophyll": {"nc_var": "chl", "sub_dir": "copernicus_chlorophyll_daily", "unit": "mg/m³", "label": "Chlorophyll"},
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points on Earth in kilometers."""
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * R * math.asin(math.sqrt(max(0.0, min(1.0, a))))


class ModelObservationComparisonService:
    """
    Service executing point-to-profile and layer-to-layer comparisons
    between gridded 3D model simulations and depth-resolved in-situ observations.
    """

    def __init__(self, model_service: ModelService, obs_service: ObservationService):
        self.model_service = model_service
        self.obs_service = obs_service

    def get_supported_variables(self, obs_variables: list[str]) -> list[dict[str, str]]:
        """Filter variables that actually exist in both observation sounding and numerical model."""
        obs_vars_lower = {v.lower() for v in obs_variables}
        supported = []
        for var_key, meta in VARIABLE_META.items():
            if var_key in obs_vars_lower:
                supported.append({
                    "id": var_key,
                    "label": meta["label"],
                    "unit": meta["unit"],
                    "nc_variable": meta["nc_var"],
                })
        return supported

    def compare_profile(
        self,
        obs_id: str,
        variable: str = "temperature",
        model_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compare an in-situ observation sounding with numerical model output.
        Matches nearest spatial grid point, depth level, and time slice.
        Computes residual = Observation - Model for every sounding layer.
        """
        var_key = variable.lower().strip()
        if var_key not in VARIABLE_META:
            raise ValueError(f"Variable '{variable}' is not supported for comparison. Choose from: {list(VARIABLE_META.keys())}")

        var_info = VARIABLE_META[var_key]
        nc_var = var_info["nc_var"]

        # 1. Fetch real observation profile
        prof = self.obs_service.get_profile(obs_id)
        if not prof:
            raise ValueError(f"Observation profile for ID '{obs_id}' was not found.")

        obs_lat = prof["latitude"]
        obs_lon = prof["longitude"]
        obs_time = prof.get("timestamp")
        obs_data = prof.get("data", [])
        obs_vars = [v.lower() for v in prof.get("variables", [])]

        if not obs_data:
            raise ValueError(f"No vertical sounding measurements available for observation '{obs_id}'.")

        if var_key not in obs_vars:
            raise ValueError(
                f"Variable '{var_info['label']}' was not measured by observation '{obs_id}'. "
                f"Measured variables: {', '.join(prof.get('variables', []))}"
            )

        # 2. Check spatial model coverage bounds (CMEMS domain: [-35, 30] Lat, [40, 100] Lon)
        if not (-35.0 <= obs_lat <= 30.0 and 40.0 <= obs_lon <= 100.0):
            return {
                "status": "out_of_bounds",
                "message": (
                    f"Observation ({obs_lat:.2f}°, {obs_lon:.2f}°) lies outside "
                    "numerical model domain coverage (-35°S–30°N, 40°E–100°E)."
                ),
                "observation": {
                    "id": prof["id"],
                    "type": prof["type"],
                    "platform_id": prof.get("platform_id"),
                    "latitude": obs_lat,
                    "longitude": obs_lon,
                    "timestamp": obs_time,
                    "source": prof.get("source"),
                },
                "variable": var_key,
                "comparison": None,
            }

        # 3. Model Adapter access (CMEMS)
        adapter = getattr(self.model_service, "adapter", None)
        if not adapter or not hasattr(adapter, "_dataset_cache"):
            raise RuntimeError("Model adapter does not support cached point sounding queries.")

        # Determine target model date
        avail_dates = adapter.get_available_times()
        if not avail_dates:
            raise RuntimeError("No model simulation timesteps available.")

        if model_date and model_date in avail_dates:
            target_date = model_date
        elif obs_time:
            try:
                obs_dt = np.datetime64(obs_time[:10])
                target_date = min(avail_dates, key=lambda d: abs(np.datetime64(d) - obs_dt))
            except Exception:
                target_date = avail_dates[0]
        else:
            target_date = avail_dates[0]

        if hasattr(adapter, "get_file_for_variable"):
            file_path = adapter.get_file_for_variable(nc_var, target_date)
        else:
            file_map = getattr(adapter, "_date_to_phy_file", {}) if var_key != "chlorophyll" else getattr(adapter, "_date_to_bgc_file", {})
            if target_date not in file_map:
                raise FileNotFoundError(f"Model NetCDF slice file not mapped for date {target_date}")
            file_path = file_map[target_date]

        ds = adapter._dataset_cache.get(file_path)

        if nc_var not in ds:
            raise ValueError(f"Variable '{nc_var}' not found in model dataset for date {target_date}")

        # 4. Extract 1D vertical sounding at nearest spatial grid point
        point_ds = ds[nc_var].sel(latitude=obs_lat, longitude=obs_lon, method="nearest").squeeze()

        nearest_lat = float(point_ds.latitude.values)
        nearest_lon = float(point_ds.longitude.values)
        dist_km = haversine_distance_km(obs_lat, obs_lon, nearest_lat, nearest_lon)

        model_depths = np.array([float(d) for d in point_ds.depth.values])
        raw_model_vals = point_ds.values
        if hasattr(raw_model_vals, "compute"):
            raw_model_vals = raw_model_vals.compute()
        model_vals = np.asarray(raw_model_vals, dtype=np.float64)

        # Full model profile curve across all standard depth levels
        model_full_profile = []
        for d, v in zip(model_depths, model_vals):
            if not np.isnan(v):
                model_full_profile.append({"depth": round(float(d), 2), "value": round(float(v), 4)})

        # 5. Layer-by-layer matching and residual calculation
        # Residual = Observation - Model
        matched_points = []
        residuals = []
        abs_errors = []

        for pt in obs_data:
            z_obs = pt.get("depth")
            if z_obs is None or np.isnan(z_obs):
                continue
            v_obs = pt.get(var_key)
            if v_obs is None or np.isnan(v_obs):
                continue

            # Find nearest model depth level
            nearest_d_idx = int(np.argmin(np.abs(model_depths - z_obs)))
            z_model = float(model_depths[nearest_d_idx])
            v_model = float(model_vals[nearest_d_idx])

            if np.isnan(v_model):
                continue

            residual = float(v_obs - v_model)
            abs_err = abs(residual)
            depth_diff = abs(z_obs - z_model)

            residuals.append(residual)
            abs_errors.append(abs_err)

            matched_points.append({
                "depth": round(float(z_obs), 2),
                "obs_value": round(float(v_obs), 4),
                "model_value": round(float(v_model), 4),
                "residual": round(residual, 4),
                "abs_error": round(abs_err, 4),
                "model_depth": round(z_model, 2),
                "depth_diff": round(depth_diff, 2),
            })

        # 6. Compute summary descriptive statistics
        if matched_points:
            mean_res = float(np.mean(residuals))
            mae = float(np.mean(abs_errors))
            rmsd = float(np.sqrt(np.mean(np.square(residuals))))
            min_res = float(np.min(residuals))
            max_res = float(np.max(residuals))
        else:
            mean_res, mae, rmsd, min_res, max_res = None, None, None, None, None

        # Compute time difference in days
        time_diff_days = None
        if obs_time:
            try:
                obs_dt = np.datetime64(obs_time[:10])
                mod_dt = np.datetime64(target_date)
                time_diff_days = int((mod_dt - obs_dt) / np.timedelta64(1, "D"))
            except Exception:
                time_diff_days = None

        return {
            "status": "success",
            "observation": {
                "id": prof["id"],
                "type": prof["type"],
                "platform_id": prof.get("platform_id"),
                "latitude": round(obs_lat, 4),
                "longitude": round(obs_lon, 4),
                "timestamp": obs_time,
                "max_depth": prof.get("max_depth"),
                "source": prof.get("source"),
            },
            "model_match": {
                "dataset": "CMEMS Global Ocean Physical & Biogeochemical Daily Archive",
                "nearest_latitude": round(nearest_lat, 4),
                "nearest_longitude": round(nearest_lon, 4),
                "spatial_distance_km": round(dist_km, 2),
                "model_date": target_date,
                "obs_date": obs_time,
                "time_difference_days": time_diff_days,
                "variable": var_key,
                "nc_variable": nc_var,
                "unit": var_info["unit"],
                "label": var_info["label"],
            },
            "metrics": {
                "valid_points_count": len(matched_points),
                "mean_residual": round(mean_res, 4) if mean_res is not None else None,
                "mean_absolute_error": round(mae, 4) if mae is not None else None,
                "root_mean_square_difference": round(rmsd, 4) if rmsd is not None else None,
                "min_residual": round(min_res, 4) if min_res is not None else None,
                "max_residual": round(max_res, 4) if max_res is not None else None,
                "formula": "Residual = Observation - Model",
            },
            "supported_variables": self.get_supported_variables(prof.get("variables", [])),
            "profile_comparison": matched_points,
            "model_full_profile": model_full_profile,
        }
