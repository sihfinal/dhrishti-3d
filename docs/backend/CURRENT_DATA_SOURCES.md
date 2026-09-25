# Current Data Sources Audit

This document catalogues the current data sources integrated into the Sagar Netra 3D repository. It identifies the exact URLs, providers, frequencies, formats, and parameters fetched during ingestion.

---

## 1. NOAA World Ocean Atlas 2023 (WOA23) Climatology

### Annual Temperature & Salinity Grids
- **Source Provider**: NOAA National Centers for Environmental Information (NCEI)
- **Data Type**: Historical climatology gridded analysis (decadal average: `decav` representing 1991–2020)
- **OPeNDAP URL**:
  - Temperature: `https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/temperature/netcdf/decav/1.00/woa23_decav_t00_01.nc`
  - Salinity: `https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/salinity/netcdf/decav/1.00/woa23_decav_s00_01.nc`
- **HTTPS Download URL (Fallback)**:
  - Temperature: `https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA/temperature/netcdf/decav/1.00/woa23_decav_t00_01.nc`
  - Salinity: `https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA/salinity/netcdf/decav/1.00/woa23_decav_s00_01.nc`
- **Format Received**: NetCDF4 (CF-1.8 compliant)
- **Variables Obtained**: 
  - `t_an` (Objectively analyzed mean temperature, °C)
  - `s_an` (Objectively analyzed mean salinity, PSU)
- **Temporal Nature**: Static historical climatology annual mean (no time dimension / `nTime = 1`).

### Monthly Temperature & Salinity Grids (Seasonal Cycle)
- **Source Provider**: NOAA NCEI
- **Data Type**: Historical climatology gridded analysis monthly fields
- **OPeNDAP URL Pattern**:
  - Temperature: `https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/temperature/netcdf/decav/1.00/woa23_decav_t{month:02d}_01.nc` (where `{month}` is `01` to `12`)
- **Format Received**: NetCDF4 (CF-1.8 compliant)
- **Variables Obtained**:
  - `t_an` (Objectively analyzed mean temperature, °C)
- **Temporal Nature**: Static climatology seasonal cycle (12 monthly frames: `Jan` to `Dec`).

---

## 2. HYCOM GLBu0.08 expt_93.0 Ocean Currents Model

- **Source Provider**: Hybrid Coordinate Ocean Model (HYCOM) Consortium
- **Data Type**: Remote operational model forecast simulation
- **OPeNDAP URL**: `https://tds.hycom.org/thredds/dodsC/GLBu0.08/expt_93.0`
- **Format Received**: NetCDF4 (CF-1.0 compliant)
- **Variables Obtained**:
  - `water_u` (Eastward water velocity, m/s)
  - `water_v` (Northward water velocity, m/s)
- **Temporal Nature**: Historical model analysis field (single time slice captured at `time=0`).

---

## 3. Ifremer Argo Floats Observation Profiles

- **Source Provider**: Ifremer (French Research Institute for Exploitation of the Sea) ERDDAP Server
- **Data Type**: Live observation profile trajectories
- **ERDDAP tabledap CSV URL**: `https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.csv?platform_number,cycle_number,time,latitude,longitude,pres,temp,psal&time>=2024-06-01T00:00:00Z&longitude>=60&longitude<=100&latitude>=-35&latitude<=30`
- **Format Received**: Tabular ASCII CSV (skipping unit header rows during csv parsing)
- **Variables Obtained**:
  - `pres` (Sea water pressure, decibar; coerced directly to depth in meters)
  - `temp` (Sea water temperature, °C)
  - `psal` (Sea water practical salinity, PSU)
- **Temporal Nature**: Live observations updated continuously. The script queries a window starting `2024-06-01`.

---

## 4. IOOS Glider DAC Observation Profiles

- **Source Provider**: IOOS (Integrated Ocean Observing System) Glider Assembly Center (DAC)
- **Data Type**: Historical observation deployment profile tracks
- **Index URL**: `https://gliders.ioos.us/erddap/tabledap/allDatasets.csv?datasetID,title,minLongitude,maxLongitude,minLatitude,maxLatitude`
- **Data Query URL Pattern**: `https://gliders.ioos.us/erddap/tabledap/{datasetID}.csv?time,latitude,longitude,depth,temperature,salinity&latitude>=-35&latitude<=30&longitude>=40&longitude<=100` (e.g. fallback dataset: `ru29-20161105T0131`)
- **Format Received**: Tabular ASCII CSV
- **Variables Obtained**:
  - `depth` (Glider depth, meters)
  - `temperature` (Water temperature, °C)
  - `salinity` (Water salinity, PSU)
- **Temporal Nature**: Historical deployment profiles.

---

## 5. Ifremer Synthetic BGC-Argo Observation Profiles

- **Source Provider**: Ifremer ERDDAP Server
- **Data Type**: Remote synthetic/simulated biogeochemical observations
- **ERDDAP tabledap CSV URL**: `https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats-synthetic-BGC.csv?platform_number,cycle_number,time,latitude,longitude,pres,chla&time>=2026-03-01T00:00:00Z&longitude>=60&longitude<=75&latitude>=5&latitude<=25`
- **Format Received**: Tabular ASCII CSV
- **Variables Obtained**:
  - `pres` (Sea water pressure, decibar; coerced directly to depth in meters)
  - `chla` (Chlorophyll-a concentration, mg/m³)
- **Temporal Nature**: Synthetic observations query window starting `2026-03-01`.
