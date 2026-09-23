from __future__ import annotations

import logging
from pathlib import Path
import threading
from typing import Any, Optional
import netCDF4
import numpy as np

from backend.adapters.base import BaseObservationAdapter
from backend.registry.adapters import adapter_registry

log = logging.getLogger(__name__)

class CastProfileSpan:
    """
    Lightweight in-memory record of pre-computed ragged-array offsets and counts
    for a single observation cast. Eliminates repeated disk scanning and np.sum() loops.
    """
    __slots__ = (
        "dtype",
        "file_type",
        "cast_id",
        "latitude",
        "longitude",
        "timestamp",
        "z_start",
        "z_count",
        "var_spans",
    )

    def __init__(
        self,
        dtype: str,
        file_type: str,
        cast_id: int,
        latitude: float,
        longitude: float,
        timestamp: Optional[str],
        z_start: int,
        z_count: int,
        var_spans: dict[str, tuple[int, int]],
    ):
        self.dtype = dtype
        self.file_type = file_type
        self.cast_id = cast_id
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = timestamp
        self.z_start = z_start
        self.z_count = z_count
        self.var_spans = var_spans

def _to_float(val: Any) -> Optional[float]:
    if val is None or np.ma.is_masked(val):
        return None
    try:
        f = float(val)
        return None if np.isnan(f) else f
    except (ValueError, TypeError):
        return None

def _format_date(d_val: Any) -> Optional[str]:
    if d_val is None or np.ma.is_masked(d_val):
        return None
    try:
        s = str(int(d_val))
        if len(s) == 8:
            return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
        return s
    except (ValueError, TypeError):
        return None

