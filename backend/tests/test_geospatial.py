"""
backend/tests/test_geospatial.py
--------------------------------
Tests for Indian EEZ geospatial layers and API endpoints based on
Marine Regions (VLIZ) World EEZ dataset (MRGID 8480, 8333).
"""
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_get_india_eez_geojson():
    response = client.get("/api/v1/geospatial/india-eez")
    assert response.status_code == 200
    data = response.json()
    
    assert data.get("type") == "FeatureCollection"
    assert "metadata" in data
    assert "features" in data
    assert len(data["features"]) == 2
    
    # Check Mainland and Andaman features
    feature_ids = [f.get("id") for f in data["features"]]
    assert "MRGID-8480" in feature_ids
    assert "MRGID-8333" in feature_ids
    
    for f in data["features"]:
        geom = f.get("geometry", {})
        assert geom.get("type") in ("Polygon", "MultiPolygon")
        coords = geom.get("coordinates", [])
        assert len(coords) > 0
        
        # Verify valid coordinates in Indian Ocean domain
        if geom.get("type") == "Polygon":
            outer_ring = coords[0]
            assert len(outer_ring) > 20
            for pt in outer_ring:
                lon, lat = pt[0], pt[1]
                assert 60.0 <= lon <= 100.0
                assert 3.0 <= lat <= 26.0
        elif geom.get("type") == "MultiPolygon":
            for poly in coords:
                outer_ring = poly[0]
                assert len(outer_ring) > 5
                for pt in outer_ring:
                    lon, lat = pt[0], pt[1]
                    assert 60.0 <= lon <= 100.0
                    assert 3.0 <= lat <= 26.0


def test_get_geospatial_info():
    response = client.get("/api/v1/geospatial/info")
    assert response.status_code == 200
    info = response.json()
    
    assert "total_area_sq_km" in info
    assert info["total_area_sq_km"] >= 2300000
    assert len(info.get("regions", [])) == 2
    assert "source" in info
    assert "Marine Regions" in info["source"]
