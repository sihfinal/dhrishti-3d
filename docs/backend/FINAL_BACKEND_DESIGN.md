# Final Backend Design

This document outlines the corrected dynamic runtime architecture for the Sagar Netra 3D FastAPI backend. It details the transition from the legacy static system to a live FastAPI runtime server with a filesystem-backed cache/archive.

---

## 1. Upstream Data Source & Programmatic Access Catalog

For every dataset, the exact endpoint, dataset ID, protocol, and parameters are detailed. If any parameter cannot be directly verified, it is marked **UNKNOWN / TO BE VERIFIED** to prevent assumptions during development.

| Upstream Source | Official Public Endpoint | Exact Dataset ID | Protocol / API Type | Relevant Variables | Authentication |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. INCOIS RSMC** | `https://las.incois.gov.in/thredds/dodsC/las/` | `UNKNOWN / TO BE VERIFIED` (Dynamic forecast run indices) | OPeNDAP | `TEMP`, `SALN`, `UVEL`, `VVEL` | None (Public) |
| **2. INCOIS ERDDAP** | `https://erddap.incois.gov.in/erddap/` | `Indian_ARGO_Floats` | REST tabledap | `pres`, `temp`, `psal` | None (Public) |
| **3. IOOS Glider ERDDAP** | `https://gliders.ioos.us/erddap/` | Dynamic index query (e.g. `ru29-20161105T0131`) | REST tabledap | `depth`, `temperature`, `salinity` | None (Public) |
| **4. Argo GDAC (Raw)** | `https://data-argo.ifremer.fr/` | FTP/HTTPS indices (e.g. `dac/`, `geo/`) | FTP / HTTPS File Stream | `PRES`, `TEMP`, `PSAL` | None (Public) |
| **5. Ifremer ERDDAP (Argo)** | `https://erddap.ifremer.fr/erddap/` | `ArgoFloats` | REST tabledap | `pres`, `temp`, `psal` | None (Public) |
| **6. Real BGC-Argo** | `https://erddap.ifremer.fr/erddap/` | `UNKNOWN / TO BE VERIFIED` | REST tabledap | `pres`, `chla`, `doxy`, `nitrate` | None (Public) |
| **7. Synthetic BGC (Legacy)**| `https://erddap.ifremer.fr/erddap/` | `ArgoFloats-synthetic-BGC` | REST tabledap | `pres`, `chla` | None (Public) (Label: Synthetic Only) |
| **8. NCEI WOD (CTD)** | `https://www.ncei.noaa.gov/products/world-ocean-database` | `UNKNOWN / TO BE VERIFIED` | Official WOD selection / data-access interface | `pres`, `temp`, `salinity` | None (Public) |
| **9. GEBCO WMS** | `https://wms.gebco.net/mapserv?` | `GEBCO_Latest` | WMS / WCS | `elevation` | None (Public) |

---

## 2. Ingestion & Development Sample Source for Phase 1

- **Authoritative Model Source for Phase 1**:
  The locally verified NetCDF4 file **`RSMC_hycom_20260830.nc`** is the development model source.
- **Variable Mapping**:
  The backend parses the actual RSMC variable names from this NetCDF file exactly:
  * `TIME`: temporal coordinates.
  * `DEPTH`: vertical depth coordinates.
  * `LAT`: latitude coordinates.
  * `LON`: longitude coordinates.
  * `TEMP`: water temperature.
  * `SALN`: water salinity.
  * `UVEL`: eastward velocity vector.
  * `VVEL`: northward velocity vector.
- **Grid Coordinates**:
  The backend **preserves the native RSMC depth coordinates** from the NetCDF. The legacy WOA23 25-depth grid representation is not forced upon the RSMC dataset and remains solely within the legacy fallback pipeline.

---

## 3. Argo Source Distinctions

It is critical to distinguish between raw observational portals and ERDDAP-accessible interfaces:
1. **Official Argo GDAC**:
   - Represents the raw repository of profile NetCDF files (e.g., hosted by Ifremer at `https://data-argo.ifremer.fr/` and US GDAC at `ftp://ftp.ifremer.fr/ifremer/argo/`).
   - Accessed by traversing subdirectories (`dac/` or `geo/`) and reading index files. Used for bulk validation.
2. **Ifremer ERDDAP Index**:
   - A RESTful, queryable database representation of the GDAC files. Accessed via `tabledap` queries at `https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.csv`. Used for live observations in the UI.
