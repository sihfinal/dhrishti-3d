"""
backend/adapters/delimited_text.py
----------------------------------
High-performance, scientific delimited-text observation adapter for SagarDrishti-3D.

Supports:
  - CSV, TSV, semicolon-delimited, pipe-delimited, and whitespace-delimited ASCII files.
  - Automatic delimiter detection and header inspection with comprehensive column alias matching.
  - Variable normalization via VariableRegistry (temperature, salinity, chlorophyll, currents, etc.).
  - Observation type detection via ObservationTypeRegistry (argo, glider, ctd, bgc).
  - Scientific validation of geographical coordinates (-90..90 lat, -180..180 lon), depth, and timestamps.
  - Structured ValidationReport generation (VALID, PARTIALLY_VALID, REJECTED).
  - Normalization into UnifiedObservation and UnifiedProfilePoint data models.
  - Implements BaseObservationAdapter and registers with AdapterRegistry.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import datetime, timezone
import io
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.adapters.base import BaseObservationAdapter
from backend.registry.adapters import adapter_registry
from backend.registry.observation_types import observation_type_registry
from backend.registry.variables import variable_registry
from backend.schemas.unified import UnifiedObservation, UnifiedProfilePoint

log = logging.getLogger(__name__)


# ── Column Alias Dictionaries ──────────────────────────────────────────────────
LAT_ALIASES = {
    "latitude", "lat", "lat_deg", "lat_degrees", "y", "latitude_deg_north",
    "latitude_degrees_north", "lat_deg_north", "latitude_degrees", "lat_d",
}
LON_ALIASES = {
    "longitude", "lon", "lon_deg", "lon_degrees", "lng", "lng_deg", "long",
    "long_deg", "x", "longitude_deg_east", "longitude_degrees_east", "lon_deg_east",
    "longitude_degrees", "lon_d",
}
TIME_ALIASES = {"time", "date", "datetime", "timestamp", "obs_time", "date_time", "iso_time", "observation_time", "utc_time"}
DEPTH_ALIASES = {"depth", "depth_m", "z", "depth_metres", "depth_meters", "pressure", "pres", "pres_dbar"}
ID_ALIASES = {"id", "platform_id", "station", "station_id", "cast_id", "profile_id", "wmo", "wmo_id", "platform", "float_id"}
TYPE_ALIASES = {"type", "obs_type", "platform_type", "instrument", "sensor", "platform_category"}
QC_ALIASES = {"qc", "quality_control", "qc_flag", "flag"}


@dataclass
class ValidationReport:
    """Structured scientific validation summary for an ingested text file."""
    file_name: str
    format: str
    delimiter: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    detected_columns: List[str]
    detected_variables: List[str]
    source: str
    observation_type: str
    status: str  # "VALID", "PARTIALLY_VALID", "REJECTED"
    time_range: Optional[Tuple[str, str]] = None
    spatial_range: Optional[Dict[str, Tuple[float, float]]] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def _sniff_delimiter(first_few_lines: str) -> str:
    """Infer file delimiter by analyzing candidate frequency and sniffer."""
    lines = [l.strip() for l in first_few_lines.splitlines() if l.strip() and not l.strip().startswith(("#", "//"))]
    if not lines:
        return ","

    candidates = [",", "\t", ";", "|"]

    # 1. Frequency analysis across header and sample rows
    first_line = lines[0]
    counts = {c: first_line.count(c) for c in candidates}
    best_cand = max(counts, key=counts.get)
    if counts[best_cand] > 0:
        return best_cand

    # 2. Sniffer fallback
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(first_few_lines, delimiters=",\t;|")
        if dialect.delimiter in candidates:
            return dialect.delimiter
    except Exception:
        pass

    return ","


def _parse_timestamp(val: Any) -> Optional[str]:
    """Parse various datetime representations into ISO-8601 string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None

    # Handle numeric timestamp (e.g. YYYYMMDD integer)
    if s.isdigit() and len(s) == 8:
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"

    # Common standard datetime formats
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%Y%m%d%H%M%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if fmt != "%Y-%m-%d" else dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Return raw cleaned string if ISO-like
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s
    return None


