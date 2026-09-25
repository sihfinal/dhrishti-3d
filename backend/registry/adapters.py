"""
backend/registry/adapters.py
----------------------------
Centralized Adapter Registry for Sagar Netra 3D.

Decouples the service and API layers from concrete adapter implementations.
Allows new model or observation adapters (e.g. ASCII parsers, new sensor types, future models)
to be registered and resolved without modifying core service or API code.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Type

from backend.adapters.base import BaseModelAdapter, BaseObservationAdapter

log = logging.getLogger(__name__)


class AdapterRegistry:
    """
    Registry for model and observation adapter classes.
    Resolves data source IDs to their corresponding adapter implementations.
    """

    def __init__(self):
        self._model_adapters: Dict[str, Type[BaseModelAdapter]] = {}
        self._observation_adapters: Dict[str, Type[BaseObservationAdapter]] = {}

    def register_model_adapter(self, source_id: str, adapter_cls: Type[BaseModelAdapter]) -> None:
        """Register a concrete model adapter class."""
        key = source_id.lower().strip()
        self._model_adapters[key] = adapter_cls
        log.info("Registered Model Adapter for source '%s': %s", key, adapter_cls.__name__)

    def register_observation_adapter(self, source_id: str, adapter_cls: Type[BaseObservationAdapter]) -> None:
        """Register a concrete observation adapter class."""
        key = source_id.lower().strip()
        self._observation_adapters[key] = adapter_cls
        log.info("Registered Observation Adapter for source '%s': %s", key, adapter_cls.__name__)

    def get_model_adapter_class(self, source_id: str) -> Optional[Type[BaseModelAdapter]]:
        """Retrieve registered model adapter class by source ID."""
        return self._model_adapters.get(source_id.lower().strip())

    def get_observation_adapter_class(self, source_id: str) -> Optional[Type[BaseObservationAdapter]]:
        """Retrieve registered observation adapter class by source ID."""
        return self._observation_adapters.get(source_id.lower().strip())

    def create_model_adapter(self, source_id: str, data_dir: Path, **kwargs) -> Optional[BaseModelAdapter]:
        """Instantiate a registered model adapter for the specified data directory."""
        cls = self.get_model_adapter_class(source_id)
        if cls is None:
            return None
        return cls(data_dir, **kwargs)

    def create_observation_adapter(self, source_id: str, data_dir: Path, **kwargs) -> Optional[BaseObservationAdapter]:
        """Instantiate a registered observation adapter for the specified data directory."""
        cls = self.get_observation_adapter_class(source_id)
        if cls is None:
            return None
        return cls(data_dir, **kwargs)

    def list_model_adapters(self) -> List[str]:
        """List all registered model source IDs."""
        return list(self._model_adapters.keys())

    def list_observation_adapters(self) -> List[str]:
        """List all registered observation source IDs."""
        return list(self._observation_adapters.keys())


# Global singleton instance
adapter_registry = AdapterRegistry()