3. **Biogeochemical (BGC) Argo**:
   - **Real BGC Data**: Sourced from the real BGC-Argo dataset (ID `UNKNOWN / TO BE VERIFIED`).
   - **Synthetic BGC Data**: Sourced from dataset ID `ArgoFloats-synthetic-BGC` containing simulated chlorophyll-a data.

---

## 4. Transition Design Answers (20 Key Questions)

1. **What parts of the current ingest/processing pipeline should be kept exactly as they are?**
   - The xarray cropping and quantization math, standard 25 depth levels for the legacy WOA23 pipeline, profile downsampling routines (limiting points to 120–200), and client-side bilinear sampling in `mapping.ts`.
2. **What parts should be wrapped by FastAPI?**
   - Ingestion functions inside `fetch_argo.py`, `fetch_hycom.py`, etc., will be wrapped into service modules and called by routers dynamically.
3. **What parts should be converted into reusable adapter/service modules?**
   - Ingestion classes implementing a common `BaseAdapter` interface.
4. **What parts should eventually be replaced?**
   - The manual orchestrator `run_all.py` (replaced by FastAPI background tasks).
   - Hardcoded committed `.bin` arrays (replaced by dynamic API streaming).
5. **What parts of public/data must remain temporarily as fallback?**
   - `coastlines.json`, `manifest.json`, and the base annual grids (`temp_annual.bin`, `salt_annual.bin`) remain in `/public/data` as fallback assets.
6. **How will FastAPI provide the same data contract that the current frontend expects?**
   - Matching the schema in the endpoints `/api/v1/manifest` and `/api/v1/profiles` and streaming binary array buffers matching the original file layouts.
7. **How will the frontend transition from static files to API responses safely?**
   - The API client (`api.ts`) queries `process.env.NEXT_PUBLIC_API_URL`. If empty or offline, it defaults to requesting static assets in `/data/` from the public directory.
8. **How will the 11 GB INCOIS HYCOM NetCDF be accessed lazily without loading the entire file into RAM?**
   - Using `xarray.open_dataset` with chunked parameters. This loads metadata immediately, and reads only the required 2D plane cells from disk on demand.
9. **How will time/depth/latitude/longitude/variable slicing work?**
   - Passed via query parameters to `xarray.sel(..., method="nearest")`. The result is quantized on-the-fly and streamed.
10. **How will historical model files be archived and indexed rather than overwritten?**
    - Saved inside `/cache/archive/{dataset_id}/{year}/{month}/{day}/{filename}.nc` to preserve historical coordinates.
11. **How will current/live remote data and historical archived data coexist?**
    - The server checks local cache directories first. If the file is cached, it is loaded; if missing, the adapter queries the remote TDS server, caches it locally, and indexes it.
12. **How will NetCDF/xarray and CSV/delimited-text ingestion coexist?**
    - Managed under the shared `BaseAdapter` interface. Gridded variables yield arrays, and observations yield list coordinates.
13. **How will Argo, Glider, CTD, BGC and model data be normalized into compatible internal schemas?**
    - Model fields output gridded grids. Observation profiles normalize to the extensible platform schema.
14. **Where will QC happen?**
    - **Backend**: Adapters discard profiles missing coordinates, pressure, or key measurements.
    - **Frontend**: Bilinear model-observation error validation.
15. **Where will caching happen?**
    - **Backend**: In-memory metadata and cached slice files on the server.
    - **Frontend**: Client-side array cache (`fieldCache.ts`).
16. **Where will dataset metadata and provenance be stored?**
    - In-memory variables for Phase 1; migrated to SQLite in later phases.
17. **What exact backend endpoints are needed for PS 26067?**
    - `/health`, `/datasets`, `/datasets/{id}/metadata`, `/model/times`, `/model/depths`, `/model/field`, `/observations`, `/observations/{platform_id}`, `/profiles/{platform_id}`, `/bathymetry`, and `/manifest` (compatibility).
18. **Which requirements are NOT part of Phase 1 and must wait for later phases?**
    - CTD integration, real BGC arrays, WMS/WCS standard streams, SQLite database tables, and automated cron pipelines.
19. **Which existing files/components should NOT be touched?**
    - Shaders (`ColormapShader.ts`), client caching (`fieldCache.ts`), and Three.js visual scripts (`DepthSlices.tsx`, `Isosurface.tsx`, `Basemap.tsx`).
20. **What is the safest migration strategy?**
    - Write the server inside `/backend` on port `8000`. Keep fallback assets in Next.js public directory. Set `NEXT_PUBLIC_API_URL` to route requests dynamically.
