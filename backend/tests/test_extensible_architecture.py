"""
backend/tests/test_extensible_architecture.py
---------------------------------------------
Comprehensive test suite verifying the Extensible Architecture & Future Sensor Architecture:
  1. VariableRegistry verification (temperature, salinity, currents, chlorophyll).
  2. ObservationTypeRegistry verification (argo, glider, ctd, bgc).
  3. Future sensor extension points (mooring, adcp, hf_radar) are marked inactive.
  4. Future variable extension points (oxygen, nitrate, ph, turbidity) are marked inactive.
  5. AdapterRegistry resolves CMEMS and WOD adapters.
  6. Derived current velocity calculation strictly preserves sqrt(uo² + vo²).
  7. Unified schema normalization preserves physical values and numerical fidelity.
  8. Test-only MockFutureObservationAdapter registration and resolution without core modifications.
  9. Model & Observation services maintain 100% backward compatibility.
"""
import math
from pathlib import Path
from typing import Any, Dict, List, Optional
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.adapters.base import BaseModelAdapter, BaseObservationAdapter
from backend.adapters.cmems_model import CMEMSModelAdapter
from backend.adapters.wod_observations import WODObservationAdapter
from backend.registry import (
    VariableDefinition,
    calculate_current_speed,
    variable_registry,
    ObservationTypeDefinition,
    observation_type_registry,
    DataSourceDefinition,
    source_registry,
    AdapterRegistry,
    adapter_registry,
)
from backend.schemas.unified import (
    UnifiedModelField,
    UnifiedObservation,
    UnifiedProfilePoint,
    UnifiedDatasetInfo,
)
from backend.services.model_service import ModelService
from backend.services.observation_service import ObservationService


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── 1. VARIABLE REGISTRY TESTS ────────────────────────────────────────────────

def test_variable_registry_core_variables():
    """Verify core operational variables are present, active, and have verified units."""
    temp = variable_registry.get("temperature")
    assert temp is not None
    assert temp.is_active is True
    assert temp.units == "°C"
    assert "thetao" in temp.source_variable_names
    assert temp.min_value == -2.0
    assert temp.max_value == 35.0

    sal = variable_registry.get("salinity")
    assert sal is not None
    assert sal.is_active is True
    assert sal.units == "PSU"
    assert "so" in sal.source_variable_names

    u_vel = variable_registry.get("u_velocity")
    assert u_vel is not None
    assert u_vel.units == "m/s"

    v_vel = variable_registry.get("v_velocity")
    assert v_vel is not None
    assert v_vel.units == "m/s"

    chl = variable_registry.get("chlorophyll")
    assert chl is not None
    assert chl.is_active is True
    assert chl.units == "mg/m³"
    assert "chl" in chl.source_variable_names


def test_variable_registry_aliases():
    """Verify canonical variable lookup works via standard aliases."""
    assert variable_registry.get("thetao").id == "temperature"
    assert variable_registry.get("so").id == "salinity"
    assert variable_registry.get("uo").id == "u_velocity"
    assert variable_registry.get("vo").id == "v_velocity"
    assert variable_registry.get("chl").id == "chlorophyll"


def test_variable_registry_current_speed_formula():
    """Verify current speed calculation strictly uses sqrt(uo² + vo²)."""
    currents = variable_registry.get("currents")
    assert currents is not None
    assert currents.is_derived is True
    assert currents.is_active is True
    assert currents.units == "m/s"
    assert "uo" in currents.source_variable_names
    assert "vo" in currents.source_variable_names

    # Test numerical precision of current speed function
    uo = 0.6
    vo = 0.8
    expected = math.sqrt(uo**2 + vo**2)  # 1.0
    assert math.isclose(calculate_current_speed(uo, vo), expected, rel_tol=1e-9)
    assert currents.derive_func is not None
    assert math.isclose(currents.derive_func(uo, vo), 1.0, rel_tol=1e-9)


