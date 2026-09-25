"""
backend/routers/comparison.py
-----------------------------
FastAPI router for scientific Model vs Observation comparisons.
Exposes endpoints to compare vertical profiles between real in-situ soundings (Argo, Gliders, CTD, BGC)
and Copernicus Marine (CMEMS) gridded numerical model predictions.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status

log = logging.getLogger("sagarnetra.comparison_router")
router = APIRouter(prefix="/compare", tags=["Model vs Observation Comparison"])


@router.get("/model-observation", summary="Compare in-situ observation profile with numerical ocean model")
async def compare_model_observation(
    request: Request,
    obs_id: str = Query(..., description="Unique observation sounding ID (e.g., argo_19770705)"),
    variable: str = Query("temperature", description="Target variable to compare (temperature, salinity, chlorophyll)"),
    model_date: Optional[str] = Query(None, description="Optional target model date (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """
    Retrieves the in-situ observation sounding and matches the numerical model output at the nearest
    spatial coordinates, depth levels, and temporal slice. Calculates layer-by-layer residuals
    (Observation - Model) and statistical metrics (MAE, RMSD, Mean Bias).
    """
    comp_service = getattr(request.app.state, "comparison_service", None)
    if comp_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model vs Observation comparison service is not initialized.",
        )

    try:
        result = comp_service.compare_profile(
            obs_id=obs_id,
            variable=variable,
            model_date=model_date,
        )
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except FileNotFoundError as fnf_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(fnf_err),
        )
    except Exception as exc:
        log.error("Comparison error for observation %s: %s", obs_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error processing comparison: {exc}",
        )
