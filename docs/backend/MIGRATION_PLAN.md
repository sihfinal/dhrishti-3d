# Migration Plan: Static to FastAPI

This document details the transition roadmap to migrate the Sagar Netra 3D application from its current **file-based static mock architecture** to a **live FastAPI backend** without breaking the existing 3D frontend interface.

---

## 1. Migration Overview

To protect application stability, we will follow a **dual-mode migration strategy**:
1. **Fallback Mode**: The frontend remains capable of loading standard static assets from the repository at `/public/data` if no API server is connected.
2. **Active API Mode**: When `NEXT_PUBLIC_API_URL` is set, the client redirects all fetching calls to the FastAPI endpoints.

---

## 2. Frozen Endpoint Routes Mapping

The client API client (`src/lib/api.ts`) will map queries to the following frozen routes:

```
Static Loader               ➔  Active API Route (FastAPI port 8000)
/data/manifest.json         ➔  /api/v1/manifest (for compatibility) OR /api/v1/datasets
/data/profiles.json         ➔  /api/v1/profiles/{platform_id} (or /api/v1/observations)
/data/temp_annual.bin       ➔  /api/v1/model/field?variable=TEMP&...
/data/salt_annual.bin       ➔  /api/v1/model/field?variable=SALN&...
/data/currents.bin          ➔  /api/v1/model/field?variable=UVEL&... (and VVEL)
```

---

## 3. In-Depth Migration Steps

### Step 1: Create the Independent Backend Workspace
- Initialize a subdirectory `/backend` in the root folder.
- Establish a standalone environment:
  * `/backend/requirements.txt`: holding `fastapi`, `uvicorn`, `xarray`, `numpy`, `netcdf4`, `pydantic-settings`.
  * `/backend/main.py`: main app entry point with CORS policies enabled.
  * `/backend/routers/`: housing modular endpoint files.
  * `/backend/adapters/`: containing data fetching modules.

### Step 2: Establish the Development Environment Configuration
- Assign the FastAPI server to run locally on port `8000`.
- Run Next.js on port `3000`.
- Enable CORS in FastAPI to allow calls from `http://localhost:3000`.

### Step 3: Implement the Dual-Mode Client-Side Logic
- Update `src/lib/api.ts` to read the environment variable:
  ```typescript
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
  ```
- If `API_BASE` is empty or unset, all fetching paths default back to the local repository paths:
  * `/data/manifest.json`
  * `/data/profiles.json`
  * `/data/*.bin`
- If `API_BASE` is populated (e.g. `http://localhost:8000/api/v1`), the API client redirects queries to the endpoints defined in the API Contract.

### Step 4: Validate Compatibility in Local Execution
- Launch Next.js on port 3000.
- Test frontend queries with backend offline ➔ Verify fallback static charts display without errors.
- Boot FastAPI on port 8000 and set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` ➔ Verify network traffic routes correctly to the dynamic backend.

### Step 5: Clean Up and Archive Static Assets (Deployment Phase)
- Once the backend is fully operational in production, we can remove the large `.bin` arrays from Git to minimize size, leaving only a minimum mockup `manifest.json` for safety.