class DelimitedTextObservationAdapter(BaseObservationAdapter):
    """
    Adapter for in-situ tabular ocean observation text datasets (CSV, TSV, ASCII).
    Validates physical parameters, normalizes column aliases, and builds depth-resolved profiles.
    """

    def __init__(
        self,
        file_path: Path | str,
        dataset_id: Optional[str] = None,
        source_name: str = "Delimited In-Situ Text Ingest",
        default_obs_type: str = "ctd",
        delimiter: Optional[str] = None,
    ):
        self.file_path = Path(file_path)
        self._dataset_id = dataset_id or f"text-{self.file_path.stem.lower()}"
        self._source_name = source_name
        self._default_obs_type = default_obs_type
        self._custom_delimiter = delimiter

        self._observations: List[Dict[str, Any]] = []
        self._profiles: Dict[str, Dict[str, Any]] = []
        self._counts: Dict[str, int] = {}
        self._validation_report: Optional[ValidationReport] = None
        self._load_and_validate()

    @property
    def dataset_id(self) -> str:
        return self._dataset_id

    @property
    def validation_report(self) -> Optional[ValidationReport]:
        return self._validation_report

    def fetch_metadata(self) -> Dict[str, Any]:
        return {
            "id": self._dataset_id,
            "name": f"Delimited Text Ingest ({self.file_path.name})",
            "source": self._source_name,
            "format": "Delimited Text (CSV/TSV/ASCII)",
            "file_path": str(self.file_path),
            "platform_counts": self.get_counts(),
            "variables": self._validation_report.detected_variables if self._validation_report else [],
            "validation_status": self._validation_report.status if self._validation_report else "UNKNOWN",
            "total_records": len(self._observations),
        }

    def get_counts(self) -> Dict[str, int]:
        return dict(self._counts)

    def get_observations(
        self,
        obs_type: Optional[str] = "all",
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 2000,
    ) -> List[Dict[str, Any]]:
        results = []
        target_type = (obs_type or "all").lower().strip()

        for obs in self._observations:
            if target_type != "all" and obs.get("type", "").lower() != target_type:
                continue

            lat = obs.get("latitude", 0.0)
            lon = obs.get("longitude", 0.0)

            if lat_min is not None and lat < lat_min:
                continue
            if lat_max is not None and lat > lat_max:
                continue
            if lon_min is not None and lon < lon_min:
                continue
            if lon_max is not None and lon > lon_max:
                continue

            results.append(obs)
            if len(results) >= limit:
                break

        return results

    def get_profile(self, obs_id: str) -> Optional[Dict[str, Any]]:
        return self._profiles.get(obs_id)

    def _load_and_validate(self) -> None:
        """Parse, validate, and normalize records into observations and profiles."""
        if not self.file_path.exists():
            self._validation_report = ValidationReport(
                file_name=self.file_path.name,
                format="UNKNOWN",
                delimiter=",",
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                detected_columns=[],
                detected_variables=[],
                source=self._source_name,
                observation_type=self._default_obs_type,
                status="REJECTED",
                errors=[f"File not found at path '{self.file_path}'"],
            )
            return

        try:
            with open(self.file_path, "r", encoding="utf-8-sig", errors="replace") as f:
                content = f.read()
        except Exception as e:
            self._validation_report = ValidationReport(
                file_name=self.file_path.name,
                format="UNKNOWN",
                delimiter=",",
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                detected_columns=[],
                detected_variables=[],
                source=self._source_name,
                observation_type=self._default_obs_type,
                status="REJECTED",
                errors=[f"Failed to read file: {e}"],
            )
            return

        lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith(("#", "//"))]
        if not lines:
            self._validation_report = ValidationReport(
                file_name=self.file_path.name,
                format="EMPTY",
                delimiter=",",
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                detected_columns=[],
                detected_variables=[],
                source=self._source_name,
                observation_type=self._default_obs_type,
                status="REJECTED",
                errors=["File is empty or contains only comments"],
            )
            return

        # Determine delimiter
        sample_text = "\n".join(lines[:10])
        delimiter = self._custom_delimiter or _sniff_delimiter(sample_text)
        fmt_name = "TSV" if delimiter == "\t" else ("CSV" if delimiter == "," else "ASCII-Delimited")

        reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter)
        raw_rows = list(reader)
        if not raw_rows:
            return

        header = [col.strip().lower() for col in raw_rows[0]]
        detected_columns = list(raw_rows[0])

        # Map column indices
        lat_idx: Optional[int] = None
        lon_idx: Optional[int] = None
        time_idx: Optional[int] = None
        depth_idx: Optional[int] = None
        id_idx: Optional[int] = None
        type_idx: Optional[int] = None
        qc_idx: Optional[int] = None
        var_indices: Dict[str, int] = {}  # canonical_var_id -> column index

        for i, col in enumerate(header):
            clean_col = col.replace(" ", "_").replace("-", "_")
            if clean_col in LAT_ALIASES and lat_idx is None:
                lat_idx = i
            elif clean_col in LON_ALIASES and lon_idx is None:
                lon_idx = i
            elif clean_col in TIME_ALIASES and time_idx is None:
                time_idx = i
            elif clean_col in DEPTH_ALIASES and depth_idx is None:
                depth_idx = i
            elif clean_col in ID_ALIASES and id_idx is None:
                id_idx = i
            elif clean_col in TYPE_ALIASES and type_idx is None:
                type_idx = i
            elif clean_col in QC_ALIASES and qc_idx is None:
                qc_idx = i
            else:
                # Check with VariableRegistry
                var_def = variable_registry.get(clean_col)
                if var_def is not None:
                    var_indices[var_def.id] = i

        errors = []
        warnings = []

        if lat_idx is None:
            errors.append("Missing mandatory latitude column (expected 'latitude', 'lat', etc.)")
        if lon_idx is None:
            errors.append("Missing mandatory longitude column (expected 'longitude', 'lon', etc.)")

        if errors:
            self._validation_report = ValidationReport(
                file_name=self.file_path.name,
                format=fmt_name,
                delimiter=delimiter,
                total_rows=len(raw_rows) - 1,
                valid_rows=0,
                invalid_rows=len(raw_rows) - 1,
                detected_columns=detected_columns,
                detected_variables=list(var_indices.keys()),
                source=self._source_name,
                observation_type=self._default_obs_type,
                status="REJECTED",
                errors=errors,
            )
            return

        valid_rows_count = 0
        invalid_rows_count = 0
        lats: List[float] = []
        lons: List[float] = []
        times: List[str] = []

        # Map to group row soundings by profile/platform ID or lat/lon
        grouped_profiles: Dict[str, Dict[str, Any]] = {}

        for row_num, row in enumerate(raw_rows[1:], start=2):
            if not row or all(c.strip() == "" for c in row):
                continue

            try:
                # 1. Parse Latitude
                lat_str = row[lat_idx] if lat_idx < len(row) else ""
                lat_val = float(lat_str.strip())
                if not (-90.0 <= lat_val <= 90.0):
                    invalid_rows_count += 1
                    if len(warnings) < 10:
                        warnings.append(f"Row {row_num}: Latitude {lat_val} out of bounds [-90, +90]")
                    continue

                # 2. Parse Longitude
                lon_str = row[lon_idx] if lon_idx < len(row) else ""
                lon_val = float(lon_str.strip())
                if not (-180.0 <= lon_val <= 180.0):
                    invalid_rows_count += 1
                    if len(warnings) < 10:
                        warnings.append(f"Row {row_num}: Longitude {lon_val} out of bounds [-180, +180]")
                    continue

                # 3. Parse Depth
                depth_val = 0.0
                if depth_idx is not None and depth_idx < len(row):
                    d_str = row[depth_idx].strip()
                    if d_str:
                        depth_val = max(0.0, float(d_str))

                # 4. Parse Time
                time_val: Optional[str] = None
                if time_idx is not None and time_idx < len(row):
                    time_val = _parse_timestamp(row[time_idx])

                # 5. Parse ID & Type
                raw_id = row[id_idx].strip() if (id_idx is not None and id_idx < len(row) and row[id_idx].strip()) else f"txt_{round(lat_val, 2)}_{round(lon_val, 2)}"
                raw_type = row[type_idx].strip().lower() if (type_idx is not None and type_idx < len(row) and row[type_idx].strip()) else self._default_obs_type
                
                # Check with ObservationTypeRegistry
                obs_def = observation_type_registry.get(raw_type)
                canon_type = obs_def.id if obs_def else self._default_obs_type

                # 6. Parse QC
                qc_val = 1
                if qc_idx is not None and qc_idx < len(row):
                    try:
                        qc_val = int(row[qc_idx])
                    except (ValueError, TypeError):
                        qc_val = 1

                # 7. Extract variable measurements
                measurements: Dict[str, Optional[float]] = {}
                for var_id, c_idx in var_indices.items():
                    if c_idx < len(row):
                        v_str = row[c_idx].strip()
                        if v_str != "" and v_str.lower() not in ("nan", "null", "none", "-999", "-9999"):
                            try:
                                measurements[var_id] = float(v_str)
                            except (ValueError, TypeError):
                                measurements[var_id] = None

                valid_rows_count += 1
                lats.append(lat_val)
                lons.append(lon_val)
                if time_val:
                    times.append(time_val)

                # Group by Profile ID
                profile_key = f"{canon_type}_{raw_id}"
                if profile_key not in grouped_profiles:
                    grouped_profiles[profile_key] = {
                        "id": profile_key,
                        "type": canon_type,
                        "platform_id": raw_id,
                        "timestamp": time_val,
                        "latitude": lat_val,
                        "longitude": lon_val,
                        "max_depth": depth_val,
                        "variables": set(measurements.keys()),
                        "source": self._source_name,
                        "qc": qc_val,
                        "data": [],
                    }

                prof_entry = grouped_profiles[profile_key]
                prof_entry["max_depth"] = max(prof_entry["max_depth"], depth_val)
                prof_entry["variables"].update(measurements.keys())

                pt = {"depth": depth_val, **measurements}
                prof_entry["data"].append(pt)

            except Exception as row_err:
                invalid_rows_count += 1
                if len(warnings) < 10:
                    warnings.append(f"Row {row_num} rejected: {row_err}")

        # Assemble final observations & profiles
        self._observations = []
        self._profiles = {}
        self._counts = {}

        for p_key, p_data in grouped_profiles.items():
            # Sort vertical soundings by depth
            p_data["data"].sort(key=lambda pt: pt.get("depth", 0.0))
            var_list = sorted(list(p_data["variables"]))
            p_data["variables"] = var_list

            self._profiles[p_key] = p_data

            # Summary observation record
            obs_record = {
                "id": p_data["id"],
                "type": p_data["type"],
                "platform_id": p_data["platform_id"],
                "timestamp": p_data["timestamp"],
                "latitude": p_data["latitude"],
                "longitude": p_data["longitude"],
                "max_depth": p_data["max_depth"],
                "variables": var_list,
                "source": p_data["source"],
                "qc": p_data.get("qc", 1),
            }
            self._observations.append(obs_record)

            o_type = p_data["type"]
            self._counts[o_type] = self._counts.get(o_type, 0) + 1

        status = "VALID" if (valid_rows_count > 0 and invalid_rows_count == 0) else ("PARTIALLY_VALID" if valid_rows_count > 0 else "REJECTED")

        time_range = (min(times), max(times)) if times else None
        spatial_range = {
            "latitude": (min(lats), max(lats)),
            "longitude": (min(lons), max(lons)),
        } if lats and lons else None

        self._validation_report = ValidationReport(
            file_name=self.file_path.name,
            format=fmt_name,
            delimiter=delimiter,
            total_rows=valid_rows_count + invalid_rows_count,
            valid_rows=valid_rows_count,
            invalid_rows=invalid_rows_count,
            detected_columns=detected_columns,
            detected_variables=sorted(list(var_indices.keys())),
            source=self._source_name,
            observation_type=self._default_obs_type,
            status=status,
            time_range=time_range,
            spatial_range=spatial_range,
            errors=errors,
            warnings=warnings,
        )

        log.info(
            "Delimited text ingestion complete for '%s': %s (%d valid profiles, %d records)",
            self.file_path.name,
            status,
            len(self._observations),
            valid_rows_count,
        )

    def close(self) -> None:
        """Clear memory cache."""
        self._observations.clear()
        self._profiles.clear()


# Register with central adapter registry
adapter_registry.register_observation_adapter("delimited_text", DelimitedTextObservationAdapter)
adapter_registry.register_observation_adapter("csv", DelimitedTextObservationAdapter)
adapter_registry.register_observation_adapter("tsv", DelimitedTextObservationAdapter)
adapter_registry.register_observation_adapter("ascii", DelimitedTextObservationAdapter)
