"""
backend/registry/observation_types.py
-------------------------------------
Centralized registry for ocean observation platforms and sensor types.

Supports:
  - Active operational in-situ platforms (Argo, Glider, CTD, BGC).
  - Extension points for future sensor modalities (Moorings, ADCP, HF-Radar).
  - Clean separation: future sensor extension points are registered as extension_ready (is_active=False)
    so they NEVER generate fake data or display unverified points on maps.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ObservationTypeDefinition:
    """
    Metadata specification for an in-situ platform or remote sensing observation type.
    """
    id: str
    display_name: str
    source_key: str
    marker_type: str
    supported_variables: List[str]
    has_profiles: bool
    is_active: bool
    status: str  # "active" or "extension_ready"
    description: str
    aliases: List[str] = field(default_factory=list)


class ObservationTypeRegistry:
    """
    Central registry managing all active observation platforms and future sensor extension points.
    """

    def __init__(self):
        self._types: Dict[str, ObservationTypeDefinition] = {}
        self._aliases: Dict[str, str] = {}
        self._register_default_types()

    def _register_default_types(self) -> None:
        """Register active in-situ observation types and extension placeholders."""
        
        # ── 1. ACTIVE REAL-DATA PLATFORMS (is_active=True, status="active") ───
        active_types = [
            ObservationTypeDefinition(
                id="argo",
                display_name="Core Argo Profiling Floats",
                source_key="wod",
                marker_type="float",
                supported_variables=["temperature", "salinity", "chlorophyll", "nitrate", "oxygen"],
                has_profiles=True,
                is_active=True,
                status="active",
                description="Autonomous drifting profiling floats measuring temperature and salinity down to 2000m.",
                aliases=["pfl", "argo_float", "floats"],
            ),
            ObservationTypeDefinition(
                id="glider",
                display_name="Autonomous Underwater Gliders",
                source_key="wod",
                marker_type="glider",
                supported_variables=["temperature", "salinity", "chlorophyll", "oxygen"],
                has_profiles=True,
                is_active=True,
                status="active",
                description="Buoyancy-driven autonomous underwater vehicles executing saw-tooth mission trajectories.",
                aliases=["gld", "auv", "underwater_glider"],
            ),
            ObservationTypeDefinition(
                id="ctd",
                display_name="Research Vessel CTD Casts",
                source_key="wod",
                marker_type="ship",
                supported_variables=["temperature", "salinity", "chlorophyll", "nitrate"],
                has_profiles=True,
                is_active=True,
                status="active",
                description="Shipboard Conductivity-Temperature-Depth rosette soundings from oceanographic research cruises.",
                aliases=["ship_ctd", "rosette", "ctd_cast"],
            ),
            ObservationTypeDefinition(
                id="bgc",
                display_name="Biogeochemical (BGC) Argo Profiles",
                source_key="wod",
                marker_type="bgc_float",
                supported_variables=["temperature", "salinity", "chlorophyll", "oxygen", "nitrate", "ph"],
                has_profiles=True,
                is_active=True,
                status="active",
                description="Profiling floats equipped with biogeochemical optical and chemical sensors.",
                aliases=["bgc_argo", "biogeochemical", "bgc_pfl"],
            ),
        ]

        for t in active_types:
            self.register(t)

        # ── 2. EXTENSION-READY FUTURE SENSORS (is_active=False, status="extension_ready") ─
        future_types = [
            ObservationTypeDefinition(
                id="mooring",
                display_name="Ocean Moored Buoys (RAMA / OMNI)",
                source_key="incois",
                marker_type="buoy",
                supported_variables=["temperature", "salinity", "currents", "meteorology"],
                has_profiles=True,
                is_active=False,
                status="extension_ready",
                description="Extension point for moored buoy networks (e.g. INCOIS OMNI, RAMA Indian Ocean array).",
                aliases=["buoy", "omni", "rama", "moored_buoy"],
            ),
            ObservationTypeDefinition(
                id="adcp",
                display_name="Acoustic Doppler Current Profiler (ADCP)",
                source_key="noaa",
                marker_type="adcp",
                supported_variables=["u_velocity", "v_velocity", "currents"],
                has_profiles=True,
                is_active=False,
                status="extension_ready",
                description="Extension point for shipboard and moored acoustic ocean current velocity profiles.",
                aliases=["doppler", "current_profiler"],
            ),
            ObservationTypeDefinition(
                id="hf_radar",
                display_name="High-Frequency Coastal Radar (HFR)",
                source_key="incois",
                marker_type="radar",
                supported_variables=["currents", "wave_height"],
                has_profiles=False,
                is_active=False,
                status="extension_ready",
                description="Extension point for coastal HF radar surface current vector field grids.",
                aliases=["radar", "coastal_radar", "hfr"],
            ),
        ]

        for t in future_types:
            self.register(t)

    def register(self, definition: ObservationTypeDefinition) -> None:
        """Register a new observation type or extension point."""
        self._types[definition.id] = definition
        for alias in definition.aliases:
            self._aliases[alias.lower()] = definition.id

    def get(self, type_id_or_alias: str) -> Optional[ObservationTypeDefinition]:
        """Resolve an observation type definition by canonical ID or registered alias."""
        key = type_id_or_alias.lower().strip()
        if key in self._types:
            return self._types[key]
        if key in self._aliases:
            canonical_id = self._aliases[key]
            return self._types.get(canonical_id)
        return None

    def is_valid_type(self, type_id: str, active_only: bool = True) -> bool:
        """Check if an observation type identifier is recognized."""
        obs_type = self.get(type_id)
        if obs_type is None:
            return False
        return obs_type.is_active if active_only else True

    def list_active(self) -> List[ObservationTypeDefinition]:
        """Return list of all currently active in-situ observation types."""
        return [t for t in self._types.values() if t.is_active]

    def list_future(self) -> List[ObservationTypeDefinition]:
        """Return list of all extension-ready (future) sensor types."""
        return [t for t in self._types.values() if not t.is_active]

    def list_all(self) -> List[ObservationTypeDefinition]:
        """Return list of all registered observation types."""
        return list(self._types.values())


# Global singleton instance
observation_type_registry = ObservationTypeRegistry()
