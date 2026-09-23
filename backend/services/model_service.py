"""
backend/services/model_service.py
---------------------------------
Service orchestrator for numerical ocean model data layers.
Resolves model adapters through the central AdapterRegistry while maintaining zero performance overhead.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional

from backend.adapters.base import BaseModelAdapter
from backend.adapters.cmems_model import CMEMSModelAdapter
from backend.registry.adapters import adapter_registry


class ModelService:
    """
    High-level service interface for 3D/4D gridded ocean model fields.
    """

    def __init__(self, data_dir: Path, source: str = "cmems"):
        self.data_dir = data_dir
        self.source = source
        adapter = adapter_registry.create_model_adapter(source, data_dir)
        if adapter is None:
            adapter = CMEMSModelAdapter(data_dir)
        self.adapter: BaseModelAdapter = adapter

    def get_metadata(self) -> dict[str, Any]:
        return self.adapter.fetch_metadata()

    def get_times(self) -> list[str]:
        return self.adapter.get_available_times()

    def get_depths(self, variable: str = "temperature") -> list[float]:
        return self.adapter.get_available_depths(variable)

    def get_field(
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
        return self.adapter.get_field_slice(
            variable=variable,
            date_str=date_str,
            depth=depth,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )

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
        return self.adapter.get_field_stack(
            variable=variable,
            date_str=date_str,
            depths=depths,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )

    def close(self) -> None:
        self.adapter.close()
