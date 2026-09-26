"""
backend/routers/geospatial.py
-----------------------------
FastAPI router serving authoritative geospatial boundary layers for Sagar Netra 3D.
Provides Indian Exclusive Economic Zone (EEZ) GeoJSON data, boundary metadata, and spatial references.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

log = logging.getLogger("sagarnetra.geospatial")
router = APIRouter(prefix="/geospatial", tags=["Geospatial Layers"])

import os
data_dir_env = os.environ.get("DATA_DIR")
if data_dir_env:
    _base_dir = Path(data_dir_env)
    if not _base_dir.is_absolute():
        _base_dir = Path(__file__).resolve().parent.parent.parent / _base_dir
    _DATA_DIR = _base_dir / "geospatial"
else:
    _DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "geospatial"
_EEZ_FILE = _DATA_DIR / "india_eez.geojson"

_CACHED_EEZ: Dict[str, Any] | None = None


def _load_eez_data() -> Dict[str, Any]:
    global _CACHED_EEZ
    if _CACHED_EEZ is not None:
        return _CACHED_EEZ

    if not _EEZ_FILE.exists():
        # Fallback to public/data if not found
        fallback = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "india_eez.geojson"
        if fallback.exists():
            with open(fallback, "r", encoding="utf-8") as f:
                _CACHED_EEZ = json.load(f)
                return _CACHED_EEZ
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Indian EEZ geospatial dataset not found at {_EEZ_FILE}",
        )

    with open(_EEZ_FILE, "r", encoding="utf-8") as f:
        _CACHED_EEZ = json.load(f)
    return _CACHED_EEZ


@router.get("/india-eez", summary="Get Indian Exclusive Economic Zone (EEZ) GeoJSON")
async def get_india_eez() -> Dict[str, Any]:
    """
    Returns the authoritative GeoJSON FeatureCollection defining the Indian Exclusive Economic Zone (EEZ),
    including Mainland India & Lakshadweep and Andaman & Nicobar Islands maritime boundaries per UNCLOS.
    """
    try:
        return _load_eez_data()
    except Exception as exc:
        log.error("Failed to load Indian EEZ data: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/info", summary="Geospatial boundary metadata and citations")
async def get_geospatial_info() -> Dict[str, Any]:
    """
    Returns metadata regarding all geospatial boundary layers integrated into Sagar Netra 3D.
    """
    eez = _load_eez_data()
    meta = eez.get("metadata", {})
    features = eez.get("features", [])
    
    return {
        "title": meta.get("title", "Indian Exclusive Economic Zone (EEZ) Boundary"),
        "description": meta.get("description", "Official maritime boundary delimitation for Republic of India"),
        "source": meta.get("source", "Marine Regions (VLIZ) World EEZ Dataset v12 (MRGID 8480, 8333)"),
        "gazetteer_reference": meta.get("gazetteer_reference", "https://www.marineregions.org/gazetteer.php?id=8480"),
        "total_area_sq_km": meta.get("total_area_sq_km", 2323948),
        "crs": meta.get("crs", "EPSG:4326"),
        "regions": [
            {
                "id": f.get("id"),
                "mrgid": f.get("properties", {}).get("mrgid"),
                "name": f.get("properties", {}).get("geoname"),
                "territory": f.get("properties", {}).get("territory"),
                "area_km2": f.get("properties", {}).get("area_km2"),
                "gazetteer_url": f.get("properties", {}).get("gazetteer_url"),
            }
            for f in features
        ],
    }
