"""
backend/adapters/base.py
------------------------
Authoritative common abstract interface contract for all Sagar Netra 3D data adapters.

Supports:
  - BaseModelAdapter: Interface for 3D/4D gridded numerical model sources (e.g. CMEMS, INCOIS RSMC).
  - BaseObservationAdapter: Interface for in-situ profile observation platforms (e.g. WOD Argo, Gliders, CTD, BGC).
  - Legacy GriddedAdapter & ObservationAdapter maintained for backward compatibility.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


class BaseAdapter(ABC):
    """Shared root interface for all data adapters in the Sagar Netra 3D platform."""

    @property
    @abstractmethod
    def dataset_id(self) -> str:
        """Unique string identifier for this dataset (used in API routes)."""
        pass

    @abstractmethod
    def fetch_metadata(self) -> Dict[str, Any]:
        """Return a dict of metadata about the dataset (coordinates, variables, provenance)."""
        pass


class BaseModelAdapter(BaseAdapter):
    """
    Standard contract for numerical ocean model adapters.
    Guarantees lazy-loading, spatial subsetting, depth slicing, and metadata queries.
    """

    @abstractmethod
    def get_available_times(self) -> List[str]:
        """Return all available model timestamps as ISO-8601 strings (YYYY-MM-DD)."""
        pass

    @abstractmethod
    def get_available_depths(self, variable: str = "temperature") -> List[float]:
        """Return all available depth levels in metres for the specified variable."""
        pass

    @abstractmethod
    def get_field_slice(
        self,
        variable: str,
        date_str: str,
        depth: float,
        lat_min: float = -35.0,
        lat_max: float = 30.0,
        lon_min: float = 40.0,
        lon_max: float = 100.0,
        stride: int = 1,
    ) -> Dict[str, Any]:
        """Extract a 2-D spatial depth slice with bounding-box cropping and optional downsampling."""
        pass

    @abstractmethod
    def get_field_stack(
        self,
        variable: str,
        date_str: str,
        depths: List[float],
        lat_min: float = -35.0,
        lat_max: float = 30.0,
        lon_min: float = 40.0,
        lon_max: float = 100.0,
        stride: int = 1,
    ) -> Dict[str, Any]:
        """Extract a 3-D volume stack across multiple depth levels for 3D WebGL rendering."""
        pass

    def get_metadata(self) -> Dict[str, Any]:
        """Alias to fetch_metadata for service consistency."""
        return self.fetch_metadata()

    def close(self) -> None:
        """Release any open file handles or cache resources cleanly."""
        pass


class BaseObservationAdapter(BaseAdapter):
    """
    Standard contract for in-situ ocean observation adapters.
    Guarantees platform filtering, summary counts, and single-cast profile soundings.
    """

    @abstractmethod
    def get_counts(self) -> Dict[str, int]:
        """Return summary count of active observation platforms grouped by type."""
        pass

    @abstractmethod
    def get_observations(
        self,
        obs_type: Optional[str] = "all",
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 2000,
    ) -> List[Dict[str, Any]]:
        """Query observation platform positions filtered by bounding box and platform type."""
        pass

    @abstractmethod
    def get_profile(self, obs_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full depth-resolved multi-channel profile soundings for a specific observation ID."""
        pass

    def close(self) -> None:
        """Release any open NetCDF/file resources cleanly."""
        pass


# ── Backward-Compatibility Classes (Phase 1 legacy support) ──────────────────

class GriddedAdapter(BaseAdapter):
    """Legacy interface for adapters that serve 2-D gridded binary slices."""

    @abstractmethod
    def available_times(self) -> list[str]:
        """Return all available TIME coordinate values as ISO-8601 strings."""
        pass

    @abstractmethod
    def available_depths(self) -> list[float]:
        """Return all available DEPTH coordinate values in metres."""
        pass

    @abstractmethod
    def get_slice(
        self,
        variable: str,
        timestamp: str,
        depth: float,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        stride: int = 1,
    ) -> "SliceResult":
        """Lazy-load and return a quantized 2-D binary slice."""
        pass


class ObservationAdapter(BaseAdapter):
    """Legacy interface for observation adapters."""

    @abstractmethod
    def get_platforms(
        self,
        time_min: Optional[str] = None,
        time_max: Optional[str] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        """Return a list of observation platform dicts."""
        pass


@dataclass
class SliceResult:
    """
    Everything the router needs after a successful field slice.
    """
    data: bytes
    dtype: str
    scale: float
    offset: float
    fill_value: int
    global_min: float
    global_max: float
    actual_time: str
    actual_depth: float
    width: int
    height: int
