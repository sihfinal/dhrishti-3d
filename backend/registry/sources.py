"""
backend/registry/sources.py
---------------------------
Centralized data source registry for SagarDrishti-3D.

Registers authoritative ocean data institutions and upstream repositories:
  - CMEMS (Copernicus Marine Service)
  - WOD (World Ocean Database / NOAA NCEI)
  - IFREMER (Coriolis Global Data Assembly Centre)
  - NOAA (National Oceanic and Atmospheric Administration)
  - INCOIS (Indian National Centre for Ocean Information Services)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class DataSourceDefinition:
    """
    Specification for an authoritative oceanographic data source / institution.
    """
    id: str
    name: str
    institution: str
    dataset_type: str  # "model", "observation", or "both"
    format: str
    is_active: bool = True
    description: str = ""
    aliases: List[str] = field(default_factory=list)


class DataSourceRegistry:
    """
    Registry managing all supported and connected upstream ocean data sources.
    """

    def __init__(self):
        self._sources: Dict[str, DataSourceDefinition] = {}
        self._aliases: Dict[str, str] = {}
        self._register_default_sources()

    def _register_default_sources(self) -> None:
        sources = [
            DataSourceDefinition(
                id="cmems",
                name="Copernicus Marine Environment Monitoring Service",
                institution="Mercator Ocean International / European Union",
                dataset_type="model",
                format="NetCDF-4",
                is_active=True,
                description="Global ocean physics (GLOBAL_ANALYSISFORECAST_PHY_001_024) and biogeochemistry daily archives.",
                aliases=["copernicus", "mercator"],
            ),
            DataSourceDefinition(
                id="wod",
                name="World Ocean Database 2023",
                institution="NOAA National Centers for Environmental Information (NCEI)",
                dataset_type="observation",
                format="NetCDF-4 (DSG Ragged Array)",
                is_active=True,
                description="Global quality-controlled in-situ profile archive containing Argo floats, gliders, and CTD casts.",
                aliases=["ncei_wod", "wod23"],
            ),
            DataSourceDefinition(
                id="ifremer",
                name="IFREMER / Coriolis GDAC",
                institution="French Research Institute for Exploitation of the Sea",
                dataset_type="observation",
                format="NetCDF-4",
                is_active=True,
                description="Global Data Assembly Centre for real-time Argo profiling float telemetry.",
                aliases=["coriolis", "gdac"],
            ),
            DataSourceDefinition(
                id="noaa",
                name="National Oceanic and Atmospheric Administration",
                institution="U.S. Department of Commerce",
                dataset_type="observation",
                format="NetCDF-4 / CSV",
                is_active=True,
                description="Global oceanographic observation repositories, satellite observations, and climatology databases.",
                aliases=["ncei"],
            ),
            DataSourceDefinition(
                id="incois",
                name="Indian National Centre for Ocean Information Services",
                institution="Ministry of Earth Sciences (MoES), Government of India",
                dataset_type="both",
                format="NetCDF-4 / REST / OGC",
                is_active=True,
                description="Authoritative national ocean information provider for the Indian Ocean and EEZ.",
                aliases=["moes_incois", "incois_hyd"],
            ),
        ]

        for s in sources:
            self.register(s)

    def register(self, source: DataSourceDefinition) -> None:
        """Register a new ocean data source."""
        self._sources[source.id] = source
        for alias in source.aliases:
            self._aliases[alias.lower()] = source.id

    def get(self, source_id_or_alias: str) -> Optional[DataSourceDefinition]:
        """Resolve a data source by canonical ID or alias."""
        key = source_id_or_alias.lower().strip()
        if key in self._sources:
            return self._sources[key]
        if key in self._aliases:
            canonical_id = self._aliases[key]
            return self._sources.get(canonical_id)
        return None

    def list_active(self) -> List[DataSourceDefinition]:
        """Return list of active data sources."""
        return [s for s in self._sources.values() if s.is_active]

    def list_all(self) -> List[DataSourceDefinition]:
        """Return list of all registered data sources."""
        return list(self._sources.values())


# Global singleton instance
source_registry = DataSourceRegistry()