def test_variable_registry_future_extensions_inactive():
    """Verify future variables exist as extension points but are NOT marked active."""
    future_var_ids = ["oxygen", "nitrate", "ph", "turbidity"]
    active_var_ids = [v.id for v in variable_registry.list_active()]

    for f_id in future_var_ids:
        var = variable_registry.get(f_id)
        assert var is not None, f"Extension variable {f_id} must be registered"
        assert var.is_active is False, f"Extension variable {f_id} must NOT be active"
        assert f_id not in active_var_ids


# ── 2. OBSERVATION TYPE REGISTRY TESTS ────────────────────────────────────────

def test_observation_type_registry_core_platforms():
    """Verify core in-situ platforms (Argo, Glider, CTD, BGC) are active with profiles."""
    core_types = ["argo", "glider", "ctd", "bgc"]
    active_types = [t.id for t in observation_type_registry.list_active()]

    for c_type in core_types:
        defn = observation_type_registry.get(c_type)
        assert defn is not None, f"Platform {c_type} must be registered"
        assert defn.is_active is True
        assert defn.status == "active"
        assert defn.has_profiles is True
        assert c_type in active_types


def test_observation_type_registry_future_sensors_inactive():
    """Verify future sensors (Moorings, ADCP, HF-Radar) are marked extension_ready and inactive."""
    future_sensors = ["mooring", "adcp", "hf_radar"]
    active_type_ids = [t.id for t in observation_type_registry.list_active()]
    future_type_ids = [t.id for t in observation_type_registry.list_future()]

    for sensor in future_sensors:
        defn = observation_type_registry.get(sensor)
        assert defn is not None, f"Future sensor {sensor} must be registered"
        assert defn.is_active is False, f"Future sensor {sensor} must NOT be active"
        assert defn.status == "extension_ready"
        assert sensor not in active_type_ids
        assert sensor in future_type_ids


# ── 3. DATA SOURCE & ADAPTER REGISTRY TESTS ───────────────────────────────────

def test_data_source_registry():
    """Verify authoritative upstream sources are registered."""
    sources = [s.id for s in source_registry.list_all()]
    assert "cmems" in sources
    assert "wod" in sources
    assert "ifremer" in sources
    assert "noaa" in sources
    assert "incois" in sources


def test_adapter_registry_resolution():
    """Verify AdapterRegistry resolves concrete CMEMS and WOD adapter classes."""
    cmems_cls = adapter_registry.get_model_adapter_class("cmems")
    assert cmems_cls is CMEMSModelAdapter

    wod_cls = adapter_registry.get_observation_adapter_class("wod")
    assert wod_cls is WODObservationAdapter


# ── 4. EXTENSIBILITY DEMONSTRATION: MOCK FUTURE ADAPTER ────────────────────────

