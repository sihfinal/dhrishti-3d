# 🌊 SagarDrishti-3D (सागरदृष्टि-3D)
### *Next-Generation Interactive 3D Ocean Model & In-Situ Observation Exploration Platform*

[![SIH PS 26067](https://img.shields.io/badge/SIH%202026-PS%2026067-0284c7?style=for-the-badge&logo=target&logoColor=white)](https://www.sih.gov.in/)
[![INCOIS / MoES](https://img.shields.io/badge/Ministry%20of%20Earth%20Sciences-INCOIS-0d9488?style=for-the-badge&logo=gov.uk&logoColor=white)](https://incois.gov.in/)
[![Next.js 15](https://img.shields.io/badge/Next.js%2015-React%2019-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Three.js / WebGL2](https://img.shields.io/badge/Three.js-WebGL2%20GPU%20Ray%20Marching-047857?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Pytest 102/102 Passing](https://img.shields.io/badge/Tests-102%2F102%20Passing%20(100%25)-10b981?style=for-the-badge&logo=pytest&logoColor=white)](#-testing--quality-assurance)
[![Hugging Face Dataset](https://img.shields.io/badge/Hugging%20Face-Dataset%20Repository-ffd21e?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/datasets/kumar9513/data)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

## 📌 Executive Summary

**SagarDrishti-3D** is an advanced scientific oceanographic exploration platform engineered for **Smart India Hackathon (SIH 2026) Problem Statement 26067**, sponsored by the **Indian National Centre for Ocean Information Services (INCOIS)**, Ministry of Earth Sciences (MoES), Government of India.

The platform bridges continuous 4D numerical ocean circulation models (CMEMS / HYCOM / WOA23) with discrete in-situ marine observations across the Indian Ocean Basin (Arabian Sea, Bay of Bengal, and Equatorial Indian Ocean). Utilizing WebGL2 GPU volume ray marching, standalone 3D Marching Cubes isosurface extraction, multi-depth horizontal slicing, and true 3D current vector fields, **SagarDrishti-3D** delivers real-time scientific visualization with sub-second rendering latencies.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SAGARDRISHTI-3D WORKSTATION                               │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│   STAGE 1: GLOBAL DIGITAL EARTH           │   STAGE 2: 3D REGIONAL WORKSTATION          │
│   • Global 3D Interactive Marine Globe   │   • True 3D Volumetric GPU Ray Marching     │
│   • 27,000+ Real In-Situ Profiles        │   • 3D Marching Cubes Isosurface Extraction │
│   • Argo, Glider, CTD, and BGC Tracking  │   • Multi-Depth Horizontal Slicing Stack    │
│   • Interactive Bounding Box ROI Select  │   • True 3D Velocity Vectors (uo, vo)       │
│   • Indian EEZ Boundary Overlay          │   • Observation-vs-Model Residual Analytics │
│   • Real-Time Spatial Filtering          │   • 1× to 10× Vertical Depth Exaggeration   │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Run with 3 Commands)

Whether you clone this repository or download the ZIP, you can run the entire platform locally in seconds.

### Prerequisites
- **Node.js** (v18+ or v20+) and **pnpm** (or npm)
- **Python** (v3.10+ or v3.11+)

---

### Step 1: Install Dependencies
Open your terminal in the project root:
```bash
# 1. Install frontend packages
pnpm install

# 2. Install Python backend requirements
pip install -r requirements.txt
```

### Step 2: Start the Backend Service
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
* **API Documentation & Swagger UI:** [`http://localhost:8000/docs`](http://localhost:8000/docs)
* **API Root:** [`http://localhost:8000/api/v1`](http://localhost:8000/api/v1)

### Step 3: Start the 3D Frontend
In a second terminal window:
```bash
pnpm dev
```
Open **[`http://localhost:3000`](http://localhost:3000)** in your browser!

---

## 🐳 Docker Deployment (1 Single Command)

If you prefer containerized deployment with Docker:

```bash
docker compose up -d --build
```
- **Frontend:** `http://localhost:3000`
- **Backend API & Docs:** `http://localhost:8000/docs`

---

## 🌟 Key Features & Capabilities

### 🌍 1. Stage 1 — Global Digital Earth & Fleet Tracking
* **3D Marine Globe:** High-performance WebGL globe with high-resolution satellite imagery, atmospheric scattering shaders, country boundaries, and Indian Exclusive Economic Zone (EEZ) boundaries.
* **In-Situ Fleet Tracking (27,000+ Soundings):**
  * 🟢 **Argo Profiling Floats:** Temperature & Salinity down to 2,000m depth.
  * 🔵 **Underwater Autonomous Gliders:** High-density sawtooth spatial transects.
  * 🟠 **Shipboard CTD Casts:** Deep-sea hydrographic baseline stations.
  * 🟣 **Biogeochemical (BGC) Floats:** Chlorophyll-a and bio-optical sensors.
* **Interactive Bounding Box ROI Selector:** Click-and-drag bounding box on the 3D globe to isolate any marine domain and enter Stage 2.

### 🧊 2. Stage 2 — Depth-Resolved 3D Ocean Workstation
* **True 3D Volumetric GPU Ray Marching:** Direct ray casting through a scientific 3D data texture (`THREE.Data3DTexture`) with front-to-back emission-absorption compositing and early ray termination.
* **3D Marching Cubes Isosurfaces:** Real-time extraction of continuous 3D constant-value surfaces (thermocline isotherms, halocline fronts, and chlorophyll plumes) with dynamic isovalue threshold sliders.
* **Multi-Depth Slicing Stack:** Interactive horizontal planes ($0\text{m}, 25\text{m}, 50\text{m}, 100\text{m}, 250\text{m}, 500\text{m}, 1000\text{m}$) with depth contour borders.
* **True 3D Current Velocity Vectors:** Horizontal flow field glyphs derived from zonal ($u_o$) and meridional ($v_o$) velocities with true vector magnitude scaling ($\text{speed} = \sqrt{u_o^2 + v_o^2}$) and bilateral arrowhead fins.
* **Vertical Exaggeration Control:** Smooth $1\times \to 10\times$ depth exaggeration slider that expands physical vertical separation without altering underlying coordinate metadata.
* **Observation vs. Model Validation:** Interactive modal comparing in-situ sensor soundings against collocated CMEMS numerical forecast models with residual plots, RMSE, and bias statistics.
* **Temporal Playback Engine:** Time navigation across daily model forecast steps with synchronized data caching.

### 📡 3. OGC Web Services & Scientific Interoperability
* **OGC WMS (1.3.0 & 1.1.1):** Standard `GetCapabilities`, `GetMap` (direct 2D raster tiles with custom colormaps), and `GetLegendGraphic` for QGIS, ArcGIS, and Leaflet integration.
* **OGC WCS (2.0.1):** Coverage service returning subsetted NetCDF / GeoTIFF grids.
* **OPeNDAP DAP 2.0 & THREDDS:** Multidimensional server-side subsetting over the DAP2 wire protocol (DDS, DAS, DODS binary XDR, HTML info).

---

## 🗄️ Scientific Datasets & Storage

The platform works **out of the box** using the committed lightweight pre-quantized binary store in `public/data/` (<9 MB), enabling instant zero-configuration runtime.

For research and ingestion of the full raw NetCDF models:
* **Hugging Face Dataset Archive:** [**`kumar9513/data`**](https://huggingface.co/datasets/kumar9513/data)
* Contains all daily CMEMS numerical ocean models (temperature, salinity, velocities, chlorophyll-a) and World Ocean Database (WOD) in-situ observation archives (~17.8 GB).

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/v1/model/metadata` | `GET` | Dataset bounding coordinates, time steps, variables, and depth levels |
| `/api/v1/model/field` | `GET` | Lazy 2D subgrid extraction for variable, timestamp, depth, and spatial ROI |
| `/api/v1/model/times` | `GET` | List of available forecast timestamps (`YYYY-MM-DD`) |
| `/api/v1/model/depths` | `GET` | Discrete vertical depth levels in meters |
| `/api/v1/observations/platforms`| `GET` | Query in-situ platforms within spatial bounding coordinates |
| `/api/v1/observations/{id}/profile` | `GET` | Retrieve depth-resolved observation arrays (`depth`, `temperature`, `salinity`) |
| `/api/v1/comparison/profile` | `GET` | Observation-vs-model residual comparison and error statistics |
| `/api/v1/ogc/wms` | `GET` | OGC Web Map Service (WMS 1.3.0 & 1.1.1) endpoints |
| `/api/v1/ogc/wcs` | `GET` | OGC Web Coverage Service (WCS 2.0.1) endpoints |
| `/api/v1/opendap/*` | `GET` | OPeNDAP DAP 2.0 protocol endpoint for remote clients (xarray, MATLAB, QGIS) |

---

## 🧪 Testing & Quality Assurance

The codebase is strictly validated through automated unit tests, type-checkers, and runtime integrity scripts:

```bash
# 1. Run Python Backend Test Suite (Pytest)
pytest backend/tests
```

```text
============================= test session starts =============================
platform win32 -- Python 3.11.5, pytest-9.1.1
collected 102 items

backend\tests\test_api.py ........................................       [ 39%]
backend\tests\test_comparison.py ....                                    [ 43%]
backend\tests\test_delimited_text_and_ingestion.py ........              [ 50%]
backend\tests\test_extensible_architecture.py ...............            [ 65%]
backend\tests\test_geospatial.py ..                                      [ 67%]
backend\tests\test_opendap.py .............                              [ 80%]
backend\tests\test_wcs.py ..........                                     [ 90%]
backend\tests\test_wms.py ..........                                     [100%]

====================== 102 passed, 2 warnings in 56.73s =======================
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router), React 19, TypeScript 5.7 |
| **3D & GPU Graphics** | Three.js (r128+), WebGL2, Custom GLSL Shaders, `@react-three/fiber` |
| **Styling & Motion** | Tailwind CSS v4, Framer Motion, Lucide Icons |
| **State Management** | Zustand (Lightweight Global Store) |
| **Backend Framework** | FastAPI, Uvicorn ASGI |
| **Scientific Data Stack** | xarray, NetCDF4, NumPy, SciPy, pandas, h5netcdf, h5py |
| **OGC Services** | WMS 1.3.0, WCS 2.0.1, OPeNDAP DAP 2.0 (pydap, WebOb) |
| **Containerization** | Docker, Docker Compose, Nginx Alpine |

---

## 📂 Project Directory Structure

```text
├── app/                          # Next.js App Router (pages & navigation)
│   ├── about/                    # About INCOIS & platform mission
│   ├── data-services/            # OGC & data catalog interface
│   ├── explore/                  # Main 3D workstation entry point
│   ├── observations/             # In-situ observation registry & search
│   └── operational-applications/ # Marine operational use-cases
├── backend/                      # Python FastAPI Scientific Server
│   ├── adapters/                 # CMEMS, WOD, and delimited-text data adapters
│   ├── routers/                  # Model, observation, comparison, WMS, WCS, OPeNDAP
│   ├── schemas/                  # Pydantic data schemas
│   ├── services/                 # Spatial slicing, WMS rasterizer, comparison engine
│   └── tests/                    # 102 Automated Pytest Unit Tests
├── public/                       # Static public assets
│   ├── data/                     # Lightweight pre-processed binary data store (<9 MB)
│   └── textures/                 # 3D Earth, atmosphere, and cloud textures
├── src/                          # Frontend source code
│   ├── components/               # React UI & Three.js 3D scene components
│   │   ├── page3/                # Stage 1 Globe & Stage 2 Workstation components
│   │   └── stage2/               # Volume raymarcher, isosurfaces, current vectors
│   └── lib/                      # API client, colormaps, binary decoders, validation
├── docker-compose.yml            # Production container orchestration
├── Dockerfile.frontend           # Frontend multi-stage Nginx build
├── requirements.txt              # Root Python dependencies
└── package.json                  # Frontend dependencies and npm scripts
```

---

## 🤝 Acknowledgements & Attribution

* **INCOIS (Indian National Centre for Ocean Information Services)**, Ministry of Earth Sciences (MoES), Government of India: For problem guidance, domain requirements, and scientific leadership under SIH PS 26067.
* **Copernicus Marine Environment Monitoring Service (CMEMS):** For ocean physics and biogeochemical numerical analysis products.
* **NOAA NCEI & IFREMER:** For global World Ocean Database (WOD) and Argo profiling float data streams.
* **Smart India Hackathon (SIH 2026):** For fostering technological innovation in marine oceanography.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built for the Ministry of Earth Sciences & INCOIS · Smart India Hackathon 2026 (PS 26067)</sub>
</div>
