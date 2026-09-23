"""
backend/registry/__init__.py
----------------------------
Central registry package exposing:
  - variable_registry: Canonical ocean variables & derived speed formulas.
  - observation_type_registry: Active in-situ platforms & future sensor extension points.
  - source_registry: Upstream authoritative data institutions.
  - adapter_registry: Dynamic adapter resolution layer.
"""
from backend.registry.variables import (
    VariableDefinition,
    VariableRegistry,
    calculate_current_speed,
    variable_registry,
)
from backend.registry.observation_types import (
    ObservationTypeDefinition,
    ObservationTypeRegistry,
    observation_type_registry,
)
from backend.registry.sources import (
    DataSourceDefinition,
    DataSourceRegistry,
    source_registry,
)
from backend.registry.adapters import (
    AdapterRegistry,
    adapter_registry,
)

__all__ = [
    "VariableDefinition",
    "VariableRegistry",
    "calculate_current_speed",
    "variable_registry",
    "ObservationTypeDefinition",
    "ObservationTypeRegistry",
    "observation_type_registry",
    "DataSourceDefinition",
    "DataSourceRegistry",
    "source_registry",
    "AdapterRegistry",
    "adapter_registry",
]
