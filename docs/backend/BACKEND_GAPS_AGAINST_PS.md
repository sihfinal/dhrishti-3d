# Backend Gaps Against PS 26067 Requirements

This document highlights the specific technical gaps that remain between the **current file-based, static architecture** of Sagar Netra 3D and the final requirements of **PS 26067**.

---

## 1. Missing Active Runtime API Server
- **Current State**: Sagar Netra 3D operates entirely as a static client website. Processed datasets are checked into git at `/public/data/` and loaded by the browser via standard HTTP GET fetches. No active server handles database queries or runs dynamic scripts.
- **PS Requirement**: A robust REST API backend capable of serving dynamic queries, authenticating users, managing ingestion schedules, and processing datasets on-the-fly.
- **Impact**: Dynamic parameter changes (e.g. custom geographic ranges, different interpolation scopes) cannot be resolved without rebuilding and re-ingesting the static data files.

---

## 2. Inefficient Data Slicing (Client Memory Overhead)
- **Current State**: To display a single 2D depth layer or time-step, the client browser must fetch the **entire** 3D volume binary file (e.g. `temp_monthly.bin` at 1.17 MB) and store it in RAM. Slicing is performed on the client side using CPU array offsets and GPU DataTextures.
- **PS Requirement**: The backend must handle data slicing requests (e.g., returning only the 2D plane for time index $t=3$ and depth $d=50\text{m}$).
- **Impact**: Highly wasteful for mobile clients or low-bandwidth networks. Slicing should occur on the server side to minimize payload size.

---

## 3. Lack of Real INCOIS Model Integration
- **Current State**: Gridded models are sourced from NOAA WOA23 historical climatology decadal analysis, and currents are parsed from a static slice of HYCOM expt_93.0.
- **PS Requirement**: Direct operational connection to real INCOIS numerical ocean forecast outputs. These NetCDF files are CF-1.6 compliant and must support indexing across dynamic forecast horizons (historical, today, and future).
- **Impact**: The current system displays static historical cycles instead of active operational ocean forecasting.

---

## 4. Missing CTD Observations Ingestion & Rendering
- **Current State**: There are **zero** Conductivity-Temperature-Depth (CTD) observation files, parsing scripts, database tables, or visual rendering pipelines in the current project.
- **PS Requirement**: Ingest, store, and map CTD profile observation tracks alongside Argo and Gliders.
- **Impact**: Complete feature gap in instrument overlays.

---

## 5. Lack of Real BGC Observation Data
- **Current State**: Biogeochemical (BGC) observations are pulled from a synthetic dataset (`ArgoFloats-synthetic-BGC.csv`) on the Ifremer ERDDAP server.
- **PS Requirement**: Integration of real, verified BGC observations (such as dissolved oxygen, nitrate, pH, and actual chlorophyll) from active float deployments.
- **Impact**: Validation comparison relies on simulated values rather than authentic ocean sensor data.

---

## 6. Missing GIS WMS/WCS Interoperability Services
- **Current State**: Ocean data is stored as raw quantized byte arrays (`.bin` files) designed specifically for the custom WebGL shader. There are no standardized GIS endpoints.
- **PS Requirement**: Support for Web Map Service (WMS) and Web Coverage Service (WCS) OGC standard interfaces, allowing external tools (like QGIS, ArcGIS, or Google Earth) to overlay the ocean model outputs.
- **Impact**: External oceanography research tools cannot connect to or query the Sagar Netra 3D data stream.
