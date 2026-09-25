# Phase 1 Implementation Scope

This document defines the strict, restricted boundary for **Phase 1** of the Sagar Netra 3D backend implementation. It lists the exact scope limits, file creations, and code modifications.

---

## 1. Phase 1 Scope Boundary

### **IN SCOPE**
- **Real INCOIS RSMC File Integration**: Slices the local sample NetCDF file **`RSMC_hycom_20260830.nc`** containing real coordinates and parameters:
  * Coordinates: `TIME`, `DEPTH`, `LAT`, `LON` (preserving native depth coordinates instead of forcing legacy grids)
  * Variables: `TEMP`, `SALN`, `UVEL`, `VVEL`
- **Dynamic Extent Validation**: Slicing endpoints validate query coordinates (`latitude_min`/`max`, `longitude_min`/`max`) dynamically against the local NetCDF dataset extents rather than hardcoding a fixed region.
- **Lazy Slicing**: Using `xarray.open_dataset` with chunk configurations to load metadata only, loading cell indices on demand to minimize RAM footprint.
- **FastAPI Core**: A running API server exposing endpoints `/health`, `/datasets`, `/datasets/{id}/metadata`, `/model/times`, `/model/depths`, and `/model/field` on port 8000.
- **On-the-fly Quantization**: Dynamically scaling sliced data grids to `uint8` (`TEMP`, `SALN`) and `int8` (`UVEL`, `VVEL`) buffers, returning headers (`X-Scale`, `X-Offset`, `X-Actual-Time`, `X-Actual-Depth`, etc.) to inform the client.
- **CORS Handling**: Allowing connections from Next.js (`localhost:3000`).

### **OUT OF SCOPE** (Wait for later phases)
- SQLite database tables and cache records management (designed now, postponed to later phases).
- Ingesting Conductivity-Temperature-Depth (CTD) observations.
- Ingesting real Biogeochemical (BGC) observations (chlorophyll, dissolved oxygen, pH, etc.).
- Continuous automated cron pipeline routines.
- GIS Interoperability services (OGC WMS / WCS standards).

---

## 2. Model Source Migration (HYCOM to INCOIS RSMC)

- **Legacy/Fallback Source**: The existing HYCOM Consortium current-only ingestion (`currents.bin` from `fetch_hycom.py`) is deprecated and remains only as a temporary static fallback in the `/public/data` folder.
- **Primary Source**: Phase 1 transitions entirely to the **INCOIS RSMC operational model** using the uppercase variables specified above.

---

## 3. Phase 1 Files to Create & Modify

### A. New Files to Create inside `/backend/`
1. **`/backend/requirements.txt`**: Declares dependencies (`fastapi`, `uvicorn`, `xarray`, `numpy`, `netcdf4`, `pydantic-settings`).
2. **`/backend/config.py`**: Configures port numbers, folders, and CORS policies via pydantic-settings.
3. **`/backend/adapters/base.py`**: Defines base adapter class structures.
4. **`/backend/adapters/incois_rsmc.py`**: Reads the local sample NetCDF file `RSMC_hycom_20260830.nc`, maps uppercase coordinates, and extracts dynamic 2D array slices.
5. **`/backend/routers/model.py`**: Route handlers for `/times`, `/depths`, and `/field`.
6. **`/backend/main.py`**: Mounts routers, enables CORS middleware, and boots the Uvicorn server.

### B. Existing Files to Modify inside `/src/`
1. **`src/lib/api.ts`**:
   - Update `fetchManifest`, `fetchFieldBinary`, and `fetchProfiles` to query `process.env.NEXT_PUBLIC_API_URL` when configured.
   - Retain static file fallbacks to protect the frontend.
