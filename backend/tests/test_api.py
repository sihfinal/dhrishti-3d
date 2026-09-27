"""
backend/tests/test_api.py
-------------------------
Comprehensive real-data test suite verifying:
  - CMEMS Physical model lazy loading (thetao, so, uo, vo)
  - CMEMS BGC Chlorophyll model lazy loading (chl)
  - WOD Argo Floats, Gliders, and CTD observation queries
  - Spatial bounding box filtering
  - Single profile depth resolution & multi-channel parameters
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_list_datasets(client):
    r = client.get("/api/v1/datasets")
    assert r.status_code == 200
    datasets = r.json()
    assert len(datasets) >= 3
    dataset_ids = [d["id"] for d in datasets]
    assert "cmems-physics-bgc" in dataset_ids
    assert "wod-argo" in dataset_ids
    assert "wod-ctd" in dataset_ids

def test_model_metadata(client):
    r = client.get("/api/v1/model/metadata")
    assert r.status_code == 200
    meta = r.json()
    assert meta["id"] == "cmems-global-ocean-physics-bgc"
    assert "temperature" in meta["variables"]
    assert "salinity" in meta["variables"]
    assert "chlorophyll" in meta["variables"]
    assert meta["latitude_range"][0] <= -30.0
    assert meta["longitude_range"][1] >= 90.0

def test_model_times(client):
    r = client.get("/api/v1/model/times")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] in (6, 7, 90)
    assert "2026-01-01" in data["times"]
    assert "2026-02-15" in data["times"]
    assert "2026-03-31" in data["times"]

def test_model_depths(client):
    r = client.get("/api/v1/model/depths?variable=temperature")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 30
    assert data["depths"][0] < 1.0 # surface ~0.49m
    assert any(d >= 1900.0 for d in data["depths"])

def test_model_temperature_field_slice(client):
    r = client.get(
        "/api/v1/model/field",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depth": 250.0,
            "lat_min": -15.0,
            "lat_max": -5.0,
            "lon_min": 65.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "temperature"
    assert data["time"] == "2026-02-15"
    assert data["width"] > 0
    assert data["height"] > 0
    assert len(data["values"]) == data["height"]
    assert len(data["values"][0]) == data["width"]
    assert data["unit"] == "°C"
    assert data["min_value"] is not None
    assert data["max_value"] is not None

def test_model_salinity_field_slice(client):
    r = client.get(
        "/api/v1/model/field",
        params={
            "variable": "salinity",
            "time": "2026-01-10",
            "depth": 50.0,
            "lat_min": 0.0,
            "lat_max": 10.0,
            "lon_min": 70.0,
            "lon_max": 85.0,
            "stride": 3,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "salinity"
    assert data["unit"] == "PSU"

def test_model_chlorophyll_field_slice(client):
    r = client.get(
        "/api/v1/model/field",
        params={
            "variable": "chlorophyll",
            "time": "2026-03-01",
            "depth": 10.0,
            "lat_min": -10.0,
            "lat_max": 10.0,
            "lon_min": 60.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "chlorophyll"
    assert data["unit"] == "mg/m³"

def test_model_current_velocity_slice(client):
    r_u = client.get(
        "/api/v1/model/field",
        params={
            "variable": "u_velocity",
            "time": "2026-02-15",
            "depth": 0.0,
            "lat_min": 5.0,
            "lat_max": 15.0,
            "lon_min": 70.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r_u.status_code == 200
    assert r_u.json()["unit"] == "m/s"

    r_v = client.get(
        "/api/v1/model/field",
        params={
            "variable": "v_velocity",
            "time": "2026-02-15",
            "depth": 0.0,
            "lat_min": 5.0,
            "lat_max": 15.0,
            "lon_min": 70.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r_v.status_code == 200
    assert r_v.json()["unit"] == "m/s"

def test_observations_query(client):
    r = client.get("/api/v1/observations", params={"type": "all", "limit": 100})
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 100
    assert len(data["items"]) == 100
    types = set(item["type"] for item in data["items"])
    assert "argo" in types
    assert "glider" in types
    assert "ctd" in types
    assert "bgc" in types

def test_observations_balanced_sampling(client):
    r = client.get("/api/v1/observations", params={"limit": 2500})
    assert r.status_code == 200
    data = r.json()
    items = data["items"]
    assert len(items) <= 2500
    counts = {}
    for it in items:
        counts[it["type"]] = counts.get(it["type"], 0) + 1
    
    # Assert all 4 observation types are represented
    assert counts["argo"] > 0
    assert counts["glider"] > 0
    assert counts["ctd"] > 0
    assert counts["bgc"] > 0
    # Assert CTD does not exceed actual availability (619)
    assert counts["ctd"] <= 619
    # Assert full or deployment dataset totals are preserved
    assert data["counts_by_type"]["argo"] in (2000, 22231)
    assert data["counts_by_type"]["glider"] in (500, 2591)
    assert data["counts_by_type"]["ctd"] in (200, 619)
    assert data["counts_by_type"]["bgc"] in (455, 2257)

def test_observations_type_filtering(client):
    for t in ["argo", "glider", "ctd", "bgc"]:
        r = client.get("/api/v1/observations", params={"type": t, "limit": 50})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 50
        assert all(it["type"] == t for it in items)

def test_observations_spatial_filter(client):
    # Query only inside Indian Ocean region box
    r = client.get(
        "/api/v1/observations",
        params={
            "type": "argo",
            "lat_min": -18.0,
            "lat_max": -5.0,
            "lon_min": 65.0,
            "lon_max": 85.0,
            "limit": 50,
        },
    )
    assert r.status_code == 200
    data = r.json()
    for item in data["items"]:
        assert -18.0 <= item["latitude"] <= -5.0
        assert 65.0 <= item["longitude"] <= 85.0

def test_observation_profile_retrieval(client):
    # First get a CTD cast ID
    r_list = client.get("/api/v1/observations", params={"type": "ctd", "limit": 1})
    assert r_list.status_code == 200
    items = r_list.json()["items"]
    assert len(items) > 0
    obs_id = items[0]["id"]

    # Fetch full depth profile
    r_prof = client.get(f"/api/v1/observations/{obs_id}/profile")
    assert r_prof.status_code == 200
    prof = r_prof.json()
    assert prof["id"] == obs_id
    assert prof["type"] == "ctd"
    assert len(prof["data"]) > 0
    # Verify depth profile structure
    first_pt = prof["data"][0]
    assert "depth" in first_pt
    assert "temperature" in first_pt

def test_observation_profile_argo_20059500_single_variable(client):
    """
    Regression test for argo_20059500:
    Cast has 989 valid temperature measurements but Salinity_row_size is masked.
    Must succeed with HTTP 200, return 989 temperature levels, and report salinity as None.
    """
    # 1. Test with prefixed ID
    r = client.get("/api/v1/observations/argo_20059500/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["id"] == "argo_20059500"
    assert prof["type"] == "argo"
    assert prof["platform_id"] == "20059500"
    assert len(prof["data"]) == 989
    assert prof["variables"] == ["temperature"]
    # Check first and last points
    assert prof["data"][0]["temperature"] is not None
    assert prof["data"][0]["salinity"] is None
    assert prof["data"][-1]["temperature"] is not None
    assert prof["data"][-1]["salinity"] is None

    # 2. Test with raw numeric ID alias
    r_raw = client.get("/api/v1/observations/20059500/profile")
    assert r_raw.status_code == 200
    assert len(r_raw.json()["data"]) == 989

def test_observation_profile_multi_variable(client):
    """
    Verify multi-variable observation profile (Temperature + Salinity).
    """
    r = client.get("/api/v1/observations/argo_19770705/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["id"] == "argo_19770705"
    assert len(prof["data"]) == 101
    assert "temperature" in prof["variables"]
    assert "salinity" in prof["variables"]
    # First point has both temperature and salinity
    assert prof["data"][0]["temperature"] is not None
    assert prof["data"][0]["salinity"] is not None

def test_observation_profile_glider_multi_channel(client):
    """
    Verify autonomous underwater glider profile with BGC sensors (Oxygen, Chlorophyll).
    """
    r = client.get("/api/v1/observations/glider_22043437/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["type"] == "glider"
    assert len(prof["data"]) == 10
    assert "temperature" in prof["variables"]
    assert "salinity" in prof["variables"]
    assert "oxygen" in prof["variables"]

def test_gzip_compression_large_field(client):
    """
    Verify Step 2 HTTP transport compression on large model grid payload.
    Ensures Content-Encoding: gzip is set, content is reduced, and decompressed data matches.
    """
    r = client.get(
        "/api/v1/model/field?variable=temperature&time=2026-02-15&depth=250.0&stride=2",
        headers={"Accept-Encoding": "gzip"},
    )
    assert r.status_code == 200
    assert r.headers.get("content-encoding") == "gzip"
    data = r.json()
    assert data["variable"] == "temperature"
    assert "values" in data
    assert len(data["values"]) > 0

def test_gzip_compression_observations(client):
    """
    Verify Step 2 HTTP transport compression on observation list.
    """
    r = client.get(
        "/api/v1/observations?limit=500",
        headers={"Accept-Encoding": "gzip"},
    )
    assert r.status_code == 200
    assert r.headers.get("content-encoding") == "gzip"
    data = r.json()
    assert "items" in data
    assert len(data["items"]) == 500

def test_gzip_bypass_small_endpoint(client):
    """
    Verify Step 2 bypass: responses smaller than minimum_size (1400B) must NOT be compressed.
    """
    r = client.get("/api/v1/health", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("content-encoding") is None
    assert len(r.content) < 1400

def test_step3_precomputed_offsets_argo(client):
    """
    Step 3 test: Verify fast profile retrieval using precomputed cumulative offsets for Argo.
    """
    r = client.get("/api/v1/observations/argo_19770705/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["id"] == "argo_19770705"
    assert prof["type"] == "argo"
    assert len(prof["data"]) == 101
    assert "temperature" in prof["variables"]
    assert "salinity" in prof["variables"]

def test_step3_precomputed_offsets_ctd(client):
    """
    Step 3 test: Verify high-resolution CTD cast profile retrieval using precomputed offsets.
    """
    r = client.get("/api/v1/observations/ctd_20314995/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["id"] == "ctd_20314995"
    assert prof["type"] == "ctd"
    assert len(prof["data"]) == 4761
    assert "chlorophyll" in prof["variables"]
    assert "oxygen" in prof["variables"]

def test_step3_precomputed_offsets_bgc(client):
    """
    Step 3 test: Verify BGC float multi-sensor profile retrieval (5+ biochemical sensors).
    """
    r = client.get("/api/v1/observations/bgc_19770878/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["id"] == "bgc_19770878"
    assert prof["type"] == "bgc"
    assert len(prof["data"]) == 396
    assert "nitrate" in prof["variables"]
    assert "chlorophyll" in prof["variables"]

def test_step3_profile_invalid_id(client):
    """
    Step 3 test: Verify non-existent observation profile returns 404 cleanly.
    """
    r = client.get("/api/v1/observations/nonexistent_99999999/profile")
    assert r.status_code == 404

def test_step3_profile_alias_raw_id(client):
    """
    Step 3 test: Verify raw numeric ID without type prefix works through precomputed index.
    """
    r = client.get("/api/v1/observations/19770705/profile")
    assert r.status_code == 200
    prof = r.json()
    assert prof["platform_id"] == "19770705"
    assert len(prof["data"]) == 101


# ===========================================================================
# Step 4 Tests: Batch Stage-2 Depth Requests
# ===========================================================================

def test_step4_field_stack_temperature(client):
    """
    Step 4 test: Batch query 7 depth levels for temperature in a single request.
    """
    r = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depths": "0,25,50,100,250,500,1000",
            "lat_min": -15.0,
            "lat_max": -5.0,
            "lon_min": 65.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "temperature"
    assert data["unit"] == "°C"
    assert len(data["slices"]) == 7
    # Check depth levels are preserved in order
    depths = [s["actual_depth"] for s in data["slices"]]
    assert depths[0] < 1.0  # surface ~0.49m
    assert any(abs(d - 1000.0) < 100.0 for d in depths)
    # Check dimensions
    assert data["width"] > 0
    assert data["height"] > 0
    for s in data["slices"]:
        assert len(s["values"]) == data["height"]
        assert len(s["values"][0]) == data["width"]
        assert s["min_value"] is not None
        assert s["max_value"] is not None


def test_step4_field_stack_salinity(client):
    """
    Step 4 test: Batch query salinity stack.
    """
    r = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "salinity",
            "time": "2026-01-10",
            "depths": "0,50,100,250",
            "lat_min": 0.0,
            "lat_max": 10.0,
            "lon_min": 70.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "salinity"
    assert data["unit"] == "PSU"
    assert len(data["slices"]) == 4


def test_step4_field_stack_chlorophyll(client):
    """
    Step 4 test: Batch query BGC chlorophyll stack across multiple depths.
    """
    r = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "chlorophyll",
            "time": "2026-02-15",
            "depths": "0,25,50,100",
            "lat_min": -10.0,
            "lat_max": 5.0,
            "lon_min": 60.0,
            "lon_max": 75.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "chlorophyll"
    assert data["unit"] == "mg/m³"
    assert len(data["slices"]) == 4


def test_step4_field_stack_currents(client):
    """
    Step 4 test: Batch query 3D currents stack returning both u and v components.
    """
    r = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "currents",
            "time": "2026-02-15",
            "depths": "0,25,50,100,250,500,1000",
            "lat_min": -15.0,
            "lat_max": -5.0,
            "lon_min": 65.0,
            "lon_max": 80.0,
            "stride": 2,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["variable"] == "currents"
    assert data["u_slices"] is not None
    assert data["v_slices"] is not None
    assert len(data["u_slices"]) == 7
    assert len(data["v_slices"]) == 7


def test_step4_field_stack_data_integrity_matches_single_field(client):
    """
    Step 4 test: Bit-for-bit exact match between single-depth endpoint and batch endpoint.
    """
    single_res = client.get(
        "/api/v1/model/field",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depth": 250.0,
            "lat_min": -10.0,
            "lat_max": 0.0,
            "lon_min": 65.0,
            "lon_max": 75.0,
            "stride": 2,
        },
    )
    assert single_res.status_code == 200
    single_data = single_res.json()

    stack_res = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depths": "0,250,500",
            "lat_min": -10.0,
            "lat_max": 0.0,
            "lon_min": 65.0,
            "lon_max": 75.0,
            "stride": 2,
        },
    )
    assert stack_res.status_code == 200
    stack_data = stack_res.json()

    # Find the 250m slice in the stack
    slice_250 = next(s for s in stack_data["slices"] if abs(s["requested_depth"] - 250.0) < 1.0)
    assert slice_250["actual_depth"] == single_data["depth"]
    assert stack_data["width"] == single_data["width"]
    assert stack_data["height"] == single_data["height"]
    assert slice_250["min_value"] == single_data["min_value"]
    assert slice_250["max_value"] == single_data["max_value"]
    assert slice_250["values"] == single_data["values"]


# ===========================================================================
# Step 5 Tests: Smart Spatial / Depth / Time / Variable Subsetting
# ===========================================================================

def test_step5_spatial_subsetting_small_vs_large(client):
    """
    Step 5 test: Verify small region (5x5 deg) retrieves significantly fewer cells than large region.
    """
    r_small = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depths": "0,250",
            "lat_min": 10.0,
            "lat_max": 15.0,
            "lon_min": 70.0,
            "lon_max": 75.0,
            "stride": 1,
        },
    )
    assert r_small.status_code == 200
    d_small = r_small.json()
    assert d_small["width"] == 61
    assert d_small["height"] == 61
    assert d_small["latitudes"][0] >= 10.0
    assert d_small["latitudes"][-1] <= 15.0
    assert d_small["longitudes"][0] >= 70.0
    assert d_small["longitudes"][-1] <= 75.0

    r_large = client.get(
        "/api/v1/model/field-stack",
        params={
            "variable": "temperature",
            "time": "2026-02-15",
            "depths": "0,250",
            "lat_min": -15.0,
            "lat_max": 15.0,
            "lon_min": 60.0,
            "lon_max": 95.0,
            "stride": 3,
        },
    )
    assert r_large.status_code == 200
    d_large = r_large.json()
    assert d_large["width"] == 141
    assert d_large["height"] == 121


def test_step5_depth_subsetting_configurations(client):
    """
    Step 5 test: Verify varying depth configurations (single, dual, quad, non-contiguous).
    """
    # 1. Single depth
    r1 = client.get("/api/v1/model/field-stack?variable=temperature&depths=0&stride=2")
    assert r1.status_code == 200
    assert len(r1.json()["slices"]) == 1

    # 2. Dual depth
    r2 = client.get("/api/v1/model/field-stack?variable=temperature&depths=0,25&stride=2")
    assert r2.status_code == 200
    assert len(r2.json()["slices"]) == 2

    # 3. Quad depth
    r3 = client.get("/api/v1/model/field-stack?variable=salinity&depths=0,25,50,100&stride=2")
    assert r3.status_code == 200
    assert len(r3.json()["slices"]) == 4

    # 4. Non-contiguous depths in specific order
    r4 = client.get("/api/v1/model/field-stack?variable=chlorophyll&depths=25,250,1000&stride=2")
    assert r4.status_code == 200
    slices = r4.json()["slices"]
    assert len(slices) == 3
    assert [s["requested_depth"] for s in slices] == [25.0, 250.0, 1000.0]


def test_step5_time_subsetting_dates(client):
    """
    Step 5 test: Verify time subsetting accesses specific dates accurately.
    """
    for target_date in ["2026-01-01", "2026-02-15", "2026-03-31"]:
        r = client.get(f"/api/v1/model/field-stack?variable=temperature&time={target_date}&depths=0&stride=4")
        assert r.status_code == 200
        assert r.json()["time"] == target_date


def test_step5_boundary_edge_cases(client):
    """
    Step 5 test: Verify queries near domain edges (North, South, East, West).
    """
    # Northern boundary
    r_n = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=28&lat_max=30&lon_min=50&lon_max=60&depths=0&stride=2")
    assert r_n.status_code == 200
    assert r_n.json()["width"] > 0 and r_n.json()["height"] > 0

    # Southern boundary
    r_s = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=-35&lat_max=-33&lon_min=50&lon_max=60&depths=0&stride=2")
    assert r_s.status_code == 200
    assert r_s.json()["width"] > 0 and r_s.json()["height"] > 0

    # Western boundary
    r_w = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=0&lat_max=5&lon_min=40&lon_max=43&depths=0&stride=2")
    assert r_w.status_code == 200
    assert r_w.json()["width"] > 0 and r_w.json()["height"] > 0

    # Eastern boundary
    r_e = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=0&lat_max=5&lon_min=97&lon_max=100&depths=0&stride=2")
    assert r_e.status_code == 200
    assert r_e.json()["width"] > 0 and r_e.json()["height"] > 0


def test_step5_invalid_bounding_box(client):
    """
    Step 5 test: Verify invalid degenerate bounding boxes return 400.
    """
    # Inverted lat
    r = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=15&lat_max=5&lon_min=60&lon_max=70&depths=0")
    assert r.status_code == 400

    # Inverted lon
    r2 = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=5&lat_max=15&lon_min=80&lon_max=70&depths=0")
    assert r2.status_code == 400

    # 0-area box
    r3 = client.get("/api/v1/model/field-stack?variable=temperature&lat_min=10&lat_max=10&lon_min=70&lon_max=70&depths=0")
    assert r3.status_code == 400


def test_step10_binary_field_content_negotiation(client):
    """
    Step 10 test: Verify content negotiation on /api/v1/model/field returning SD3D binary Float32.
    """
    import struct
    import json
    import numpy as np

    r = client.get(
        "/api/v1/model/field?variable=temperature&depth=0&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1",
        headers={"Accept": "application/octet-stream"},
    )
    assert r.status_code == 200
    assert "application/octet-stream" in r.headers.get("content-type", "")
    content = r.content
    assert len(content) > 16

    magic, version, fmt_type, meta_len, data_len = struct.unpack_from("<4sHHII", content, 0)
    assert magic == b"SD3D"
    assert version == 1
    assert fmt_type == 1

    meta_json = content[16 : 16 + meta_len].decode("utf-8")
    meta = json.loads(meta_json)
    assert meta["variable"] == "temperature"
    assert meta["width"] > 0 and meta["height"] > 0

    pad_len = (4 - (16 + meta_len) % 4) % 4
    data_offset = 16 + meta_len + pad_len
    assert data_offset % 4 == 0

    payload = np.frombuffer(content, dtype="<f4", offset=data_offset, count=data_len // 4)
    assert len(payload) == meta["width"] * meta["height"]


def test_step10_binary_field_stack_scalar(client):
    """
    Step 10 test: Verify multi-depth scalar field stack binary transport and numerical equivalence.
    """
    import struct
    import json
    import numpy as np

    # Fetch JSON
    r_json = client.get(
        "/api/v1/model/field-stack?variable=temperature&depths=0,50,100&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1",
        headers={"Accept": "application/json"},
    )
    assert r_json.status_code == 200
    json_data = r_json.json()

    # Fetch Binary
    r_bin = client.get(
        "/api/v1/model/field-stack?variable=temperature&depths=0,50,100&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1",
        headers={"Accept": "application/octet-stream"},
    )
    assert r_bin.status_code == 200
    content = r_bin.content

    magic, version, fmt_type, meta_len, data_len = struct.unpack_from("<4sHHII", content, 0)
    assert magic == b"SD3D"
    assert fmt_type == 2

    meta = json.loads(content[16 : 16 + meta_len].decode("utf-8"))
    assert meta["width"] == json_data["width"]
    assert meta["height"] == json_data["height"]
    assert len(meta["depths"]) == 3

    pad_len = (4 - (16 + meta_len) % 4) % 4
    data_offset = 16 + meta_len + pad_len
    payload = np.frombuffer(content, dtype="<f4", offset=data_offset, count=data_len // 4)

    expected_len = 3 * meta["height"] * meta["width"]
    assert len(payload) == expected_len

    # Compare first depth slice values
    s0_json = json_data["slices"][0]["values"]
    s0_flat = []
    for row in s0_json:
        s0_flat.extend([np.nan if v is None else v for v in row])
    s0_src = np.array(s0_flat, dtype=np.float64)
    s0_bin = payload[: meta["height"] * meta["width"]]

    mask = ~np.isnan(s0_src)
    assert np.all(np.isnan(s0_bin[~mask]))  # NaNs preserved
    max_diff = np.max(np.abs(s0_src[mask] - s0_bin[mask]))
    assert max_diff < 1e-5  # Within Float32 tolerance


def test_step10_binary_field_stack_currents(client):
    """
    Step 10 test: Verify currents (uo and vo components) multi-depth binary transport.
    """
    import struct
    import json
    import numpy as np

    r = client.get(
        "/api/v1/model/field-stack?variable=currents&depths=0,25&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1",
        headers={"Accept": "application/octet-stream"},
    )
    assert r.status_code == 200
    content = r.content

    magic, version, fmt_type, meta_len, data_len = struct.unpack_from("<4sHHII", content, 0)
    assert magic == b"SD3D"
    assert fmt_type == 3  # TYPE_STACK_CURRENTS

    meta = json.loads(content[16 : 16 + meta_len].decode("utf-8"))
    assert "u_slices" in meta and "v_slices" in meta

    pad_len = (4 - (16 + meta_len) % 4) % 4
    data_offset = 16 + meta_len + pad_len
    payload = np.frombuffer(content, dtype="<f4", offset=data_offset, count=data_len // 4)

    # Expected: 2 (u+v) * 2 depths * height * width
    expected_len = 2 * 2 * meta["height"] * meta["width"]
    assert len(payload) == expected_len


def test_step10_explicit_binary_endpoints(client):
    """
    Step 10 test: Verify explicit aliases /model/field-binary and /model/field-stack-binary.
    """
    r1 = client.get("/api/v1/model/field-binary?variable=salinity&depth=0&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1")
    assert r1.status_code == 200
    assert r1.content.startswith(b"SD3D")

    r2 = client.get("/api/v1/model/field-stack-binary?variable=chlorophyll&depths=0,50&lat_min=10&lat_max=15&lon_min=68&lon_max=73&stride=1")
    assert r2.status_code == 200
    assert r2.content.startswith(b"SD3D")


def test_step10_binary_gzip(client):
    """
    Step 10 test: Verify GZip middleware compresses binary responses appropriately.
    """
    r = client.get(
        "/api/v1/model/field-stack-binary?variable=temperature&depths=0,25,50,100,250,500,1000&lat_min=10&lat_max=25&lon_min=65&lon_max=80&stride=2",
        headers={"Accept-Encoding": "gzip"},
    )
    assert r.status_code == 200
    assert r.headers.get("content-encoding") == "gzip"


def test_cloud_anchor_interpolation_bounding_files():
    """
    Verify that in cloud environments without local full archives,
    intermediate dates (e.g. 2026-02-16) correctly resolve distinct bounding anchor
    files (2026-02-15 and 2026-03-01) with non-zero interpolation weight.
    """
    from pathlib import Path
    from backend.adapters.cmems_model import CMEMSModelAdapter

    adapter = CMEMSModelAdapter(Path("/tmp/nonexistent_test_cloud_dir"))
    f15, f15_B, alpha15 = adapter.resolve_bounding_files_and_weight("thetao", "2026-02-15")
    f16, f16_B, alpha16 = adapter.resolve_bounding_files_and_weight("thetao", "2026-02-16")
    f17, f17_B, alpha17 = adapter.resolve_bounding_files_and_weight("thetao", "2026-02-17")
    f01, f01_B, alpha01 = adapter.resolve_bounding_files_and_weight("thetao", "2026-03-01")

    assert Path(f15).name != Path(f01).name, "Anchor dates 15 Feb and 01 Mar must map to distinct files"
    assert Path(f16).name == Path(f15).name, "16 Feb anchor A must be 15 Feb"
    assert f16_B is not None and Path(f16_B).name == Path(f01).name, "16 Feb anchor B must be 01 Mar"
    assert 0.0 < alpha16 < alpha17 < 1.0, f"Alpha must increase monotonically (alpha16={alpha16}, alpha17={alpha17})"
    assert alpha01 == 0.0 and f01_B is None, "Exact anchor date 01 Mar must have alpha=0.0 and no file_B"






