# Current Backend Audit

This document audits the current backend capabilities of the Sagar Netra 3D repository. It identifies which parts of the existing data ingestion, parsing, processing, and delivery layers can be reused, extended, or replaced in the upcoming FastAPI transition.

---

## 1. Audit Classification Summary

- ✅ **Keep**: Reusable as-is in the client or pipeline.
- 🟡 **Extend**: Fits the goal but needs modifications, parameters, or wrapping.
- 🔵 **Architecture only**: Kept only as a reference design for data contracts.
- ⚠️ **Replace**: Needs to be refactored or rewritten for FastAPI integration.
- ❌ **Missing**: Gaps that must be built from scratch.

---

## 2. Component Audits

### A. Python Ingestion Scripts (`ingest/`)

#### `fetch_woa.py` & `fetch_monthly_full.py`
- **Status**: 🟡 **Extend** / Wrap in FastAPI
- **What it does**: Fetches objectively analyzed climatological Temperature and Salinity arrays from NOAA NCEI WOA23 THREDDS OPeNDAP, crops them to the Indian Ocean ROI, extracts selected depth levels, and quantizes the values to `uint8` binaries.
- **Reusability**: High. The data-cropping and quantization logic is 100% correct.
- **FastAPI Wrapping**: These scripts should be wrapped as background tasks or run-on-demand services within FastAPI, triggering updates when a database reload or cache-refresh is requested.
- **Action**: Modify file-writing paths to write to a configured cache directory, and add arguments to target custom bounding boxes.

#### `fetch_hycom.py`
- **Status**: 🟡 **Extend** / Wrap in FastAPI
- **What it does**: Pulls live model currents (`water_u`, `water_v`) on 3 depth levels from the HYCOM GLBu0.08 operational THREDDS server, downsamples the grids, and writes interleaved `int8` currents vectors.
- **Reusability**: High. Slicing and vector interleaving logic is clean.
- **FastAPI Wrapping**: Wrap in a REST route `/api/v1/currents` that dynamically triggers the fetch for a user-specified datetime instead of querying static `time=0` slices.
- **Action**: Parametrize the time coordinate rather than hardcoding index 0.

#### `fetch_argo.py`, `fetch_glider.py` & `fetch_bgc.py`
- **Status**: 🟡 **Extend** / Wrap in FastAPI
- **What it does**: Queries Ifremer and IOOS Glider DAC ERDDAP servers over tabledap CSV. Downsamples vertical measurements to 120–200 points, translates datetime records to cycles, and structures them into profile models.
- **Reusability**: Very high. The parser cores are correct and reusable.
- **FastAPI Wrapping**: In the current system, files must be parsed and stored statically. Under FastAPI, these should be queryable dynamically via `/api/v1/observations` routes with time-range parameters, pulling and filtering ERDDAP values at runtime.
- **Action**: Wrap the ERDDAP network query inside a FastAPI service module, adding lat/lon and time queries as REST parameters.

#### `common.py` (quantization / manifest utils)
- **Status**: 🟡 **Extend**
- **What it does**: Shared python utilities for linear quantization, manifest writing, and ROI subset cropping.
- **Reusability**: High.
- **Action**: Remove static filesystem references (`public/data`) and parameterize data outputs.

#### `run_all.py` (manual orchestrator)
- **Status**: ⚠️ **Replace**
- **What it does**: Sequential console script to run WOA and profiles download tasks.
- **Action**: Replace with a FastAPI task scheduling system (e.g. using `BackgroundTasks` or Celery cron cycles).

---

### B. Data Storage (`public/data/`)

#### Gridded Binaries (`temp_annual.bin`, etc.)
- **Status**: 🔵 **Architecture only**
- **What it does**: Flat, quantized byte streams fetched by the browser.
- **Action**: Instead of committing large binary assets directly to git, the raw model files will reside in a private backend data cache folder. The FastAPI server will stream sliced binaries on-demand.

#### `manifest.json` & `profiles.json`
- **Status**: ⚠️ **Replace** / Extend
- **What it does**: Static file registries holding data parameters and profile observations.
- **Action**: In the new architecture, FastAPI will serve these dynamically via `/api/v1/manifest` and `/api/v1/profiles` endpoints. This allows live profile merging (such as injecting newly-arrived CTD or BGC readings) at runtime without rewriting static files in the repository.

---

### C. Frontend Client Layers (`src/lib/`)

#### `api.ts` (static fetcher)
- **Status**: 🟡 **Extend**
- **What it does**: Fetches JSON and binary resources from `/public/data`.
- **Action**: Update endpoints to query the FastAPI backend URL routes (e.g. `const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"`).

#### `fieldCache.ts` (binary caching)
- **Status**: ✅ **Keep**
- **What it does**: Memory-caches downloaded Uint8Array grids to prevent redundant fetches.
- **Action**: Retain as-is.

#### `validation.ts` (Assimilation Lens comparison)
- **Status**: ✅ **Keep** / 🟡 **Extend**
- **What it does**: Bilinear spatial interpolation and model-vs-observation error computation (RMSE, bias, max error) in the browser.
- **Action**: Keep the frontend client-side calculation to support instant chart rendering. Eventually, this logic can be duplicated on the server to compute region-wide assimilation error stats across thousands of profiles.

---

### D. Missing Backend Gaps (To Be Built)
- ❌ **FastAPI Server Entry Point**: Main app runner setting up routers, middleware, CORS, logging, and environment parsing.
- ❌ **Dynamic Route Handlers**: Endpoint parameters for subsets (`/api/v1/fields/slice?depth=100&var=temp_annual`).
- ❌ **Data Cache Store**: Cache directories or lightweight database (SQLite/PostgreSQL) to store platforms cycles and metadata.
- ❌ **Real-Time INCOIS Forecast Ingestion**: Adapters to fetch real model forecast fields from INCOIS RSMC or OPeNDAP services.
- ❌ **CTD Observation Adapter**: Parser to ingest CTD datasets from ERDDAP or regional agencies.
- ❌ **GIS Interoperability Engine**: Dynamic WMS/WCS servers to output coordinate grids for tools like QGIS and ArcGIS.
