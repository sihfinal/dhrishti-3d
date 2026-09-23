"""
backend/routers/ingestion.py
----------------------------
Lightweight FastAPI router providing ingestion observability:
  - GET /api/v1/ingestion/status: Live telemetry on automated ingestion pipeline.
  - POST /api/v1/ingestion/scan: Trigger on-demand scan of the incoming data directory.
"""
from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Request

log = logging.getLogger(__name__)
router = APIRouter()


def _get_ingestion_service(request: Request):
    if not hasattr(request.app.state, "ingestion_service"):
        raise HTTPException(status_code=503, detail="Automated Ingestion Service not initialized")
    return request.app.state.ingestion_service


@router.get("/ingestion/status")
async def ingestion_status(request: Request) -> Dict[str, Any]:
    """Retrieve live status, supported formats, and file statistics of the automated ingestion subsystem."""
    svc = _get_ingestion_service(request)
    return svc.get_status()


@router.post("/ingestion/scan")
async def trigger_ingestion_scan(request: Request) -> Dict[str, Any]:
    """Trigger an on-demand scan of the incoming directory (data/incoming/) for newly dropped datasets."""
    svc = _get_ingestion_service(request)
    jobs = svc.scan_incoming_directory()
    return {
        "status": "success",
        "scanned_jobs_count": len(jobs),
        "ingestion_summary": svc.get_status(),
    }
