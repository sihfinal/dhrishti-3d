"""
backend/routers/opendap.py
--------------------------
FastAPI router for OPeNDAP DAP 2.0 & THREDDS scientific data access endpoints.
Mounted at `/api/v1/opendap`, `/api/v1/thredds`, `/opendap`, and `/thredds`.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse as FastAPIHTMLResponse

from backend.services.opendap_service import OpenDAPService

log = logging.getLogger(__name__)

router = APIRouter(tags=["OPeNDAP / THREDDS Scientific Data Services"])

# Singleton service instance
_opendap_service: Optional[OpenDAPService] = None


def get_opendap_service() -> OpenDAPService:
    global _opendap_service
    if _opendap_service is None:
        import os
        data_dir_env = os.environ.get("DATA_DIR")
        if data_dir_env:
            data_dir = Path(data_dir_env)
            if not data_dir.is_absolute():
                data_dir = Path(__file__).resolve().parent.parent.parent / data_dir
        else:
            data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        _opendap_service = OpenDAPService(data_dir=data_dir)
    return _opendap_service


def init_opendap_service(data_dir: Path) -> None:
    global _opendap_service
    _opendap_service = OpenDAPService(data_dir=data_dir)


@router.get("/catalog.xml", summary="THREDDS Data Catalog XML")
async def get_thredds_catalog_xml(request: Request):
    """Returns standard THREDDS InvCatalog 1.0 XML describing all ocean model datasets."""
    service = get_opendap_service()
    base_url = str(request.base_url).rstrip("/") + "/api/v1/opendap"
    xml_content = service.generate_thredds_catalog_xml(service_base_url=base_url)
    return Response(content=xml_content, media_type="application/xml; charset=utf-8")


@router.get("/catalog.html", summary="THREDDS Data Catalog HTML")
@router.get("/catalog", summary="THREDDS Data Catalog HTML")
async def get_thredds_catalog_html(request: Request):
    """Returns user-friendly THREDDS catalog HTML browser page."""
    service = get_opendap_service()
    base_url = "/api/v1/opendap"
    html_content = service.generate_thredds_catalog_html(service_base_url=base_url)
    return FastAPIHTMLResponse(content=html_content)


@router.get("/datasets", summary="List Available OPeNDAP Datasets")
async def list_opendap_datasets():
    """List all available ocean model datasets configured for OPeNDAP access."""
    service = get_opendap_service()
    return {"status": "operational", "datasets": service.get_available_datasets()}


@router.get("/{dataset_id:path}", summary="OPeNDAP DAP 2.0 Dataset Handler")
async def handle_opendap_request(dataset_id: str, request: Request):
    """
    Standard OPeNDAP DAP 2.0 gateway supporting DDS, DAS, DODS, HTML, and ASCII responses.
    Compatible with Python xarray, netCDF4, MATLAB, R, GDAL, and QGIS.
    """
    service = get_opendap_service()
    clean_path = dataset_id.strip("/")
    
    # Catch catalog request if routed here
    if clean_path in ("catalog.xml", "catalog.html", "catalog"):
        if clean_path == "catalog.xml":
            base_url = str(request.base_url).rstrip("/") + "/api/v1/opendap"
            return Response(content=service.generate_thredds_catalog_xml(base_url), media_type="application/xml; charset=utf-8")
        else:
            return FastAPIHTMLResponse(content=service.generate_thredds_catalog_html("/api/v1/opendap"))

    # Determine DAP extension (.dds, .das, .dods, .html, .info, .ver)
    extension = ""
    target_id = clean_path
    for suf in [".dds", ".das", ".dods", ".html", ".info", ".ver", ".asc", ".ascii"]:
        if clean_path.endswith(suf):
            extension = suf
            target_id = clean_path[:-len(suf)]
            break

    # Security check: reject directory traversal attempts
    if ".." in target_id or target_id.startswith(("/", "\\")):
        raise HTTPException(status_code=400, detail="Invalid dataset identifier.")

    query_str = request.url.query
    content, status_code, headers = service.handle_dap_request(
        dataset_id=target_id,
        extension=extension,
        query_string=query_str,
        base_url="/api/v1/opendap",
    )

    return Response(
        content=content,
        status_code=status_code,
        headers=headers,
    )
