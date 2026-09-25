# Sagar Netra 3D — Data Format & Ingestion Standards

**Supported Ingestion Formats:** NetCDF-3 / NetCDF-4 (CF-1.8 compliant), HDF5, ASCII/CSV profiles, WMO GTS streams.  
**Target Region:** Indian Ocean & EEZ ($\text{Lat: } -35^\circ \text{ to } +30^\circ$, $\text{Lon: } 40^\circ \text{ to } 100^\circ$).  

---

## 1. Gridded NetCDF Specification (CF-1.8 Conventions)

Model fields must adhere to CF-1.8 metadata conventions with standard 4D/3D coordinate arrays:

```text
dimensions:
    time = UNLIMITED ;
    depth = 40 ;
    lat = 261 ;
    lon = 241 ;

variables:
    double time(time) ;
        time:standard_name = "time" ;
        time:units = "hours since 2026-08-30 00:00:00" ;
        time:calendar = "standard" ;
    double depth(depth) ;
        depth:standard_name = "depth" ;
        depth:units = "m" ;
        depth:positive = "down" ;
    double lat(lat) ;
        lat:standard_name = "latitude" ;
        lat:units = "degrees_north" ;
    double lon(lon) ;
        lon:standard_name = "longitude" ;
        lon:units = "degrees_east" ;
    float TEMP(time, depth, lat, lon) ;
        TEMP:standard_name = "sea_water_potential_temperature" ;
        TEMP:units = "degree_Celsius" ;
        TEMP:_FillValue = -999.0f ;
    float SALN(time, depth, lat, lon) ;
        SALN:standard_name = "sea_water_practical_salinity" ;
        SALN:units = "PSU" ;
    float UVEL(time, depth, lat, lon) ;
        UVEL:standard_name = "eastward_sea_water_velocity" ;
        UVEL:units = "m s-1" ;
    float VVEL(time, depth, lat, lon) ;
        VVEL:standard_name = "northward_sea_water_velocity" ;
        VVEL:units = "m s-1" ;
```

---

## 2. In-Situ Observation JSON / ASCII Format

In-situ autonomous observations (Argo, Glider, BGC-Argo, CTD) are represented in structured multi-cycle records:

```json
{
  "id": "2901923",
  "type": "argo",
  "lon": 68.32,
  "lat": 12.45,
  "lastSeen": "2026-08-30T10:15:00Z",
  "cycles": [
    {
      "time": "2026-08-30T10:15:00Z",
      "lon": 68.32,
      "lat": 12.45,
      "profile": [
        { "depthM": 0, "tempC": 28.42, "salPsu": 35.81, "chla": 0.42 },
        { "depthM": 10, "tempC": 28.38, "salPsu": 35.83, "chla": 0.45 },
        { "depthM": 50, "tempC": 26.15, "salPsu": 36.12, "chla": 0.88 },
        { "depthM": 100, "tempC": 21.04, "salPsu": 35.95, "chla": 0.12 },
        { "depthM": 500, "tempC": 10.32, "salPsu": 35.10, "chla": 0.00 }
      ]
    }
  ]
}
```

---

## 3. Quantized WebGL Binary Buffer Format (`.bin`)

To ensure ultra-low network overhead and instantaneous 60fps rendering in WebGL:
- 3D gridded fields are quantized to `uint8` ($0 \text{ to } 254$).
- Byte `255` is strictly reserved for Land Mask / Missing Values.
- Linear decoding on the GPU shader:
  $$\text{Value} = \text{Offset} + \left(\frac{\text{Byte}}{254}\right) \times (\text{Max} - \text{Min})$$
- 25 depth levels $\times 130 \text{ lat} \times 300 \text{ lon} \approx 975\text{ KB}$ per annual volume.
