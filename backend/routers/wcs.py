"""
backend/routers/wcs.py
----------------------
FastAPI Router for OGC Web Coverage Service (WCS 2.0.1 / 1.0.0).
Exposes standard endpoints supporting GetCapabilities, DescribeCoverage, and GetCoverage requests.
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.services.wcs_service import WCSService, COVERAGE_CATALOG

log = logging.getLogger("sagardrishti.wcs.router")
router = APIRouter(tags=["OGC Web Coverage Service"])


def _get_wcs_service(request: Request) -> WCSService:
    if hasattr(request.app.state, "wcs_service"):
        return request.app.state.wcs_service
    if hasattr(request.app.state, "model_service"):
        ms = request.app.state.model_service
    else:
        from pathlib import Path
        from backend.services.model_service import ModelService
        data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        ms = ModelService(data_dir)
        request.app.state.model_service = ms
    svc = WCSService(ms)
    request.app.state.wcs_service = svc
    return svc


@router.get("/ogc/wcs")
@router.get("/wcs")
async def wcs_endpoint(
    request: Request,
    # Standard WCS parameters
    service: Optional[str] = Query(None, alias="SERVICE"),
    request_type: Optional[str] = Query(None, alias="REQUEST"),
    version: Optional[str] = Query(None, alias="VERSION"),
    coverage_id: Optional[str] = Query(None, alias="COVERAGEID"),
    coverage_id_alt: Optional[str] = Query(None, alias="COVERAGE_ID"),
    coverage_alt: Optional[str] = Query(None, alias="COVERAGE"),
    identifiers: Optional[str] = Query(None, alias="IDENTIFIERS"),
    subset: Optional[List[str]] = Query(None, alias="SUBSET"),
    bbox: Optional[str] = Query(None, alias="BBOX"),
    format_type: Optional[str] = Query(None, alias="FORMAT"),
    time_val: Optional[str] = Query(None, alias="TIME"),
    elevation: Optional[float] = Query(None, alias="ELEVATION"),
    depth: Optional[float] = Query(None, alias="DEPTH"),
    crs: Optional[str] = Query(None, alias="CRS"),
    output_crs: Optional[str] = Query(None, alias="OUTPUTCRS"),
) -> Response:
    """
    Unified OGC WCS 2.0.1 & 1.0.0 Gateway.
    Dispatches GetCapabilities, DescribeCoverage, and GetCoverage requests.
    """
    wcs_svc = _get_wcs_service(request)
    params = {k.upper(): v for k, v in request.query_params.items()}

    # Resolve core parameters
    svc = params.get("SERVICE") or service or "WCS"
    req = params.get("REQUEST") or request_type or ""
    ver = params.get("VERSION") or version or "2.0.1"

    # Validate SERVICE
    if svc.upper() != "WCS":
        xml_err = wcs_svc.make_service_exception_xml(
            "InvalidParameterValue",
            f"Invalid SERVICE '{svc}'. SagarDrishti-3D supports SERVICE=WCS."
        )
        return Response(content=xml_err, media_type="text/xml", status_code=400)

    # Dispatch: GetCapabilities
    if req.upper() == "GETCAPABILITIES":
        base_url = str(request.url).split("?")[0]
        xml_content = wcs_svc.get_capabilities_xml(base_url=base_url, version=ver)
        return Response(
            content=xml_content,
            media_type="text/xml; charset=utf-8",
            headers={"Content-Type": "text/xml; charset=utf-8"}
        )

    # Dispatch: DescribeCoverage
    elif req.upper() == "DESCRIBECOVERAGE":
        target_cov = (
            params.get("COVERAGEID")
            or params.get("COVERAGE_ID")
            or params.get("COVERAGE")
            or params.get("IDENTIFIERS")
            or coverage_id
            or coverage_id_alt
            or coverage_alt
            or identifiers
        )
        if not target_cov:
            cov_ids = list(COVERAGE_CATALOG.keys())
        else:
            cov_ids = [c.strip() for c in target_cov.split(",") if c.strip()]

        xml_content = wcs_svc.describe_coverage_xml(coverage_ids=cov_ids, version=ver)
        status_code = 400 if "ExceptionReport" in xml_content else 200
        return Response(
            content=xml_content,
            media_type="text/xml; charset=utf-8",
            status_code=status_code,
            headers={"Content-Type": "text/xml; charset=utf-8"}
        )

    # Dispatch: GetCoverage
    elif req.upper() == "GETCOVERAGE":
        target_cov = (
            params.get("COVERAGEID")
            or params.get("COVERAGE_ID")
            or params.get("COVERAGE")
            or coverage_id
            or coverage_id_alt
            or coverage_alt
        )
        if not target_cov:
            xml_err = wcs_svc.make_service_exception_xml(
                "MissingParameterValue", "Missing required COVERAGEID parameter for GetCoverage."
            )
            return Response(content=xml_err, media_type="text/xml", status_code=400)

        # Multi-query parameter parsing for SUBSET e.g. SUBSET=Lat(...)&SUBSET=Long(...)
        raw_subsets = request.query_params.getlist("SUBSET") or request.query_params.getlist("subset") or subset

        req_bbox = params.get("BBOX") or bbox
        req_format = params.get("FORMAT") or format_type or "application/x-netcdf"
        req_time = params.get("TIME") or time_val
        req_elevation = params.get("ELEVATION") or params.get("DEPTH") or elevation or depth or 0.5
        req_crs = params.get("OUTPUTCRS") or params.get("CRS") or crs or output_crs or "EPSG:4326"

        try:
            elev_float = float(req_elevation)
        except ValueError:
            elev_float = 0.5

        try:
            file_bytes, mime_type, filename = wcs_svc.get_coverage(
                coverage_id=target_cov,
                bbox=req_bbox,
                subset_params=raw_subsets,
                time_val=req_time,
                elevation=elev_float,
                format_type=req_format,
                crs=req_crs,
            )
            return Response(
                content=file_bytes,
                media_type=mime_type,
                headers={
                    "Content-Type": mime_type,
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Cache-Control": "public, max-age=3600",
                },
            )
        except ValueError as err:
            xml_err = wcs_svc.make_service_exception_xml("InvalidParameterValue", str(err))
            return Response(content=xml_err, media_type="text/xml", status_code=400)
        except Exception as err:
            log.exception("Unexpected error generating WCS GetCoverage: %s", err)
            xml_err = wcs_svc.make_service_exception_xml("InternalError", f"Failed to generate coverage: {str(err)}")
            return Response(content=xml_err, media_type="text/xml", status_code=500)

    else:
        xml_err = wcs_svc.make_service_exception_xml(
            "OperationNotSupported",
            f"Unsupported REQUEST '{req}'. Supported operations: GetCapabilities, DescribeCoverage, GetCoverage."
        )
        return Response(content=xml_err, media_type="text/xml", status_code=400)
