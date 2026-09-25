# Final Data Schema & Architecture Specs

This document defines the configuration variables, data schemas, and backend storage specifications for the Sagar Netra 3D FastAPI backend.

---

## 1. Database Phase Boundary Decision

- **Phase 1 Configuration**:
  - The SQLite database is **NOT implemented in Phase 1**.
  - Slicing and metadata logic operates as a **FastAPI runtime server with a filesystem-backed cache/archive**. All dataset metadata, time indices, and coordinate bounds are stored in **in-memory metadata objects** (Python dictionaries loaded on server startup) and sliced NetCDF planes are cached on the **local file system**.
- **Later Phases Configuration**:
  - Migrate variables registries, observations indexing tables, and background job statuses to a serverless **SQLite database** (`metadata.db` locally).

---

## 2. Extended Model Metadata Schema

To resolve dynamic coordinates queries, the model metadata schema is conceptually extended with native parameters (preserving native depth coordinates):

```yaml
ExtendedModelMetadataSchema:
  type: object
  properties:
    id: { type: string }
    name: { type: string }
    unit: { type: string }
    source: { type: string }
    native_variable: { type: string } // e.g. "TEMP", "SALN", "UVEL", "VVEL"
    units: { type: string }
    
    # Coordinate Extents
    time_coverage_start: { type: string, format: date-time }
    time_coverage_end: { type: string, format: date-time }
    lat_min: { type: number }
    lat_max: { type: number }
    lon_min: { type: number }
    lon_max: { type: number }
    depth_min: { type: number }
    depth_max: { type: number }
    
    # Grid Arrays (preserving native coordinates)
    depthsM: { type: array, items: { type: number } }
    times: { type: array, items: { type: string, format: date-time } }
    
    globalMin: { type: number }
    globalMax: { type: number }
    
    encoding:
      type: object
      properties:
        dtype: { type: string, enum: [uint8, int8] }
        scale: { type: number }
        offset: { type: number }
        fillByte: { type: integer }
        
    provenance:
      type: object
      properties:
        url: { type: string }
        citation: { type: string }
```

---

## 3. Extensible Observation/Profile Schema

To support future CTD and BGC variables (such as oxygen, pH, salinity, temperature, chlorophyll) without modifying the schema database structure, profile variables are modeled dynamically using a key-value properties mapping:

```yaml
InstrumentPlatformSchema:
  type: object
  properties:
    id: { type: string }
    type: { type: string, enum: [argo, glider, ctd, bgc] }
    lon: { type: number }
    lat: { type: number }
    lastSeen: { type: string, format: date-time }
    cycles:
      type: array
      items:
        type: object
        properties:
          time: { type: string, format: date-time }
          lon: { type: number }
          lat: { type: number }
          profile:
            type: array
            items:
              type: object
              properties:
                depthM: { type: number }
                variables:
                  type: object
                  additionalProperties: { type: [number, "null"] }
                  # e.g., { "tempC": 25.5, "salPsu": 35.1, "chla": 1.2, "doxy": 200.0 }
```

---

## 4. SQLite Table Specifications (For Post-Phase 1)

### Table: `datasets`
Tracks available models and gridded catalogs:
```sql
CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('model', 'observation')),
    source TEXT NOT NULL,
    native_variable TEXT,
    units TEXT,
    time_start TEXT,
    time_end TEXT,
    lat_min REAL,
    lat_max REAL,
    lon_min REAL,
    lon_max REAL,
    depth_min REAL,
    depth_max REAL,
    citation TEXT,
    url TEXT,
    last_updated TEXT NOT NULL
);
```

### Table: `observations_index`
Indexes platform profile cycle coordinates for spatial bounding box filtering:
```sql
CREATE TABLE observations_index (
    platform_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('argo', 'glider', 'ctd', 'bgc')),
    cycle_number INTEGER NOT NULL,
    time TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    data_hash TEXT NOT NULL,
    PRIMARY KEY (platform_id, cycle_number)
);
CREATE INDEX idx_spatial ON observations_index (latitude, longitude);
CREATE INDEX idx_temporal ON observations_index (time);
```

---

## 5. Architectural & System Choices

### A. Archive Strategy
- Local sample NetCDFs are stored inside a structured cache directory `/cache/archive/{dataset_id}/{year}/{month}/{day}/{filename}.nc`.
- Old operational files are preserved, and date ranges are indexed without overwriting newer forecast data.

### B. Cache Strategy
- Dynamic binary slices are written locally to `/cache/slices/{dataset_id}/{var}/{time_idx}_{depth_idx}.bin` to prevent redundant xarray rendering tasks.

### C. Error Handling
- Invalid bounds query ➔ HTTP `400 Bad Request`.
- Coordinates out of dataset boundaries ➔ HTTP `400 Bad Request`.
- Grid payload exceeds size limits ➔ HTTP `413 Payload Too Large`.

### D. Logging
- Uses standard Python `logging`. Tracks slice query execution times and data volumes.

### E. Configuration
- Managed using `pydantic-settings`. Configures default dataset cache paths and server parameters.

### F. API Versioning
- All route paths are prefixed with `/api/v1`.

### G. CORS Strategy
- CORS middleware configured in FastAPI to allow GET request methods from Next.js (`localhost:3000`).

### H. Testing Strategy
- Unit tests written using `pytest` and `httpx.AsyncClient`.
