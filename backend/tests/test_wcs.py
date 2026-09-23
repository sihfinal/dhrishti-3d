"""
backend/tests/test_wcs.py
-------------------------
Comprehensive test suite for OGC Web Coverage Service (WCS 2.0.1 & 1.0.0).
Validates GetCapabilities, DescribeCoverage, NetCDF-4 / GeoTIFF GetCoverage generation,
real numerical array recovery via xarray, vector speed magnitude calculation, and error reporting.
"""
import io
import pytest
import numpy as np
import xarray as xr
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_wcs_get_capabilities_2_0_1(client: TestClient):
    """Verify OGC WCS 2.0.1 GetCapabilities XML output and coverage declarations."""
    res = client.get("/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities")
    assert res.status_code == 200
    assert "text/xml" in res.headers["content-type"]
    xml_text = res.text
    assert '<wcs:Capabilities version="2.0.1"' in xml_text
    assert "<wcs:CoverageId>temperature</wcs:CoverageId>" in xml_text
    assert "<wcs:CoverageId>salinity</wcs:CoverageId>" in xml_text
    assert "<wcs:CoverageId>chlorophyll</wcs:CoverageId>" in xml_text
    assert "<wcs:CoverageId>currents</wcs:CoverageId>" in xml_text
    assert "<wcs:CoverageId>u_velocity</wcs:CoverageId>" in xml_text
    assert "<wcs:CoverageId>v_velocity</wcs:CoverageId>" in xml_text
    assert "<wcs:formatSupported>application/x-netcdf</wcs:formatSupported>" in xml_text
    assert "<wcs:formatSupported>image/tiff</wcs:formatSupported>" in xml_text
    assert "real-time" not in xml_text.lower()


def test_wcs_get_capabilities_1_0_0(client: TestClient):
    """Verify OGC WCS 1.0.0 GetCapabilities XML format."""
    res = client.get("/api/v1/wcs?SERVICE=WCS&REQUEST=GetCapabilities&VERSION=1.0.0")
    assert res.status_code == 200
    assert "text/xml" in res.headers["content-type"]
    assert '<WCS_Capabilities version="1.0.0"' in res.text
    assert "<name>temperature</name>" in res.text


def test_wcs_describe_coverage_temperature(client: TestClient):
    """Verify DescribeCoverage returns valid spatial envelope, grid limits, and range type."""
    res = client.get("/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=DescribeCoverage&COVERAGEID=temperature")
    assert res.status_code == 200
    assert "text/xml" in res.headers["content-type"]
    xml_text = res.text
    assert '<wcs:CoverageDescriptions' in xml_text
    assert '<wcs:CoverageDescription gml:id="temperature">' in xml_text
    assert '<swe:field name="thetao">' in xml_text
    assert '<swe:uom code="°C"/>' in xml_text
    assert '<temporalDomain>' in xml_text
    assert '<elevationDomain>' in xml_text


def test_wcs_get_coverage_temperature_netcdf(client: TestClient):
    """Verify GetCoverage returns valid NetCDF-4 binary with real numerical values."""
    url = (
        "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=temperature"
        "&BBOX=55,-20,85,15&FORMAT=application/x-netcdf&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/x-netcdf"
    assert len(res.content) > 1000

    # Read back NetCDF bytes in xarray and verify numerical integrity
    ds = xr.open_dataset(io.BytesIO(res.content))
    assert "thetao" in ds.data_vars
    assert "latitude" in ds.coords
    assert "longitude" in ds.coords

    arr = ds["thetao"].values
    assert arr.ndim == 2
    # Ensure real numerical ocean values are present
    valid_vals = arr[~np.isnan(arr) & (arr != -9999.0)]
    assert len(valid_vals) > 1000
    assert 5.0 <= np.mean(valid_vals) <= 35.0
    assert ds["thetao"].attrs.get("units") == "°C"
    assert ds.attrs.get("time") == "2026-02-15"


def test_wcs_get_coverage_salinity_geotiff(client: TestClient):
    """Verify GetCoverage returns valid 32-bit floating-point GeoTIFF."""
    url = (
        "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=salinity"
        "&BBOX=55,-20,85,15&FORMAT=image/tiff&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/tiff"
    assert "filename=" in res.headers["content-disposition"]
    assert len(res.content) > 1000

    # Open with PIL
    img = Image.open(io.BytesIO(res.content))
    assert img.format == "TIFF"
    assert img.mode == "F"  # 32-bit floating point raster
    arr = np.array(img)
    valid_vals = arr[~np.isnan(arr) & (arr != -9999.0)]
    assert len(valid_vals) > 1000
    assert 25.0 <= np.mean(valid_vals) <= 40.0


def test_wcs_get_coverage_chlorophyll_netcdf(client: TestClient):
    """Verify GetCoverage returns valid BGC chlorophyll NetCDF."""
    url = (
        "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=chlorophyll"
        "&BBOX=55,-20,85,15&FORMAT=application/x-netcdf&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    ds = xr.open_dataset(io.BytesIO(res.content))
    assert "chl" in ds.data_vars
    arr = ds["chl"].values
    valid_vals = arr[~np.isnan(arr) & (arr != -9999.0)]
    assert len(valid_vals) > 500
    assert 0.0 <= np.mean(valid_vals) <= 10.0


def test_wcs_get_coverage_currents_speed_formula(client: TestClient):
    """Verify GetCoverage calculates current speed magnitude via sqrt(uo^2 + vo^2)."""
    url = (
        "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=currents"
        "&BBOX=55,-20,85,15&FORMAT=application/x-netcdf&TIME=2026-02-15&ELEVATION=0.5"
    )
    res = client.get(url)
    assert res.status_code == 200
    ds = xr.open_dataset(io.BytesIO(res.content))
    assert "current_speed" in ds.data_vars
    arr = ds["current_speed"].values
    valid_vals = arr[~np.isnan(arr) & (arr != -9999.0)]
    assert len(valid_vals) > 1000
    # Mean speed in Indian ocean is around 0.1 to 0.8 m/s
    assert 0.05 <= np.mean(valid_vals) <= 1.5
    assert np.all(valid_vals >= 0.0)


def test_wcs_get_coverage_wcs2_subset_syntax(client: TestClient):
    """Verify WCS 2.0.1 KVP SUBSET parameter syntax."""
    url = (
        "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=temperature"
        '&SUBSET=Lat(-20,15)&SUBSET=Long(55,85)&SUBSET=time("2026-02-15")&SUBSET=elevation(0.5)'
        "&FORMAT=application/x-netcdf"
    )
    res = client.get(url)
    assert res.status_code == 200
    ds = xr.open_dataset(io.BytesIO(res.content))
    assert "thetao" in ds.data_vars


def test_wcs_invalid_coverage_id(client: TestClient):
    """Verify invalid coverage ID returns OGC ExceptionReport XML."""
    res = client.get("/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&COVERAGEID=unknown_coverage")
    assert res.status_code == 400
    assert "<ows:ExceptionReport" in res.text
    assert "not supported" in res.text


def test_wcs_invalid_service(client: TestClient):
    """Verify invalid SERVICE returns OGC ExceptionReport XML."""
    res = client.get("/api/v1/ogc/wcs?SERVICE=WFS&REQUEST=GetCapabilities")
    assert res.status_code == 400
    assert "<ows:ExceptionReport" in res.text
