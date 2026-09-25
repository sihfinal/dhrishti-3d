"""
backend/schemas/unified.py
--------------------------
Unified data models and schemas for the extensible Sagar Netra 3D data architecture.
Enables normalization across multiple model and observation sources without altering raw numerical precision.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field


class UnifiedModelField(BaseModel):
    """
    Standardized internal representation of a 2D or 3D ocean numerical model slice.
    """
    variable: str = Field(..., description="Canonical variable name (e.g. temperature, salinity, currents, chlorophyll)")
    source: str = Field(..., description="Originating data source identifier (e.g. CMEMS, INCOIS-RSMC)")
    dataset_id: str = Field(..., description="Unique dataset identifier")
    time: str = Field(..., description="ISO-8601 date string (YYYY-MM-DD)")
    depth: float = Field(..., description="Depth level in metres")
    unit: str = Field(..., description="Standard physical measurement unit (e.g. °C, PSU, m/s, mg/m³)")
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    width: int = Field(..., description="Number of grid columns (longitude)")
    height: int = Field(..., description="Number of grid rows (latitude)")
    min_value: Optional[float] = Field(None, description="Minimum valid value in the domain")
    max_value: Optional[float] = Field(None, description="Maximum valid value in the domain")
    values: List[List[Optional[float]]] = Field(..., description="2D array of grid values (None = masked/land)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Source provenance and grid metadata")


class UnifiedProfilePoint(BaseModel):
    """
    Single depth-sounding level within an in-situ profile.
    """
    depth: float = Field(..., description="Sounding depth in metres")
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    chlorophyll: Optional[float] = None
    oxygen: Optional[float] = None
    nitrate: Optional[float] = None
    ph: Optional[float] = None
    turbidity: Optional[float] = None
    extra_channels: Dict[str, Optional[float]] = Field(default_factory=dict)


class UnifiedObservation(BaseModel):
    """
    Standardized internal representation of an in-situ ocean observation platform.
    """
    id: str = Field(..., description="Unique observation or profile identifier")
    source: str = Field(..., description="Originating data repository (e.g. NOAA/WOD, IFREMER, INCOIS)")
    observation_type: str = Field(..., description="Platform type (argo, glider, ctd, bgc, mooring, adcp, hf_radar)")
    latitude: float
    longitude: float
    time: Optional[str] = Field(None, description="ISO timestamp or date string")
    depth: Optional[float] = Field(None, description="Maximum sounding depth in metres")
    platform_id: Optional[str] = None
    profile_id: Optional[str] = None
    variables: List[str] = Field(default_factory=list, description="List of observed variables")
    qc: Optional[int] = Field(None, description="Overall quality control flag (0=No QC, 1=Good, 4=Bad)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Platform and cruise metadata")
    profile: Optional[List[UnifiedProfilePoint]] = Field(None, description="Optional vertical sounding points")


class UnifiedDatasetInfo(BaseModel):
    """
    Standardized dataset catalog descriptor.
    """
    id: str
    name: str
    type: str = Field(..., description="'model', 'observation', or 'derived'")
    source: str
    format: str
    variables: List[str] = Field(default_factory=list)
    time_coverage: Optional[Tuple[str, str]] = None
    geographic_coverage: Optional[Dict[str, Tuple[float, float]]] = None
    is_active: bool = True
    is_extension_ready: bool = False
