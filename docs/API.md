# Sagar Netra 3D — REST API Specification

**Base URL:** `http://localhost:8000/api/v1`  
**OpenAPI / Swagger UI:** `http://localhost:8000/docs`  
**Protocol:** HTTP/1.1 REST + Binary Octet-Stream Slicing  

---

## 1. System Endpoints

### `GET /health`
Returns the operational health, version, and server UTC timestamp.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0-phase1",
  "phase": "1",
  "utcTime": "2026-09-02T12:00:00Z"
}
```

---

## 2. Dataset Discovery

### `GET /datasets`
Lists all gridded ocean model datasets served by the backend.

**Response:**
```json
[
  {
    "id": "incois-rsmc-hycom",
    "name": "INCOIS RSMC Indian Ocean HYCOM Forecast",
    "type": "model",
    "source": "INCOIS Regional Specialised Meteorological Centre",
    "sourceFile": "RSMC_hycom_20260830.nc",
    "lastUpdated": "2026-08-30T18:00:00Z",
    "native_variables": ["TEMP", "SALN", "UVEL", "VVEL"]
  }
]
```

### `GET /datasets/{id}/metadata`
Returns full coordinate dimensions, spatial bounding box, depth levels, and variable encodings for a dataset.

---

## 3. Dimensional Query Endpoints

### `GET /model/times`
Returns all available time coordinate steps (ISO-8601 UTC).

**Response:**
```json
{
  "datasetId": "incois-rsmc-hycom",
  "count": 5,
  "times": [
    "2026-08-30T00:00:00Z",
    "2026-08-30T06:00:00Z",
    "2026-08-30T12:00:00Z",
    "2026-08-30T18:00:00Z",
    "2026-08-31T00:00:00Z"
  ]
}
```

### `GET /model/depths`
Returns all discrete vertical depth levels in metres.

**Response:**
```json
{
  "datasetId": "incois-rsmc-hycom",
  "unit": "metres",
  "count": 40,
  "depthsM": [0.0, 5.0, 10.0, 20.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2000.0]
}
```

---

## 4. Binary Field Slicing (Core Pipeline)

### `GET /model/field`
Lazily crops and quantizes a 2-D (lat × lon) horizontal depth slice directly from NetCDF into an ultra-compact `uint8` binary buffer.

**Query Parameters:**
- `variable` (string, required): `TEMP` | `SALN` | `UVEL` | `VVEL`
- `timestamp` (string, required): ISO-8601 UTC timestamp
- `depth` (float, required): Target depth in metres
- `latitude_min` (float, required): South bound
- `latitude_max` (float, required): North bound
- `longitude_min` (float, required): West bound
- `longitude_max` (float, required): East bound
- `stride` (integer, optional, default: 1): Downsampling factor (1 to 16)

**Response:**
- `Content-Type: application/octet-stream`
- Raw byte buffer: `width × height` bytes (1 byte per grid cell).
- Response Headers:
  - `X-Dtype`: `uint8`
  - `X-Scale`: Linear scale factor
  - `X-Offset`: Physical value offset
  - `X-Fill-Value`: `255` (NaN / land flag)
  - `X-Min`: Slice minimum physical value
  - `X-Max`: Slice maximum physical value
  - `X-Actual-Time`: Nearest timestamp selected
  - `X-Actual-Depth`: Nearest depth selected
  - `X-Width`: Number of longitude columns
  - `X-Height`: Number of latitude rows

**Physical Value Reconstruction Formula:**
$$\text{Physical Value} = \text{X-Offset} + (\text{Byte Value} \times \text{X-Scale})$$

---

## 5. In-Situ Observation Query Endpoints

### `GET /observations/platforms`
Returns in-situ observation platforms (Argo floats, gliders, BGC-Argo floats, CTD casts) with optional spatial and type filtering.

**Query Parameters:**
- `type` (optional): `argo` | `glider` | `bgc` | `ctd`
- `lat_min`, `lat_max`, `lon_min`, `lon_max` (optional floats)

**Response:**
```json
{
  "count": 74,
  "platforms": [
    {
      "id": "2901923",
      "type": "argo",
      "lat": 12.45,
      "lon": 68.32,
      "lastSeen": "2026-08-30T10:15:00Z",
      "cycles": [
        {
          "time": "2026-08-30T10:15:00Z",
          "lat": 12.45,
          "lon": 68.32,
          "profile": [
            { "depthM": 0, "tempC": 28.4, "salPsu": 35.8 },
            { "depthM": 50, "tempC": 26.1, "salPsu": 36.1 }
          ]
        }
      ]
    }
  ]
}
```

### `GET /observations/platforms/{id}`
Returns complete historical cycle profiles, sensor metadata, and trajectories for a specific platform ID.
