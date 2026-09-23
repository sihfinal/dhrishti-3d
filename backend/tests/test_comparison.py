"""
backend/tests/test_comparison.py
--------------------------------
Tests for Model vs Observation vertical sounding comparison service and API endpoint.
"""
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_compare_model_observation_temperature():
    # Use real Argo observation in Indian Ocean
    response = client.get("/api/v1/compare/model-observation?obs_id=argo_19770705&variable=temperature")
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert "observation" in data
    assert data["observation"]["id"] == "argo_19770705"
    assert data["observation"]["latitude"] is not None
    assert data["observation"]["longitude"] is not None
    
    assert "model_match" in data
    match = data["model_match"]
    assert match["variable"] == "temperature"
    assert match["nc_variable"] == "thetao"
    assert match["spatial_distance_km"] < 50.0  # Within grid cell resolution
    assert match["nearest_latitude"] is not None
    assert match["nearest_longitude"] is not None
    
    assert "metrics" in data
    metrics = data["metrics"]
    assert metrics["valid_points_count"] > 0
    assert metrics["mean_residual"] is not None
    assert metrics["mean_absolute_error"] is not None
    assert metrics["root_mean_square_difference"] is not None
    
    assert "profile_comparison" in data
    assert len(data["profile_comparison"]) > 0
    first_pt = data["profile_comparison"][0]
    assert "depth" in first_pt
    assert "obs_value" in first_pt
    assert "model_value" in first_pt
    assert "residual" in first_pt
    # Verify Residual = Observation - Model
    assert abs(first_pt["residual"] - (first_pt["obs_value"] - first_pt["model_value"])) < 1e-4


def test_compare_model_observation_salinity():
    response = client.get("/api/v1/compare/model-observation?obs_id=argo_19770705&variable=salinity")
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert data["model_match"]["variable"] == "salinity"
    assert data["model_match"]["nc_variable"] == "so"
    assert len(data["profile_comparison"]) > 0


def test_compare_unmeasured_variable_error():
    # Observation argo_19770706 does not measure chlorophyll
    response = client.get("/api/v1/compare/model-observation?obs_id=argo_19770706&variable=chlorophyll")
    assert response.status_code == 400
    detail = response.json().get("detail", "")
    assert "not measured" in detail.lower()


def test_compare_nonexistent_observation():
    response = client.get("/api/v1/compare/model-observation?obs_id=nonexistent_float_999999&variable=temperature")
    assert response.status_code == 400 or response.status_code == 404
