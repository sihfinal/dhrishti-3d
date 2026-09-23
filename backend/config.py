"""
backend/config.py
-----------------
Pydantic-settings configuration for the SagarDrishti-3D Phase 1 backend.

All values can be overridden via environment variables or a .env file placed
inside the `backend/` directory (or the project root).
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS: Next.js dev server origins that are allowed to call the API.
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    # ── Data paths ────────────────────────────────────────────────────────────
    # Path to the authoritative Phase-1 development NetCDF.
    # Override with the real 11 GB file path in production:
    #   RSMC_NETCDF_PATH=/data/RSMC_hycom_20260830.nc
    RSMC_NETCDF_PATH: Path = Path(
        r"C:\Users\KumarShiva\Downloads\sih\RSMC_hycom_20260830.nc"
    )

    # Local cache directory for pre-sliced 2D binary tiles.
    # Prevents re-slicing the same request twice.
    CACHE_DIR: Path = Path(__file__).resolve().parent / "cache"

    # Maximum grid nodes per request (width × height).
    # Requests exceeding this are rejected with HTTP 413.
    # Integration with the frontend ROI (−35…30°N, 40…100°E) at stride=2
    # produces ~280 K nodes per slice.  Set ceiling well above that.
    MAX_GRID_NODES: int = 2_000_000


# Singleton — import this everywhere instead of constructing a new instance.
settings = Settings()
