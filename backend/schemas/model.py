from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel

class ModelMetadataResponse(BaseModel):
    id: str
    name: str
    source: str
    product: str
    variables: list[str]
    variable_mappings: dict[str, str]
    units: dict[str, str]
    latitude_range: tuple[float, float]
    longitude_range: tuple[float, float]
    depth_range: tuple[float, float]
    time_range: tuple[str, str]
    file_count: int
    grid: dict[str, Any]

class ModelTimesResponse(BaseModel):
    dataset_id: str
    count: int
    times: list[str]

class ModelDepthsResponse(BaseModel):
    dataset_id: str
    count: int
    depths: list[float]
    unit: str

class ModelFieldResponse(BaseModel):
    variable: str
    time: str
    depth: float
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    width: int
    height: int
    latitudes: list[float]
    longitudes: list[float]
    values: list[list[Optional[float]]]
    min_value: Optional[float]
    max_value: Optional[float]
    unit: str

class ModelFieldSlice(BaseModel):
    depth: float
    requested_depth: float
    actual_depth: float
    values: list[list[Optional[float]]]
    min_value: Optional[float]
    max_value: Optional[float]

class ModelFieldStackResponse(BaseModel):
    variable: str
    time: str
    depths: list[float]
    requested_depths: list[float]
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    width: int
    height: int
    latitudes: list[float]
    longitudes: list[float]
    unit: str
    slices: list[ModelFieldSlice] = []
    u_slices: Optional[list[ModelFieldSlice]] = None
    v_slices: Optional[list[ModelFieldSlice]] = None

