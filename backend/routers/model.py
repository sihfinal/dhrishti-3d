from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.schemas.model import (
    ModelMetadataResponse,
    ModelTimesResponse,
    ModelDepthsResponse,
    ModelFieldResponse,
    ModelFieldStackResponse,
)
from backend.services.model_service import ModelService
from backend.serializers.binary import encode_binary_field_slice, encode_binary_field_stack

log = logging.getLogger(__name__)
router = APIRouter()

def _get_model_service(request: Request) -> ModelService:
    return request.app.state.model_service

@router.get("/health")
async def health() -> dict[str, str]:
    from datetime import datetime, timezone
    return {
        "status": "healthy",
        "version": "2.0.0-phase1",
        "service": "Sagar Netra 3D Real Data Backend",
        "utcTime": datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
    }

@router.get("/datasets")
async def list_datasets(request: Request) -> list[dict[str, Any]]:
    """List all available datasets in the platform."""
    ms = _get_model_service(request)
    meta = ms.get_metadata()
    return [
        {
            "id": "cmems-physics-bgc",
            "name": "Copernicus Marine Ocean Physics & Biogeochemistry",
            "type": "model",
            "source": "Copernicus Marine Service (CMEMS)",
            "format": "NetCDF-4",
            "variables": meta.get("variables", []),
            "time_coverage": meta.get("time_range", ()),
            "geographic_coverage": {
                "latitude": meta.get("latitude_range", ()),
                "longitude": meta.get("longitude_range", ()),
            },
        },
        {
            "id": "wod-argo",
            "name": "WOD / Argo Profiling Floats",
            "type": "observation",
            "source": "NOAA / WOD / GDAC",
            "format": "NetCDF-4 (DSG Ragged Array)",
            "variables": ["temperature", "salinity", "chlorophyll", "nitrate", "oxygen"],
        },
        {
            "id": "wod-glider",
            "name": "WOD Autonomous Underwater Gliders",
            "type": "observation",
            "source": "NOAA / WOD",
            "format": "NetCDF-4 (DSG Ragged Array)",
            "variables": ["temperature", "salinity", "chlorophyll", "oxygen"],
        },
        {
            "id": "wod-ctd",
            "name": "WOD Shipboard CTD Casts",
            "type": "observation",
            "source": "NOAA / WOD",
            "format": "NetCDF-4 / CSV",
            "variables": ["temperature", "salinity", "chlorophyll", "nitrate"],
        },
    ]

@router.get("/model/metadata", response_model=ModelMetadataResponse)
async def model_metadata(request: Request) -> Any:
    """Return model provenance, coordinates, and variables."""
    ms = _get_model_service(request)
    meta = ms.get_metadata()
    if not meta:
        raise HTTPException(status_code=404, detail="Model metadata not found")
    return meta

@router.get("/model/times", response_model=ModelTimesResponse)
async def model_times(request: Request) -> Any:
    """Return list of available model timestamps (YYYY-MM-DD)."""
    ms = _get_model_service(request)
    times = ms.get_times()
    return {
        "dataset_id": "cmems-daily",
        "count": len(times),
        "times": times,
    }

@router.get("/model/depths", response_model=ModelDepthsResponse)
async def model_depths(
    request: Request,
    variable: str = Query("temperature", description="Target model variable"),
) -> Any:
    """Return available discrete model depth levels in metres."""
    ms = _get_model_service(request)
    depths = ms.get_depths(variable)
    return {
        "dataset_id": "cmems-daily",
        "count": len(depths),
        "depths": depths,
        "unit": "m",
    }

@router.get("/model/field", response_model=ModelFieldResponse)
async def model_field(
    request: Request,
    variable: str = Query("temperature", description="Variable: temperature, salinity, u_velocity, v_velocity, chlorophyll"),
    time: str = Query("2026-02-15", description="Model date (YYYY-MM-DD)"),
    depth: float = Query(250.0, description="Depth level in metres"),
    lat_min: float = Query(-35.0, description="Minimum latitude"),
    lat_max: float = Query(30.0, description="Maximum latitude"),
    lon_min: float = Query(40.0, description="Minimum longitude"),
    lon_max: float = Query(100.0, description="Maximum longitude"),
    stride: int = Query(1, ge=1, le=10, description="Spatial subsampling stride"),
) -> Any:
    """Extract a lazy 2D spatial slice from real daily NetCDF datasets."""
    ms = _get_model_service(request)
    try:
        res = ms.get_field(
            variable=variable,
            date_str=time,
            depth=depth,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )
        accept = request.headers.get("Accept", "").lower()
        if "application/octet-stream" in accept:
            return Response(content=encode_binary_field_slice(res), media_type="application/octet-stream")
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching model field: {e}")
        raise HTTPException(status_code=500, detail="Error extracting model field slice")

