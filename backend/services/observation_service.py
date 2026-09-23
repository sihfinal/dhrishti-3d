"""
backend/services/observation_service.py
---------------------------------------
Service orchestrator for in-situ ocean observation platforms (Argo, Gliders, CTD, BGC).
Resolves observation adapters dynamically through the central AdapterRegistry and seamlessly
aggregates newly ingested in-situ datasets (CSV, TSV, ASCII) into unified observation APIs.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.adapters.base import BaseObservationAdapter
from backend.adapters.wod_observations import WODObservationAdapter
from backend.registry.adapters import adapter_registry

log = logging.getLogger(__name__)


class ObservationService:
    """
    High-level service interface for in-situ ocean observation profiles and platform positions.
    Combines authoritative NOAA/WOD NetCDF archives with dynamically ingested in-situ text sources.
    """

    def __init__(self, data_dir: Path, source: str = "wod"):
        self.data_dir = data_dir
        self.source = source
        adapter = adapter_registry.create_observation_adapter(source, data_dir)
        if adapter is None:
            adapter = WODObservationAdapter(data_dir)
        self.adapter: BaseObservationAdapter = adapter
        self._extra_adapters: Dict[str, BaseObservationAdapter] = {}

    def register_ingested_adapter(self, adapter_id: str, adapter: BaseObservationAdapter) -> None:
        """Add a dynamically ingested in-situ observation adapter into the active query pool."""
        self._extra_adapters[adapter_id] = adapter
        log.info("Registered dynamic observation adapter '%s' into ObservationService", adapter_id)

    def remove_ingested_adapter(self, adapter_id: str) -> None:
        """Remove an ingested adapter from the active query pool."""
        if adapter_id in self._extra_adapters:
            ad = self._extra_adapters.pop(adapter_id)
            ad.close()

    def get_counts(self) -> dict[str, int]:
        """Aggregate platform counts across authoritative WOD and ingested adapters."""
        total_counts = dict(self.adapter.get_counts())
        for extra in self._extra_adapters.values():
            for t, cnt in extra.get_counts().items():
                total_counts[t] = total_counts.get(t, 0) + cnt
        return total_counts

    def get_observations(
        self,
        obs_type: Optional[str] = "all",
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 2000,
    ) -> list[dict[str, Any]]:
        """Query platform locations from WOD NetCDF and ingested text files with bounding box filtering."""
        results = self.adapter.get_observations(
            obs_type=obs_type,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            limit=limit,
        )

        remaining_limit = limit - len(results)
        if remaining_limit > 0 and self._extra_adapters:
            for extra in self._extra_adapters.values():
                extra_obs = extra.get_observations(
                    obs_type=obs_type,
                    lat_min=lat_min,
                    lat_max=lat_max,
                    lon_min=lon_min,
                    lon_max=lon_max,
                    limit=remaining_limit,
                )
                results.extend(extra_obs)
                remaining_limit = limit - len(results)
                if remaining_limit <= 0:
                    break

        return results

    def get_profile(self, obs_id: str) -> Optional[dict[str, Any]]:
        """Retrieve depth-resolved soundings for an observation ID from WOD or ingested text adapters."""
        prof = self.adapter.get_profile(obs_id)
        if prof is not None:
            return prof

        for extra in self._extra_adapters.values():
            prof = extra.get_profile(obs_id)
            if prof is not None:
                return prof

        return None

    def close(self) -> None:
        """Close primary and dynamic observation file handles upon application shutdown."""
        self.adapter.close()
        for extra in list(self._extra_adapters.values()):
            try:
                extra.close()
            except Exception as e:
                log.warning("Error closing extra observation adapter: %s", e)
        self._extra_adapters.clear()
