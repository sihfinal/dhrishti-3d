# Final API Contract Specification

This document defines the concrete REST API routes, request parameters, response schemas, and binary encoding contracts served by the Sagar Netra 3D FastAPI backend.

---

## 1. Discovery & Metadata Endpoints

### A. GET `/api/v1/health`
Checks server status.
- **Response** (`200 OK`):
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "utcTime": "2026-08-31T12:00:00Z"
}
```

### B. GET `/api/v1/datasets`
Lists all available models and observation datasets.
- **Response** (`200 OK`):
```json
[
  {
    "id": "incois_rsmc_daily",
    "name": "INCOIS RSMC Daily Ocean Forecast",
    "type": "model",
    "source": "INCOIS THREDDS OPeNDAP",
    "lastUpdated": "2026-08-31T06:00:00Z"
  }
]
```

### C. GET `/api/v1/datasets/{id}/metadata`
Retrieves metadata, grid specifications, coordinate ranges, and provenance.
- **Response** (`200 OK`):
```json
{
  "id": "incois_rsmc_daily",
  "name": "INCOIS RSMC Daily Ocean Forecast",
  "native_variable": "TEMP",
  "units": "degC",
  "time_coverage_start": "2026-08-25T00:00:00Z",
  "time_coverage_end": "2026-09-02T00:00:00Z",
  "lat_min": -35.0,
  "lat_max": 30.0,
  "lon_min": 40.0,
  "lon_max": 100.0,
  "depth_min": 0.0,
  "depth_max": 1000.0,
  "depthsM": [0.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0],
  "globalMin": -2.0,
  "globalMax": 35.5,
  "encoding": {
    "dtype": "uint8",
    "scale": 0.1476,
    "offset": -2.0,
    "fillByte": 255
  },
  "provenance": {
    "url": "https://las.incois.gov.in/thredds/",
    "citation": "Indian National Centre for Ocean Information Services"
  }
}
```

---

## 2. Model Slicing & Dimensional Endpoints

### A. GET `/api/v1/model/times`
Returns lists of datetime stamps available for the active model.
- **Response** (`200 OK`):
```json
{
  "variable": "TEMP",
  "times": [
    "2026-08-30T00:00:00Z",
    "2026-08-31T00:00:00Z",
    "2026-09-01T00:00:00Z"
  ]
}
```

### B. GET `/api/v1/model/depths`
Returns lists of available depth layers (in meters) for the active model.
- **Response** (`200 OK`):
```json
{
  "variable": "TEMP",
  "depthsM": [0.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0]
}
```

### C. GET `/api/v1/model/field`
Queries and streams a dynamic 2D quantized binary field plane.
- **Query Parameters**:
  - `variable` (string, required): e.g. `TEMP`, `SALN`, `UVEL`, `VVEL`.
  - `timestamp` (string, required): ISO datetime (e.g. `2026-08-31T12:00:00Z`).
  - `depth` (float, required): Depth in meters.
  - `latitude_min` (float, required): Box lat minimum.
  - `latitude_max` (float, required): Box lat maximum.
  - `longitude_min` (float, required): Box lon minimum.
  - `longitude_max` (float, required): Box lon maximum.
  - `stride` (integer, optional): Grid step downsampling factor (default: `1`).
- **Response** (`200 OK`):
  - **Headers**:
    * `Content-Type`: `application/octet-stream`
    * `X-Dtype`: `uint8` (or `int8` for velocities)
    * `X-Scale`: `0.0896`
    * `X-Offset`: `7.511`
    * `X-Fill-Value`: `255`
    * `X-Min`: `7.511`
    * `X-Max`: `30.294`
    * `X-Actual-Time`: `2026-08-31T00:00:00Z` (nearest matched time)
    * `X-Actual-Depth`: `10.0` (nearest matched depth)
    * `X-Width`: `60`
    * `X-Height`: `65`
  - **Body**: Raw binary byte stream containing the quantized values.

---

## 3. Observational & Profile Endpoints

### A. GET `/api/v1/observations`
Lists active platforms coordinates and metadata.
- **Query Parameters**:
  - `time_min`, `time_max` (string, optional): Time-range queries.
  - `lat_min`, `lat_max`, `lon_min`, `lon_max` (float, optional): Spatial bounding query boxes.
- **Response** (`200 OK`):
```json
{
  "platforms": [
    {
      "id": "argo-1901633",
      "type": "argo",
      "lon": 72.84,
      "lat": -12.35,
      "lastSeen": "2026-08-30T08:48:00Z"
    }
  ]
}
```

### B. GET `/api/v1/observations/{platform_id}`
Returns coordinates and general statistics for a specific profiling platform.
- **Response** (`200 OK`):
```json
{
  "id": "argo-1901633",
  "type": "argo",
  "cyclesCount": 3,
  "lastSeen": "2026-08-30T08:48:00Z"
}
```

### C. GET `/api/v1/profiles/{platform_id}`
Returns cycle measurements and detailed profiles for a specific platform using extensible variable maps.
- **Response** (`200 OK`):
```json
{
  "id": "argo-1901633",
  "type": "argo",
  "cycles": [
    {
      "time": "2026-08-30T08:48:00Z",
      "lon": 72.84,
      "lat": -12.35,
      "profile": [
        {
          "depthM": 0.0,
          "variables": {
            "tempC": 25.52,
            "salPsu": 35.12,
            "chla": null
          }
        }
      ]
    }
  ]
}
```

### D. GET `/api/v1/bathymetry`
Streams gridded bathymetry heights.
- **Query Parameters**:
  - `lat_min`, `lat_max`, `lon_min`, `lon_max` (float, required): Bounding box coordinates.
- **Response** (`200 OK`):
  - **Headers**:
    * `Content-Type`: `application/octet-stream`
  - **Body**: Binary array of floating-point grid elevations.

---

## 4. Compatibility Endpoints

### A. GET `/api/v1/manifest`
Provides backward compatibility for older static client loaders expecting a single `manifest.json` file.
- **Response** (`200 OK`): Reconstructs a JSON registry structure mirroring the static `manifest.json` on the fly.

---

## 5. Operational Slicing & Validation Rules

1. **Nearest-Time Resolution**:
   Resolved dynamically using `method="nearest"` index selection. If query timestamp exceeds the model range bounds by more than 30 days, the server returns an HTTP `400 Bad Request`.
2. **Nearest-Depth Resolution**:
   Resolves to the closest available standard depth layer using `method="nearest"`.
3. **Dynamic Geographic Extent Validation**:
   The backend does not hardcode the Indian Ocean ROI box bounds as the universal limit. Slicing endpoints validate query coordinates dynamically against each dataset's actual geographic bounds. If a query falls outside the dataset coordinates, the server returns an HTTP `400 Bad Request`.
4. **Missing-Value Handling**:
   Cells over land or missing coordinates are mapped to `255` (for `uint8`) or `-128` (for `int8`).
5. **Response Size Limits**:
   Requests exceeding `512 x 512` nodes return an HTTP `413 Payload Too Large` to prevent memory exhaustion.
6. **Dynamic Scaling Transparency**:
   To prevent scaling errors on the client side, every dynamic slice response includes headers (`X-Scale`, `X-Offset`, `X-Min`, `X-Max`) defining the exact linear translation used for that specific slice payload.
