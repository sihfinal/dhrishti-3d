"""
backend/main.py
---------------
FastAPI application entry point for the Sagar Netra 3D Real Data Backend.
Provides lazy-loaded CMEMS model APIs, WOD in-situ observation APIs, and Automated Ingestion Services.
"""
from __future__ import annotations

import gc
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.config import settings
from backend.services.model_service import ModelService
from backend.services.observation_service import ObservationService
from backend.services.ingestion_service import AutomatedIngestionService
from backend.services.comparison_service import ModelObservationComparisonService
from backend.services.wms_service import WMSService
from backend.services.wcs_service import WCSService
from backend.services.opendap_service import OpenDAPService
from backend.routers.model import router as model_router
from backend.routers.observations import router as obs_router
from backend.routers.ingestion import router as ingestion_router
from backend.routers.geospatial import router as geospatial_router
from backend.routers.comparison import router as comparison_router
from backend.routers.wms import router as wms_router
from backend.routers.wcs import router as wcs_router
from backend.routers.opendap import router as opendap_router, init_opendap_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("sagarnetra.backend")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("=== Sagar Netra 3D Backend — Real Data Engine Starting ===")
    # Support DATA_DIR env var for deployment dataset switching
    # Defaults to sagar-netra-deployment-data if present, else data/
    import os
    data_dir_env = os.environ.get("DATA_DIR") or settings.DATA_DIR
    if data_dir_env:
        data_dir = Path(data_dir_env).resolve()
        if not data_dir.is_absolute():
            data_dir = Path(__file__).resolve().parent.parent / data_dir_env
    else:
        deploy_dir = Path(__file__).resolve().parent.parent / "sagar-netra-deployment-data"
        full_dir = Path(__file__).resolve().parent.parent / "data"
        data_dir = deploy_dir if deploy_dir.exists() else full_dir
    incoming_dir = data_dir / "incoming"
    log.info("Authoritative datasets directory: %s", data_dir)
    log.info("Automated incoming directory: %s", incoming_dir)

    # Initialize Model and Observation Services lazily
    app.state.model_service = ModelService(data_dir)
    app.state.obs_service = ObservationService(data_dir)
    
    # Initialize Automated Ingestion Service
    app.state.ingestion_service = AutomatedIngestionService(
        incoming_dir=incoming_dir,
        obs_service=app.state.obs_service,
        auto_scan=True,
    )
    
    # Initialize Model vs Observation Comparison Service
    app.state.comparison_service = ModelObservationComparisonService(
        model_service=app.state.model_service,
        obs_service=app.state.obs_service,
    )

    # Initialize OGC Web Map Service (WMS) & Web Coverage Service (WCS) Engines
    app.state.wms_service = WMSService(app.state.model_service)
    app.state.wcs_service = WCSService(app.state.model_service)

    # Initialize OPeNDAP DAP 2.0 & THREDDS Scientific Data Service
    init_opendap_service(data_dir)
    app.state.opendap_service = OpenDAPService(data_dir)

    log.info("Model, Observation, Automated Ingestion, Comparison, WMS, WCS, and OPeNDAP services successfully initialized.")

    try:
        yield
    finally:
        log.info("Sagar Netra 3D Backend shutting down — closing cached NetCDF handles.")
        if hasattr(app.state, "model_service"):
            app.state.model_service.close()
        if hasattr(app.state, "obs_service"):
            app.state.obs_service.close()

app = FastAPI(
    title="Sagar Netra 3D Real Data API",
    description=(
        "Production backend serving real CMEMS numerical model archives, "
        "WOD in-situ observations (Argo, Gliders, CTD, BGC), automated ASCII/CSV/TSV ingestion, "
        "Model vs Observation comparisons, OGC Web Map Services (WMS 1.3.0/1.1.1), "
        "OGC Web Coverage Services (WCS 2.0.1/1.0.0), and OPeNDAP DAP 2.0 / THREDDS scientific data services."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# Step 2: HTTP Transport Compression (GZip)
app.add_middleware(
    GZipMiddleware,
    minimum_size=1400,
    compresslevel=6,
)

# Step 3: Production Memory Management Middleware
# Releases free heap pages back to the OS via glibc malloc_trim after heavy scientific requests
try:
    import ctypes
    _libc = ctypes.CDLL("libc.so.6")
    _malloc_trim = getattr(_libc, "malloc_trim", None)
except Exception:
    _malloc_trim = None

@app.middleware("http")
async def memory_management_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if any(p in path for p in ("/model/field", "/compare", "/ogc/", "/opendap/")):
        gc.collect(1)
        if _malloc_trim is not None:
            _malloc_trim(0)
    return response

cors_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.onrender\.com$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(model_router, prefix="/api/v1")
app.include_router(obs_router, prefix="/api/v1")
app.include_router(ingestion_router, prefix="/api/v1")
app.include_router(geospatial_router, prefix="/api/v1")
app.include_router(comparison_router, prefix="/api/v1")
app.include_router(wms_router, prefix="/api/v1")
app.include_router(wcs_router, prefix="/api/v1")
app.include_router(opendap_router, prefix="/api/v1/opendap")
app.include_router(opendap_router, prefix="/api/v1/thredds")
app.include_router(opendap_router, prefix="/opendap")
app.include_router(opendap_router, prefix="/thredds/dodsC")

@app.get("/")
async def root():
    return {
        "service": "Sagar Netra 3D Backend",
        "docs": "/docs",
        "health": "/api/v1/health",
        "datasets": "/api/v1/datasets",
        "ingestion_status": "/api/v1/ingestion/status",
        "comparison": "/api/v1/compare/model-observation",
        "wms": "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities",
        "wcs": "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities",
        "opendap_catalog": "/api/v1/opendap/catalog.xml",
        "opendap_datasets": "/api/v1/opendap/datasets",
    }
