"""
backend/routers/wms.py
----------------------
FastAPI Router for OGC Web Map Service (WMS 1.3.0 / 1.1.1).
Exposes standard endpoints supporting GetCapabilities and GetMap requests.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.services.wms_service import WMSService, LAYER_CATALOG

log = logging.getLogger("sagardrishti.wms.router")
router = APIRouter(tags=["OGC Web Map Service"])


def _get_wms_service(request: Request) -> WMSService:
    if hasattr(request.app.state, "wms_service"):
        return request.app.state.wms_service
    if hasattr(request.app.state, "model_service"):
        ms = request.app.state.model_service
    else:
        from pathlib import Path
        from backend.services.model_service import ModelService
        data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        ms = ModelService(data_dir)
        request.app.state.model_service = ms
    svc = WMSService(ms)
    request.app.state.wms_service = svc
    return svc


@router.get("/ogc/wms")
@router.get("/wms")
async def wms_endpoint(
    request: Request,
    # Common WMS parameters (case-insensitive query parsing supported)
    service: Optional[str] = Query(None, alias="SERVICE"),
    request_type: Optional[str] = Query(None, alias="REQUEST"),
    version: Optional[str] = Query(None, alias="VERSION"),
    layers: Optional[str] = Query(None, alias="LAYERS"),
    styles: Optional[str] = Query(None, alias="STYLES"),
    crs: Optional[str] = Query(None, alias="CRS"),
    srs: Optional[str] = Query(None, alias="SRS"),
    bbox: Optional[str] = Query(None, alias="BBOX"),
    width: Optional[int] = Query(None, alias="WIDTH"),
    height: Optional[int] = Query(None, alias="HEIGHT"),
    format_type: Optional[str] = Query(None, alias="FORMAT"),
    transparent: Optional[str] = Query(None, alias="TRANSPARENT"),
    time_val: Optional[str] = Query(None, alias="TIME"),
    elevation: Optional[float] = Query(None, alias="ELEVATION"),
    depth: Optional[float] = Query(None, alias="DEPTH"),
) -> Response:
    """
    Unified OGC WMS 1.3.0 & 1.1.1 Gateway.
    Dispatches GetCapabilities and GetMap requests with standard exception handling.
    """
    wms_svc = _get_wms_service(request)
    params = {k.upper(): v for k, v in request.query_params.items()}

    # Resolve core parameters with fallback for lowercase/mixed-case
    svc = params.get("SERVICE") or service or "WMS"
    req = params.get("REQUEST") or request_type or ""
    ver = params.get("VERSION") or version or "1.3.0"

    # Validate SERVICE
    if svc.upper() != "WMS":
        xml_err = wms_svc.make_service_exception_xml(
            "InvalidParameterValue",
            f"Invalid SERVICE '{svc}'. SagarDrishti-3D supports SERVICE=WMS."
        )
        return Response(content=xml_err, media_type="text/xml", status_code=400)

    # Dispatch: GetCapabilities
    if req.upper() == "GETCAPABILITIES":
        base_url = str(request.url).split("?")[0]
        xml_content = wms_svc.get_capabilities_xml(base_url=base_url, version=ver)
        return Response(
            content=xml_content,
            media_type="text/xml; charset=utf-8",
            headers={"Content-Type": "text/xml; charset=utf-8"}
        )

    # Dispatch: GetMap
    elif req.upper() == "GETMAP":
        req_layers = params.get("LAYERS") or layers
        req_bbox = params.get("BBOX") or bbox
        req_width = params.get("WIDTH") or width
        req_height = params.get("HEIGHT") or height
        req_crs = params.get("CRS") or params.get("SRS") or crs or srs or "EPSG:4326"
        req_format = params.get("FORMAT") or format_type or "image/png"
        req_transparent = params.get("TRANSPARENT") or transparent or "TRUE"
        req_time = params.get("TIME") or time_val
        req_elevation = params.get("ELEVATION") or params.get("DEPTH") or elevation or depth or 0.0

        if not req_layers:
            xml_err = wms_svc.make_service_exception_xml(
                "MissingParameterValue", "Missing required LAYERS parameter for GetMap."
            )
            return Response(content=xml_err, media_type="text/xml", status_code=400)

        if not req_bbox:
            xml_err = wms_svc.make_service_exception_xml(
                "MissingParameterValue", "Missing required BBOX parameter for GetMap."
            )
            return Response(content=xml_err, media_type="text/xml", status_code=400)

        try:
            w_int = int(req_width) if req_width else 512
            h_int = int(req_height) if req_height else 512
        except ValueError:
            xml_err = wms_svc.make_service_exception_xml(
                "InvalidParameterValue", "WIDTH and HEIGHT must be valid integers."
            )
            return Response(content=xml_err, media_type="text/xml", status_code=400)

        try:
            elev_float = float(req_elevation)
        except ValueError:
            elev_float = 0.0

        is_trans = str(req_transparent).upper() in ["TRUE", "1", "YES"]

        try:
            img_bytes, media_type = wms_svc.render_map(
                layer_name=req_layers,
                bbox_str=req_bbox,
                width=w_int,
                height=h_int,
                crs=req_crs,
                version=ver,
                format_type=req_format,
                transparent=is_trans,
                time_val=req_time,
                elevation=elev_float,
            )
            return Response(
                content=img_bytes,
                media_type=media_type,
                headers={
                    "Content-Type": media_type,
                    "Cache-Control": "public, max-age=3600",
                },
            )
        except ValueError as err:
            xml_err = wms_svc.make_service_exception_xml("InvalidParameterValue", str(err))
            return Response(content=xml_err, media_type="text/xml", status_code=400)
        except Exception as err:
            log.exception("Unexpected error rendering WMS GetMap: %s", err)
            xml_err = wms_svc.make_service_exception_xml("InternalError", f"Failed to render layer: {str(err)}")
            return Response(content=xml_err, media_type="text/xml", status_code=500)

    # Dispatch: GetLegendGraphic
    elif req.upper() == "GETLEGENDGRAPHIC":
        req_layer = params.get("LAYER") or params.get("LAYERS") or layers or "temperature"
        req_format = params.get("FORMAT") or format_type or "image/png"
        req_width = params.get("WIDTH") or width or 160
        req_height = params.get("HEIGHT") or height or 40
        try:
            w_int = int(req_width)
            h_int = int(req_height)
        except ValueError:
            w_int, h_int = 160, 40

        try:
            img_bytes, media_type = wms_svc.render_legend_graphic(
                layer_name=req_layer,
                width=w_int,
                height=h_int,
                format_type=req_format,
            )
            return Response(
                content=img_bytes,
                media_type=media_type,
                headers={"Content-Type": media_type, "Cache-Control": "public, max-age=86400"},
            )
        except Exception as err:
            log.exception("Unexpected error rendering WMS GetLegendGraphic: %s", err)
            xml_err = wms_svc.make_service_exception_xml("InternalError", f"Failed to render legend: {str(err)}")
            return Response(content=xml_err, media_type="text/xml", status_code=500)

    else:
        xml_err = wms_svc.make_service_exception_xml(
            "OperationNotSupported",
            f"Unsupported REQUEST '{req}'. Supported operations: GetCapabilities, GetMap, GetLegendGraphic."
        )
        return Response(content=xml_err, media_type="text/xml", status_code=400)