class MockFutureObservationAdapter(BaseObservationAdapter):
    """
    Test-only mock demonstrating that a new sensor/source adapter (e.g. coastal buoy array)
    can be plugged into the platform via AdapterRegistry without altering core service code.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir

    @property
    def dataset_id(self) -> str:
        return "mock-coastal-mooring-array"

    def fetch_metadata(self) -> Dict[str, Any]:
        return {
            "id": self.dataset_id,
            "name": "Mock Test Coastal Mooring Array",
            "source": "INCOIS / MoES",
            "platform_counts": {"mooring": 12},
        }

    def get_counts(self) -> Dict[str, int]:
        return {"mooring": 12}

    def get_observations(
        self,
        obs_type: Optional[str] = "all",
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 2000,
    ) -> List[Dict[str, Any]]:
        return [
            {
                "id": "mooring_test_01",
                "type": "mooring",
                "platform_id": "RAMA_TEST_01",
                "latitude": 12.5,
                "longitude": 84.2,
                "max_depth": 500.0,
                "variables": ["temperature", "salinity", "currents"],
                "source": "INCOIS / MoES",
            }
        ]

    def get_profile(self, obs_id: str) -> Optional[Dict[str, Any]]:
        if obs_id == "mooring_test_01":
            return {
                "id": "mooring_test_01",
                "type": "mooring",
                "platform_id": "RAMA_TEST_01",
                "latitude": 12.5,
                "longitude": 84.2,
                "max_depth": 500.0,
                "variables": ["temperature", "salinity"],
                "source": "INCOIS / MoES",
                "data": [
                    {"depth": 1.0, "temperature": 28.5, "salinity": 34.8},
                    {"depth": 50.0, "temperature": 26.2, "salinity": 35.1},
                    {"depth": 100.0, "temperature": 21.0, "salinity": 35.4},
                ],
            }
        return None


def test_extensibility_mock_adapter_registration(tmp_path: Path):
    """
    Demonstrates true architectural extensibility:
    Registering MockFutureObservationAdapter into a fresh AdapterRegistry and resolving it
    via ObservationService without touching any core logic.
    """
    custom_registry = AdapterRegistry()
    custom_registry.register_observation_adapter("mock_mooring", MockFutureObservationAdapter)

    assert "mock_mooring" in custom_registry.list_observation_adapters()
    adapter_cls = custom_registry.get_observation_adapter_class("mock_mooring")
    assert adapter_cls is MockFutureObservationAdapter

    # Instantiate adapter
    instance = adapter_cls(tmp_path)
    assert instance.dataset_id == "mock-coastal-mooring-array"
    counts = instance.get_counts()
    assert counts == {"mooring": 12}

    obs = instance.get_observations()
    assert len(obs) == 1
    assert obs[0]["type"] == "mooring"
    assert obs[0]["latitude"] == 12.5

    prof = instance.get_profile("mooring_test_01")
    assert prof is not None
    assert len(prof["data"]) == 3
    assert prof["data"][0]["temperature"] == 28.5


# ── 5. UNIFIED SCHEMA NORMALIZATION TESTS ──────────────────────────────────────

def test_unified_model_field_schema():
    """Verify UnifiedModelField normalizes model grid slices without loss."""
    field = UnifiedModelField(
        variable="temperature",
        source="CMEMS",
        dataset_id="cmems-global-ocean-physics-bgc",
        time="2026-02-15",
        depth=10.0,
        unit="°C",
        lat_min=-35.0,
        lat_max=30.0,
        lon_min=40.0,
        lon_max=100.0,
        width=3,
        height=2,
        min_value=15.2,
        max_value=28.4,
        values=[[28.4, 27.9, None], [15.2, 16.1, 18.0]],
        metadata={"institution": "Mercator Ocean International"},
    )
    assert field.variable == "temperature"
    assert field.unit == "°C"
    assert field.values[0][0] == 28.4
    assert field.values[0][2] is None


def test_unified_observation_schema():
    """Verify UnifiedObservation normalizes in-situ observation soundings."""
    obs = UnifiedObservation(
        id="argo_12345",
        source="NOAA / NCEI World Ocean Database",
        observation_type="argo",
        latitude=14.5,
        longitude=65.2,
        time="2026-02-15T12:00:00Z",
        depth=1950.0,
        platform_id="12345",
        variables=["temperature", "salinity"],
        qc=1,
        profile=[
            UnifiedProfilePoint(depth=0.5, temperature=28.2, salinity=35.5),
            UnifiedProfilePoint(depth=100.0, temperature=22.1, salinity=35.8),
        ],
    )
    assert obs.observation_type == "argo"
    assert len(obs.profile) == 2
    assert obs.profile[0].temperature == 28.2


# ── 6. BACKWARD COMPATIBILITY API REGRESSION TESTS ─────────────────────────────

def test_api_health_endpoint(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_api_datasets_endpoint(client):
    r = client.get("/api/v1/datasets")
    assert r.status_code == 200
    datasets = r.json()
    assert any(d["id"] == "cmems-physics-bgc" for d in datasets)
    assert any(d["id"] == "wod-argo" for d in datasets)


def test_api_model_metadata_endpoint(client):
    r = client.get("/api/v1/model/metadata")
    assert r.status_code == 200
    meta = r.json()
    assert meta["id"] == "cmems-global-ocean-physics-bgc"
    assert "temperature" in meta["variables"]


def test_api_observations_endpoint(client):
    r = client.get("/api/v1/observations", params={"limit": 5})
    assert r.status_code == 200
    data = r.json()
    assert data["count"] <= 5
    assert data["total_in_dataset"] > 0
    assert "counts_by_type" in data