@router.get("/model/field-stack", response_model=ModelFieldStackResponse)
async def model_field_stack(
    request: Request,
    variable: str = Query("temperature", description="Variable: temperature, salinity, currents, chlorophyll, u_velocity, v_velocity"),
    time: str = Query("2026-02-15", description="Model date (YYYY-MM-DD)"),
    depths: str = Query("0,25,50,100,250,500,1000", description="Comma-separated depth levels in metres"),
    lat_min: float = Query(-35.0, description="Minimum latitude"),
    lat_max: float = Query(30.0, description="Maximum latitude"),
    lon_min: float = Query(40.0, description="Minimum longitude"),
    lon_max: float = Query(100.0, description="Maximum longitude"),
    stride: int = Query(1, ge=1, le=10, description="Spatial subsampling stride"),
) -> Any:
    """Extract a batch of 2D spatial slices across multiple depths in a single optimized request."""
    # Parse depths list
    try:
        depth_list = [float(d.strip()) for d in depths.split(",") if d.strip()]
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed 'depths' parameter; expected comma-separated numbers.")

    if not depth_list:
        raise HTTPException(status_code=400, detail="'depths' parameter cannot be empty.")

    if lat_min >= lat_max or lon_min >= lon_max:
        raise HTTPException(status_code=400, detail="Invalid bounding box: min coordinates must be strictly less than max coordinates.")

    ms = _get_model_service(request)
    try:
        res = ms.get_field_stack(
            variable=variable,
            date_str=time,
            depths=depth_list,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )
        accept = request.headers.get("Accept", "").lower()
        if "application/octet-stream" in accept:
            return Response(content=encode_binary_field_stack(res), media_type="application/octet-stream")
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching model field stack: {e}")
        raise HTTPException(status_code=500, detail="Error extracting model field stack")

@router.get("/model/field-binary")
async def model_field_binary(
    request: Request,
    variable: str = Query("temperature", description="Variable: temperature, salinity, u_velocity, v_velocity, chlorophyll"),
    time: str = Query("2026-02-15", description="Model date (YYYY-MM-DD)"),
    depth: float = Query(250.0, description="Depth level in metres"),
    lat_min: float = Query(-35.0, description="Minimum latitude"),
    lat_max: float = Query(30.0, description="Maximum latitude"),
    lon_min: float = Query(40.0, description="Minimum longitude"),
    lon_max: float = Query(100.0, description="Maximum longitude"),
    stride: int = Query(1, ge=1, le=10, description="Spatial subsampling stride"),
) -> Response:
    """Extract a lazy 2D spatial slice in SD3D binary Float32 transport format."""
    ms = _get_model_service(request)
    try:
        res = ms.get_field(
            variable=variable,
            date_str=time,
            depth=depth,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )
        return Response(content=encode_binary_field_slice(res), media_type="application/octet-stream")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching model field binary: {e}")
        raise HTTPException(status_code=500, detail="Error extracting model field slice")

@router.get("/model/field-stack-binary")
async def model_field_stack_binary(
    request: Request,
    variable: str = Query("temperature", description="Variable: temperature, salinity, currents, chlorophyll, u_velocity, v_velocity"),
    time: str = Query("2026-02-15", description="Model date (YYYY-MM-DD)"),
    depths: str = Query("0,25,50,100,250,500,1000", description="Comma-separated depth levels in metres"),
    lat_min: float = Query(-35.0, description="Minimum latitude"),
    lat_max: float = Query(30.0, description="Maximum latitude"),
    lon_min: float = Query(40.0, description="Minimum longitude"),
    lon_max: float = Query(100.0, description="Maximum longitude"),
    stride: int = Query(1, ge=1, le=10, description="Spatial subsampling stride"),
) -> Response:
    """Extract a batch of 2D spatial slices in SD3D binary Float32 transport format."""
    try:
        depth_list = [float(d.strip()) for d in depths.split(",") if d.strip()]
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed 'depths' parameter; expected comma-separated numbers.")

    if not depth_list:
        raise HTTPException(status_code=400, detail="'depths' parameter cannot be empty.")

    if lat_min >= lat_max or lon_min >= lon_max:
        raise HTTPException(status_code=400, detail="Invalid bounding box: min coordinates must be strictly less than max coordinates.")

    ms = _get_model_service(request)
    try:
        res = ms.get_field_stack(
            variable=variable,
            date_str=time,
            depths=depth_list,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            stride=stride,
        )
        return Response(content=encode_binary_field_stack(res), media_type="application/octet-stream")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching model field stack binary: {e}")
        raise HTTPException(status_code=500, detail="Error extracting model field stack")

