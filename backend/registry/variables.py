"""
backend/registry/variables.py
-----------------------------
Centralized registry for ocean variables in the SagarDrishti-3D platform.

Supports:
  - Canonical variable definitions with standard CF names, verified units, and value ranges.
  - Derived variable support (e.g. Current Velocity Magnitude via sqrt(uo² + vo²)).
  - Extension points for future biogeochemical parameters (Oxygen, Nitrate, pH, Turbidity).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional


@dataclass
class VariableDefinition:
    """
    Metadata specification for an oceanographic variable.
    """
    id: str
    display_name: str
    standard_name: str
    source_variable_names: List[str]
    units: str
    category: str  # "physical", "hydrodynamic", "biogeochemical"
    min_value: float
    max_value: float
    is_derived: bool = False
    is_active: bool = True
    derive_func: Optional[Callable[..., Any]] = None
    description: str = ""
    aliases: List[str] = field(default_factory=list)


def calculate_current_speed(uo: float, vo: float) -> float:
    """
    Standard hydrodynamic vector magnitude:
    speed = sqrt(uo² + vo²)
    """
    return math.sqrt(uo * uo + vo * vo)


class VariableRegistry:
    """
    Thread-safe central registry managing all active and extension-ready ocean variables.
    """

    def __init__(self):
        self._variables: Dict[str, VariableDefinition] = {}
        self._aliases: Dict[str, str] = {}
        self._register_default_variables()

    def _register_default_variables(self) -> None:
        """Register the core operational variables and future extension placeholders."""
        
        # ── 1. ACTIVE CORE OPERATIONAL VARIABLES ──────────────────────────────
        active_vars = [
            VariableDefinition(
                id="temperature",
                display_name="Sea Water Potential Temperature",
                standard_name="sea_water_potential_temperature",
                source_variable_names=["thetao"],
                units="°C",
                category="physical",
                min_value=-2.0,
                max_value=35.0,
                is_derived=False,
                is_active=True,
                description="Potential temperature of the water column.",
                aliases=["thetao", "temp", "sst"],
            ),
            VariableDefinition(
                id="salinity",
                display_name="Sea Water Practical Salinity",
                standard_name="sea_water_practical_salinity",
                source_variable_names=["so"],
                units="PSU",
                category="physical",
                min_value=0.0,
                max_value=42.0,
                is_derived=False,
                is_active=True,
                description="Practical salinity scale measurement of the water mass.",
                aliases=["so", "sal", "sss"],
            ),
            VariableDefinition(
                id="u_velocity",
                display_name="Eastward Sea Water Velocity (uo)",
                standard_name="eastward_sea_water_velocity",
                source_variable_names=["uo"],
                units="m/s",
                category="hydrodynamic",
                min_value=-3.0,
                max_value=3.0,
                is_derived=False,
                is_active=True,
                description="Zonal eastward component of horizontal ocean current.",
                aliases=["uo", "u_current"],
            ),
            VariableDefinition(
                id="v_velocity",
                display_name="Northward Sea Water Velocity (vo)",
                standard_name="northward_sea_water_velocity",
                source_variable_names=["vo"],
                units="m/s",
                category="hydrodynamic",
                min_value=-3.0,
                max_value=3.0,
                is_derived=False,
                is_active=True,
                description="Meridional northward component of horizontal ocean current.",
                aliases=["vo", "v_current"],
            ),
            VariableDefinition(
                id="currents",
                display_name="Ocean Current Velocity Magnitude",
                standard_name="sea_water_speed",
                source_variable_names=["uo", "vo"],
                units="m/s",
                category="hydrodynamic",
                min_value=0.0,
                max_value=3.5,
                is_derived=True,
                is_active=True,
                derive_func=calculate_current_speed,
                description="Total horizontal current magnitude computed via sqrt(uo² + vo²).",
                aliases=["current_speed", "velocity_magnitude", "current_magnitude"],
            ),
            VariableDefinition(
                id="chlorophyll",
                display_name="Mass Concentration of Chlorophyll-a",
                standard_name="mass_concentration_of_chlorophyll_a_in_sea_water",
                source_variable_names=["chl"],
                units="mg/m³",
                category="biogeochemical",
                min_value=0.01,
                max_value=10.0,
                is_derived=False,
                is_active=True,
                description="Biogeochemical primary productivity indicator from Copernicus satellite & model datasets.",
                aliases=["chl", "chla", "chlorophyll_a"],
            ),
        ]

        for v in active_vars:
            self.register(v)

        # ── 2. EXTENSION-READY (FUTURE) VARIABLES (is_active=False) ─────────────
        future_vars = [
            VariableDefinition(
                id="oxygen",
                display_name="Dissolved Oxygen Concentration",
                standard_name="mole_concentration_of_dissolved_molecular_oxygen_in_sea_water",
                source_variable_names=["doxy", "oxygen"],
                units="µmol/kg",
                category="biogeochemical",
                min_value=0.0,
                max_value=350.0,
                is_derived=False,
                is_active=False,
                description="Extension point for BGC-Argo and CTD dissolved oxygen profiles.",
                aliases=["doxy", "dissolved_oxygen"],
            ),
            VariableDefinition(
                id="nitrate",
                display_name="Dissolved Nitrate Concentration",
                standard_name="mole_concentration_of_nitrate_in_sea_water",
                source_variable_names=["nitrate", "no3"],
                units="µmol/kg",
                category="biogeochemical",
                min_value=0.0,
                max_value=45.0,
                is_derived=False,
                is_active=False,
                description="Extension point for nutrient profiles from BGC-Argo floats.",
                aliases=["no3"],
            ),
            VariableDefinition(
                id="ph",
                display_name="Sea Water pH",
                standard_name="sea_water_ph_reported_on_total_scale",
                source_variable_names=["ph_in_situ_total", "ph"],
                units="pH units",
                category="biogeochemical",
                min_value=7.0,
                max_value=8.6,
                is_derived=False,
                is_active=False,
                description="Extension point for ocean acidification and carbon-system monitoring.",
                aliases=["ph_total"],
            ),
            VariableDefinition(
                id="turbidity",
                display_name="Water Turbidity / Optical Backscattering",
                standard_name="sea_water_turbidity",
                source_variable_names=["turbidity", "bbp700"],
                units="NTU",
                category="physical",
                min_value=0.0,
                max_value=100.0,
                is_derived=False,
                is_active=False,
                description="Extension point for coastal and optical sensor observations.",
                aliases=["turb"],
            ),
        ]

        for v in future_vars:
            self.register(v)

    def register(self, definition: VariableDefinition) -> None:
        """Register a new variable definition or extension point."""
        self._variables[definition.id] = definition
        for alias in definition.aliases:
            self._aliases[alias.lower()] = definition.id

    def get(self, variable_id_or_alias: str) -> Optional[VariableDefinition]:
        """Resolve a variable definition by canonical ID or registered alias."""
        key = variable_id_or_alias.lower().strip()
        if key in self._variables:
            return self._variables[key]
        if key in self._aliases:
            canonical_id = self._aliases[key]
            return self._variables.get(canonical_id)
        return None

    def is_valid_variable(self, variable_id: str, active_only: bool = True) -> bool:
        """Check if a variable identifier is recognized."""
        var = self.get(variable_id)
        if var is None:
            return False
        return var.is_active if active_only else True

    def list_active(self) -> List[VariableDefinition]:
        """Return list of all currently active operational variables."""
        return [v for v in self._variables.values() if v.is_active]

    def list_future(self) -> List[VariableDefinition]:
        """Return list of all extension-ready (future) variables."""
        return [v for v in self._variables.values() if not v.is_active]

    def list_all(self) -> List[VariableDefinition]:
        """Return list of all registered variables."""
        return list(self._variables.values())


# Global singleton instance
variable_registry = VariableRegistry()