class WODObservationAdapter(BaseObservationAdapter):
    """
    High-performance indexed adapter for NOAA/WOD Discrete Sampling Geometries (DSG)
    Ragged Array NetCDF files:
      - Argo Floats (PFL)
      - Gliders (GLD)
      - Shipboard CTD (CTD)
      - Genuine Biogeochemical (BGC) Profiles
    """

    @property
    def dataset_id(self) -> str:
        return "wod-in-situ-profiles"

    def fetch_metadata(self) -> dict[str, Any]:
        return {
            "id": self.dataset_id,
            "name": "World Ocean Database 2023 In-Situ Profile Archive",
            "source": "NOAA / NCEI",
            "platform_counts": self.get_counts(),
            "supported_types": ["argo", "glider", "ctd", "bgc"],
            "variables": ["temperature", "salinity", "chlorophyll", "oxygen", "nitrate", "ph"],
        }

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.argo_path = data_dir / "argo" / "ocldb1788270080.21439_PFL.nc"
        self.glider_path = data_dir / "glider" / "ocldb1788270080.21439_GLD.nc"
        self.ctd_path = data_dir / "ctd" / "ocldb1788270080.21439_CTD.nc"
        
        self._file_map = {
            "argo": self.argo_path,
            "glider": self.glider_path,
            "ctd": self.ctd_path,
        }

        self._index_cache: dict[str, list[dict[str, Any]]] = {}
        self._counts_by_type: dict[str, int] = {}
        self._profile_index: dict[str, CastProfileSpan] = {}
        self._open_datasets: dict[str, netCDF4.Dataset] = {}
        self._lock = threading.Lock()
        self._build_index()

    def _build_index(self) -> None:
        """
        Extract lightweight cast index and pre-compute cumulative ragged-array
        offsets for all variables in memory once at startup.
        """
        datasets = [
            ("argo", self.argo_path),
            ("glider", self.glider_path),
            ("ctd", self.ctd_path),
        ]

        var_mappings = [
            ("temperature", "Temperature"),
            ("salinity", "Salinity"),
            ("chlorophyll", "Chlorophyll"),
            ("oxygen", "Oxygen"),
            ("nitrate", "Nitrate"),
            ("ph", "pH"),
        ]

        bgc_records = []

        for dtype, path in datasets:
            if not path.exists():
                self._index_cache[dtype] = []
                self._counts_by_type[dtype] = 0
                continue

            try:
                nc = netCDF4.Dataset(str(path), "r")
                self._open_datasets[dtype] = nc

                cast_ids = nc.variables["wod_unique_cast"][:]
                n_casts = len(cast_ids)
                lats = nc.variables["lat"][:]
                lons = nc.variables["lon"][:]
                dates = nc.variables["date"][:] if "date" in nc.variables else [None] * n_casts

                # 1. Pre-compute depth (z) cumulative offsets via np.cumsum
                z_sizes_raw = nc.variables["z_row_size"][:] if "z_row_size" in nc.variables else np.zeros(n_casts)
                z_sizes = np.ma.filled(z_sizes_raw, 0).astype(np.int64)
                z_offsets = np.empty(n_casts + 1, dtype=np.int64)
                z_offsets[0] = 0
                np.cumsum(z_sizes, out=z_offsets[1:])

                # 2. Pre-compute per-variable cumulative offsets independently
                # Each sensor variable maintains its own disparate ragged-array row size.
                var_offsets_dict: dict[str, np.ndarray] = {}
                var_sizes_dict: dict[str, np.ndarray] = {}

                for v_key, nc_var in var_mappings:
                    rs_name = f"{nc_var}_row_size"
                    if nc_var in nc.variables and rs_name in nc.variables:
                        v_sizes_raw = nc.variables[rs_name][:]
                        v_sizes = np.ma.filled(v_sizes_raw, 0).astype(np.int64)
                        v_offsets = np.empty(n_casts + 1, dtype=np.int64)
                        v_offsets[0] = 0
                        np.cumsum(v_sizes, out=v_offsets[1:])
                        var_offsets_dict[v_key] = v_offsets
                        var_sizes_dict[v_key] = v_sizes

                records = []
                for i in range(n_casts):
                    cid = int(cast_ids[i])
                    d_str = _format_date(dates[i])
                    lat = float(lats[i])
                    lon = float(lons[i])
                    z_start = int(z_offsets[i])
                    z_count = int(z_sizes[i])

                    # Build independent variable spans for this cast
                    var_spans: dict[str, tuple[int, int]] = {}
                    var_names = []
                    is_bgc_cast = False

                    for v_key, _ in var_mappings:
                        if v_key in var_sizes_dict:
                            cnt = int(var_sizes_dict[v_key][i])
                            if cnt > 0:
                                start = int(var_offsets_dict[v_key][i])
                                var_spans[v_key] = (start, cnt)
                                var_names.append(v_key)
                                if v_key in ["chlorophyll", "oxygen", "nitrate", "ph"]:
                                    is_bgc_cast = True

                    rec = {
                        "id": f"{dtype}_{cid}",
                        "cast_id": cid,
                        "type": dtype,
                        "platform_id": str(cid),
                        "latitude": lat,
                        "longitude": lon,
                        "timestamp": d_str,
                        "variables": var_names,
                        "source": "NOAA / NCEI World Ocean Database",
                    }
                    records.append(rec)

                    # Store precomputed span in index for O(1) profile retrieval
                    span = CastProfileSpan(
                        dtype=dtype,
                        file_type=dtype,
                        cast_id=cid,
                        latitude=lat,
                        longitude=lon,
                        timestamp=d_str,
                        z_start=z_start,
                        z_count=z_count,
                        var_spans=var_spans,
                    )
                    self._profile_index[f"{dtype}_{cid}"] = span
                    if str(cid) not in self._profile_index:
                        self._profile_index[str(cid)] = span

                    # If this cast is equipped with genuine BGC sensors, index in bgc pool
                    if is_bgc_cast and dtype == "argo":
                        bgc_rec = dict(rec)
                        bgc_rec["id"] = f"bgc_{cid}"
                        bgc_rec["type"] = "bgc"
                        bgc_records.append(bgc_rec)

                        bgc_span = CastProfileSpan(
                            dtype="bgc",
                            file_type=dtype,
                            cast_id=cid,
                            latitude=lat,
                            longitude=lon,
                            timestamp=d_str,
                            z_start=z_start,
                            z_count=z_count,
                            var_spans=var_spans,
                        )
                        self._profile_index[f"bgc_{cid}"] = bgc_span

                self._index_cache[dtype] = records
                self._counts_by_type[dtype] = len(records)
                log.info(f"Indexed {len(records)} {dtype.upper()} casts from {path.name}")
            except Exception as e:
                log.error(f"Error indexing {dtype} from {path}: {e}")
                self._index_cache[dtype] = []
                self._counts_by_type[dtype] = 0

        # Dedicated BGC-equipped profiling float records
        self._index_cache["bgc"] = bgc_records
        self._counts_by_type["bgc"] = len(bgc_records)
        log.info(f"Indexed {len(bgc_records)} genuine BGC casts with biochemical sensors")

    def get_counts(self) -> dict[str, int]:
        return self._counts_by_type

    def get_observations(
        self,
        obs_type: Optional[str] = "all",
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 2000,
    ) -> list[dict[str, Any]]:
        """
        Query observations with balanced quota sampling across all platforms
        when obs_type is 'all'.
        """
        target_types = (
            ["argo", "glider", "ctd", "bgc"]
            if (not obs_type or obs_type.lower() == "all")
            else [obs_type.lower()]
        )

        # Step 1: Filter each requested observation type by geographic bounding box
        filtered_by_type: dict[str, list[dict[str, Any]]] = {}
        for t in target_types:
            pool = self._index_cache.get(t, [])
            matched = []
            for r in pool:
                if lat_min is not None and r["latitude"] < lat_min:
                    continue
                if lat_max is not None and r["latitude"] > lat_max:
                    continue
                if lon_min is not None and r["longitude"] < lon_min:
                    continue
                if lon_max is not None and r["longitude"] > lon_max:
                    continue
                matched.append(r)
            filtered_by_type[t] = matched

        # If single observation type requested, slice to limit directly
        if len(target_types) == 1:
            return filtered_by_type[target_types[0]][:limit]

        # Step 2: Balanced quota distribution algorithm with rollover for smaller pools
        available_counts = {t: len(filtered_by_type[t]) for t in target_types}
        total_available = sum(available_counts.values())

        if total_available <= limit:
            results = []
            for t in target_types:
                results.extend(filtered_by_type[t])
            return results

        # Compute fair share with quota redistribution for smaller pools
        allocated_quotas = {t: 0 for t in target_types}
        remaining_limit = limit
        active_types = [t for t in target_types if available_counts[t] > 0]

        while remaining_limit > 0 and active_types:
            base_quota = remaining_limit // len(active_types)
            remainder = remaining_limit % len(active_types)
            if base_quota == 0 and remainder > 0:
                base_quota = 1

            next_active = []
            for idx, t in enumerate(active_types):
                extra = 1 if idx < remainder else 0
                take = min(available_counts[t] - allocated_quotas[t], base_quota + extra)
                if take > 0:
                    allocated_quotas[t] += take
                    remaining_limit -= take
                if allocated_quotas[t] < available_counts[t]:
                    next_active.append(t)

            if len(next_active) == len(active_types) and all(base_quota == 0 for _ in next_active):
                break
            active_types = next_active

        # Step 3: Collect balanced samples from each type pool
        results = []
        for t in target_types:
            q = allocated_quotas[t]
            if q > 0:
                results.extend(filtered_by_type[t][:q])

        return results

    def get_profile(self, obs_id: str) -> Optional[dict[str, Any]]:
        """
        Extract depth-resolved vertical profile for a specific observation ID.
        Uses pre-computed cumulative offsets (O(1) dictionary lookup) to read
        only the exact ragged-array slices from disk.
        Supports both prefixed IDs ('argo_20059500', 'bgc_19770878') and raw numeric IDs ('20059500').
        """
        span = self._profile_index.get(obs_id)
        if not span:
            obs_id_clean = obs_id.strip()
            span = self._profile_index.get(obs_id_clean) or self._profile_index.get(obs_id_clean.lower())
            if not span and "_" in obs_id_clean:
                parts = obs_id_clean.split("_")
                span = self._profile_index.get(f"{parts[0].lower()}_{parts[1]}")
            elif not span:
                span = self._profile_index.get(obs_id_clean)

        if not span or span.z_count <= 0:
            return None

        var_mappings = [
            ("temperature", "Temperature"),
            ("salinity", "Salinity"),
            ("chlorophyll", "Chlorophyll"),
            ("oxygen", "Oxygen"),
            ("nitrate", "Nitrate"),
            ("ph", "pH"),
        ]

        with self._lock:
            nc = self._open_datasets.get(span.file_type)
            if nc is None:
                path = self._file_map.get(span.file_type)
                if not path or not path.exists():
                    return None
                nc = netCDF4.Dataset(str(path), "r")
                self._open_datasets[span.file_type] = nc

            try:
                depths = nc.variables["z"][span.z_start : span.z_start + span.z_count]

                var_slices: dict[str, Any] = {}
                for v_key, nc_var in var_mappings:
                    if v_key in span.var_spans:
                        v_start, v_count = span.var_spans[v_key]
                        var_slices[v_key] = nc.variables[nc_var][v_start : v_start + v_count]
                    else:
                        var_slices[v_key] = None

                profile_points = []
                for i in range(span.z_count):
                    d_val = _to_float(depths[i])
                    if d_val is None:
                        continue

                    pt = {"depth": d_val}
                    for v_key in ["temperature", "salinity", "chlorophyll", "oxygen", "nitrate", "ph"]:
                        vals = var_slices.get(v_key)
                        pt[v_key] = _to_float(vals[i]) if (vals is not None and i < len(vals)) else None
                    profile_points.append(pt)

                valid_depths = [p["depth"] for p in profile_points]
                max_d = float(max(valid_depths)) if valid_depths else 0.0
                active_vars = [
                    k for k in ["temperature", "salinity", "chlorophyll", "oxygen", "nitrate", "ph"]
                    if any(p.get(k) is not None for p in profile_points)
                ]

                return {
                    "id": f"{span.dtype}_{span.cast_id}",
                    "type": span.dtype,
                    "platform_id": str(span.cast_id),
                    "timestamp": span.timestamp,
                    "latitude": span.latitude,
                    "longitude": span.longitude,
                    "max_depth": max_d,
                    "variables": active_vars,
                    "source": "NOAA / NCEI World Ocean Database",
                    "data": profile_points,
                }
            except Exception as e:
                log.error(f"Error reading profile {obs_id}: {e}")
                return None

    def close(self) -> None:
        """Close open NetCDF file handles cleanly upon application shutdown."""
        with self._lock:
            for ftype, nc in list(self._open_datasets.items()):
                try:
                    nc.close()
                except Exception as e:
                    log.warning("Error closing WOD dataset %s: %s", ftype, e)
            self._open_datasets.clear()


# Register with central adapter registry
adapter_registry.register_observation_adapter("wod", WODObservationAdapter)
adapter_registry.register_observation_adapter("wod-argo", WODObservationAdapter)
adapter_registry.register_observation_adapter("wod-glider", WODObservationAdapter)
adapter_registry.register_observation_adapter("wod-ctd", WODObservationAdapter)


