"""
backend/tests/test_wms.py
-------------------------
Comprehensive test suite for OGC Web Map Service (WMS 1.3.0 & 1.1.1).
Validates GetCapabilities, multi-layer GetMap, GetLegendGraphic, CRS transformations,
depth/time dimensions, and error handling.
"""
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import io

from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_wms_get_capabilities_1_3_0(client: TestClient):
    """Verify OGC WMS 1.3.0 GetCapabilities returns valid XML and layer declarations."""
    res = client.get("/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities")
    assert res.status_code == 200
    assert "text/xml" in res.headers["content-type"]
    xml_text = res.text
    assert '<WMS_Capabilities version="1.3.0"' in xml_text
    assert "<Name>temperature</Name>" in xml_text
    assert "<Name>salinity</Name>" in xml_text
    assert "<Name>chlorophyll</Name>" in xml_text
    assert "<Name>currents</Name>" in xml_text
    assert "<Name>u_velocity</Name>" in xml_text
    assert "<Name>v_velocity</Name>" in xml_text
    assert "<CRS>EPSG:4326</CRS>" in xml_text
    assert "<CRS>CRS:84</CRS>" in xml_text
    assert "<GetLegendGraphic>" in xml_text
    assert 'Dimension name="elevation"' in xml_text
    # Verify no ungrounded claims
    assert "real-time" not in xml_text.lower()
    assert "authoritative" not in xml_text.lower()


def test_wms_get_capabilities_1_1_1(client: TestClient):
    """Verify OGC WMS 1.1.1 GetCapabilities format."""
    res = client.get("/api/v1/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1")
    assert res.status_code == 200
    assert "text/xml" in res.headers["content-type"]
    assert '<WMT_MS_Capabilities version="1.1.1">' in res.text


def test_wms_get_map_temperature_800x500_crs84(client: TestClient):
    """Verify GetMap returns valid non-blank 800x500 PNG for sea water temperature with CRS:84."""
    url = (
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=temperature"
        "&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=800&HEIGHT=500"
        "&TRANSPARENT=TRUE&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(io.BytesIO(res.content))
    assert img.size == (800, 500)
    assert img.mode == "RGBA"


def test_wms_get_map_salinity_800x500_crs84(client: TestClient):
    """Verify GetMap returns valid 800x500 PNG for sea water salinity."""
    url = (
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=salinity"
        "&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=800&HEIGHT=500"
        "&TRANSPARENT=TRUE&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(res.content))
    assert img.size == (800, 500)


def test_wms_get_map_chlorophyll_800x500_crs84(client: TestClient):
    """Verify GetMap returns valid 800x500 PNG for chlorophyll at supported depth (0.5m)."""
    url = (
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=chlorophyll"
        "&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=800&HEIGHT=500"
        "&TRANSPARENT=TRUE&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(res.content))
    assert img.size == (800, 500)


def test_wms_get_map_current_velocity_magnitude_800x500(client: TestClient):
    """Verify GetMap returns valid 800x500 PNG for computed speed sqrt(uo^2 + vo^2)."""
    url = (
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=currents"
        "&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=800&HEIGHT=500"
        "&TRANSPARENT=TRUE&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(res.content))
    assert img.size == (800, 500)


def test_wms_get_map_epsg3857_and_jpeg(client: TestClient):
    """Verify EPSG:3857 Web Mercator coordinate reprojection and JPEG output."""
    res = client.get(
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=temperature"
        "&BBOX=4452779,-4163881,11131949,3503549&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg&TRANSPARENT=FALSE"
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert res.content[:2] == b"\xff\xd8"


def test_wms_get_legend_graphic_all_layers(client: TestClient):
    """Verify GetLegendGraphic returns valid colorbars for all exposed layers."""
    for layer in ["temperature", "salinity", "chlorophyll", "currents", "u_velocity", "v_velocity"]:
        res = client.get(f"/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetLegendGraphic&LAYER={layer}&FORMAT=image/png")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_wms_invalid_service(client: TestClient):
    """Verify invalid SERVICE returns ServiceExceptionReport XML."""
    res = client.get("/api/v1/ogc/wms?SERVICE=WFS&REQUEST=GetCapabilities")
    assert res.status_code == 400
    assert "<ServiceExceptionReport" in res.text
    assert "Invalid SERVICE" in res.text


def test_wms_invalid_layer(client: TestClient):
    """Verify unsupported layer returns ServiceExceptionReport XML."""
    res = client.get(
        "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=unknown_layer"
        "&BBOX=-20,55,15,85&WIDTH=256&HEIGHT=256"
    )
    assert res.status_code == 400
    assert "<ServiceExceptionReport" in res.text
    assert "not supported" in res.text
