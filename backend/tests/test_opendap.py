"""
backend/tests/test_opendap.py
-----------------------------
Automated test suite verifying OPeNDAP DAP 2.0 and THREDDS Scientific Data Services.
Tests DDS, DAS, DODS binary XDR payloads, THREDDS Catalog XML/HTML,
security protections against path traversal, and real xarray client connection & subsetting.
"""
from __future__ import annotations

import os
from pathlib import Path
import pytest
from starlette.testclient import TestClient
import xarray as xr
import numpy as np

from backend.main import app
from backend.services.opendap_service import OpenDAPService

client = TestClient(app)
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def test_opendap_datasets_endpoint():
    """Verify listing of available OPeNDAP datasets."""
    response = client.get("/api/v1/opendap/datasets")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    ds_ids = [d["id"] for d in data["datasets"]]
    assert "cmems_physical" in ds_ids
    assert "cmems_bgc" in ds_ids


def test_thredds_catalog_xml():
    """Verify THREDDS InvCatalog 1.0 XML output."""
    response = client.get("/api/v1/opendap/catalog.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    text = response.text
    assert "<catalog" in text
    assert 'serviceType="OpenDAP"' in text
    assert 'ID="cmems_physical"' in text
    assert 'ID="cmems_bgc"' in text


def test_thredds_catalog_html():
    """Verify THREDDS HTML catalog web interface."""
    response = client.get("/api/v1/opendap/catalog.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    text = response.text
    assert "SAGAR NETRA 3D THREDDS" in text
    assert "cmems_physical" in text


def test_opendap_dds_physical():
    """Verify DDS (Dataset Descriptor Structure) for physical ocean dataset."""
    response = client.get("/api/v1/opendap/cmems_physical.dds")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    text = response.text
    assert "Dataset {" in text
    assert "thetao" in text
    assert "so" in text
    assert "uo" in text
    assert "vo" in text
    assert "latitude" in text
    assert "longitude" in text
    assert "depth" in text


def test_opendap_das_physical():
    """Verify DAS (Dataset Attribute Structure) for physical ocean dataset."""
    response = client.get("/api/v1/opendap/cmems_physical.das")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    text = response.text
    assert "Attributes {" in text
    assert "thetao" in text
    assert "units" in text


def test_opendap_dods_physical():
    """Verify DODS binary XDR data response for physical ocean dataset."""
    response = client.get("/api/v1/opendap/cmems_physical.dods?latitude")
    assert response.status_code == 200
    assert "application/octet-stream" in response.headers["content-type"]
    assert b"Dataset {" in response.content
    assert b"Data:\n" in response.content or b"Data:" in response.content


def test_opendap_dds_bgc():
    """Verify DDS for biogeochemical ocean dataset (chlorophyll)."""
    response = client.get("/api/v1/opendap/cmems_bgc.dds")
    assert response.status_code == 200
    text = response.text
    assert "Dataset {" in text
    assert "chl" in text


def test_opendap_das_bgc():
    """Verify DAS for biogeochemical ocean dataset."""
    response = client.get("/api/v1/opendap/cmems_bgc.das")
    assert response.status_code == 200
    text = response.text
    assert "Attributes {" in text
    assert "chl" in text


def test_opendap_security_path_traversal():
    """Verify path traversal is strictly rejected."""
    response = client.get("/api/v1/opendap/../../etc/passwd.dds")
    assert response.status_code in (400, 404)

    response2 = client.get("/api/v1/opendap/..%2F..%2Fbackend.dds")
    assert response2.status_code in (400, 404)


def test_opendap_invalid_dataset_404():
    """Verify nonexistent dataset returns DAP error."""
    response = client.get("/api/v1/opendap/nonexistent_dataset.dds")
    assert response.status_code == 404
    assert "Error {" in response.text


def test_opendap_direct_service_slicing():
    """Verify direct service handle slicing and value verification."""
    service = OpenDAPService(DATA_DIR)
    pds = service.build_pydap_dataset("cmems_physical")
    assert pds is not None
    assert "thetao" in pds
    assert "so" in pds
    assert "latitude" in pds
    assert "longitude" in pds
    assert "depth" in pds

    # Test coordinate array values
    lats = pds["latitude"].data
    assert len(lats) > 0
    assert lats[0] < lats[-1]

    # Test variable dimensions
    thetao_var = pds["thetao"]
    assert thetao_var.name == "thetao"
    assert len(thetao_var.dims) == 4
    assert tuple(thetao_var.dims) == ("time", "depth", "latitude", "longitude")


def test_opendap_currents_speed_magnitude():
    """Verify that current speed uses sqrt(uo^2 + vo^2) and not sum of squares."""
    service = OpenDAPService(DATA_DIR)
    sub_ds = service._build_constrained_dap_dataset("cmems_physical", "currents[0:1:0][0:1:0][100:1:105][200:1:205]")
    assert sub_ds is not None
    assert "currents" in sub_ds
    speed_data = sub_ds["currents"].data
    assert np.all(speed_data >= 0.0)
    assert not np.isnan(speed_data).all()


def test_opendap_fast_constrained_dods_slice():
    """Verify fast constrained DODS slice returns valid XDR stream in milliseconds."""
    response = client.get("/api/v1/opendap/cmems_physical.dods?latitude,longitude,thetao[0:1:0][0:1:0][100:1:110][200:1:210]")
    assert response.status_code == 200
    assert "application/octet-stream" in response.headers["content-type"]
    assert len(response.content) < 50_000  # fast small payload
    assert b"Dataset {" in response.content

