"""
backend/services/wcs_service.py
-------------------------------
Native OGC Web Coverage Service (WCS 2.0.1 & 1.0.0) Implementation for SagarDrishti-3D.

Features:
  - Valid OGC WCS 2.0.1 & 1.0.0 GetCapabilities XML metadata.
  - Standard DescribeCoverage XML specifications for numerical oceanographic coverages.
  - High-performance GetCoverage generation returning true numerical grid arrays in
    scientific NetCDF-4 (application/x-netcdf) and 32-bit floating-point GeoTIFF (image/tiff).
  - Accurate multidimensional subsetting across time, depth, and spatial bounding boxes.
  - Standard OGC ExceptionReport XML error handling.
"""
from __future__ import annotations

import io
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple
from xml.sax.saxutils import escape

import numpy as np
import xarray as xr
from PIL import Image

from backend.services.model_service import ModelService

log = logging.getLogger("sagardrishti.wcs")

COVERAGE_CATALOG: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "title": "Sea Water Potential Temperature Coverage (thetao)",
        "abstract": "Gridded numerical potential temperature field from CMEMS Physical model.",
        "var_name": "thetao",
        "unit": "°C",
        "standard_name": "sea_water_potential_temperature",
        "is_bgc": False,
        "aliases": ["thetao", "temp", "sst"],
    },
    "salinity": {
        "title": "Sea Water Practical Salinity Coverage (so)",
        "abstract": "Gridded numerical practical salinity field from CMEMS Physical model.",
        "var_name": "so",
        "unit": "PSU",
        "standard_name": "sea_water_practical_salinity",
        "is_bgc": False,
        "aliases": ["so", "sal", "sss"],
    },
    "chlorophyll": {
        "title": "Mass Concentration of Chlorophyll-a Coverage (chl)",
        "abstract": "Gridded numerical surface/water-column chlorophyll concentration from CMEMS BGC model.",
        "var_name": "chl",
        "unit": "mg/m³",
        "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
        "is_bgc": True,
        "aliases": ["chl", "chla"],
    },
    "u_velocity": {
        "title": "Eastward Current Velocity Coverage (uo)",
        "abstract": "Gridded numerical eastward horizontal ocean current velocity from CMEMS.",
        "var_name": "uo",
        "unit": "m/s",
        "standard_name": "eastward_sea_water_velocity",
        "is_bgc": False,
        "aliases": ["uo"],
    },
    "v_velocity": {
        "title": "Northward Current Velocity Coverage (vo)",
        "abstract": "Gridded numerical northward horizontal ocean current velocity from CMEMS.",
        "var_name": "vo",
        "unit": "m/s",
        "standard_name": "northward_sea_water_velocity",
        "is_bgc": False,
        "aliases": ["vo"],
    },
    "currents": {
        "title": "Ocean Current Velocity Magnitude Coverage (Speed)",
        "abstract": "Gridded numerical horizontal current speed magnitude calculated via sqrt(uo² + vo²).",
        "var_name": "current_speed",
        "unit": "m/s",
        "standard_name": "sea_water_speed",
        "is_bgc": False,
        "aliases": ["current_speed", "speed", "velocity_magnitude"],
    },
}

SUPPORTED_CRS = ["EPSG:4326", "CRS:84", "EPSG:3857"]
SUPPORTED_FORMATS = [
    "application/x-netcdf",
    "application/netcdf",
    "image/tiff",
    "image/geotiff",
]


class WCSService:
    """
    OGC Web Coverage Service (WCS 2.0.1 & 1.0.0) Engine.
    """

    def __init__(self, model_service: ModelService):
        self.model_service = model_service

    def _resolve_coverage_key(self, name: str) -> Optional[str]:
        target = name.strip().lower()
        if target in COVERAGE_CATALOG:
            return target
        for key, spec in COVERAGE_CATALOG.items():
            if target in spec.get("aliases", []):
                return key
        return None

    def get_capabilities_xml(self, base_url: str, version: str = "2.0.1") -> str:
        """
        Generate a valid OGC WCS 2.0.1 / 1.0.0 GetCapabilities XML document.
        """
        meta = self.model_service.get_metadata()
        lat_range = meta.get("latitude_range", (-35.0, 30.0))
        lon_range = meta.get("longitude_range", (40.0, 100.0))
        lat_min, lat_max = float(lat_range[0]), float(lat_range[1])
        lon_min, lon_max = float(lon_range[0]), float(lon_range[1])

        clean_url = escape(base_url.rstrip("?&"))

        if version.startswith("1."):
            return self._build_capabilities_1_0_0(clean_url, lat_min, lat_max, lon_min, lon_max)
        return self._build_capabilities_2_0_1(clean_url, lat_min, lat_max, lon_min, lon_max)

    def _build_capabilities_2_0_1(
        self, base_url: str, lat_min: float, lat_max: float, lon_min: float, lon_max: float
    ) -> str:
        coverage_summaries = []
        for cov_id, info in COVERAGE_CATALOG.items():
            coverage_summaries.append(f"""
    <wcs:CoverageSummary>
      <wcs:CoverageId>{escape(cov_id)}</wcs:CoverageId>
      <wcs:CoverageSubtype>GridCoverage</wcs:CoverageSubtype>
      <ows:Title>{escape(info['title'])}</ows:Title>
      <ows:Abstract>{escape(info['abstract'])}</ows:Abstract>
      <ows:WGS84BoundingBox>
        <ows:LowerCorner>{lon_min:.4f} {lat_min:.4f}</ows:LowerCorner>
        <ows:UpperCorner>{lon_max:.4f} {lat_max:.4f}</ows:UpperCorner>
      </ows:WGS84BoundingBox>
      <ows:BoundingBox crs="http://www.opengis.net/def/crs/EPSG/0/4326">
        <ows:LowerCorner>{lat_min:.4f} {lon_min:.4f}</ows:LowerCorner>
        <ows:UpperCorner>{lat_max:.4f} {lon_max:.4f}</ows:UpperCorner>
      </ows:BoundingBox>
    </wcs:CoverageSummary>""")

        summaries_joined = "\n".join(coverage_summaries)

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<wcs:Capabilities version="2.0.1"
    xmlns:wcs="http://www.opengis.net/wcs/2.0"
    xmlns:ows="http://www.opengis.net/ows/2.0"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wcs/2.0 http://schemas.opengis.net/wcs/2.0/wcsGetCapabilities.xsd">
  <ows:ServiceIdentification>
    <ows:Title>SagarDrishti-3D Ocean Model Web Coverage Service</ows:Title>
    <ows:Abstract>OGC Web Coverage Service (WCS 2.0.1) providing direct access to raw numerical gridded ocean model coverages (NetCDF-4 and GeoTIFF) from Copernicus Marine Service (CMEMS) archives across the Indian Ocean basin.</ows:Abstract>
    <ows:Keywords>
      <ows:Keyword>Oceanography</ows:Keyword>
      <ows:Keyword>Indian Ocean</ows:Keyword>
      <ows:Keyword>CMEMS</ows:Keyword>
      <ows:Keyword>Temperature</ows:Keyword>
      <ows:Keyword>Salinity</ows:Keyword>
      <ows:Keyword>Chlorophyll</ows:Keyword>
      <ows:Keyword>Currents</ows:Keyword>
      <ows:Keyword>WCS</ows:Keyword>
    </ows:Keywords>
    <ows:ServiceType>OGC WCS</ows:ServiceType>
    <ows:ServiceTypeVersion>2.0.1</ows:ServiceTypeVersion>
    <ows:ServiceTypeVersion>1.0.0</ows:ServiceTypeVersion>
    <ows:Fees>NONE</ows:Fees>
    <ows:AccessConstraints>Public Access for Scientific and Research Applications</ows:AccessConstraints>
  </ows:ServiceIdentification>
  <ows:ServiceProvider>
    <ows:ProviderName>Ministry of Earth Sciences / INCOIS</ows:ProviderName>
    <ows:ProviderSite xlink:href="{base_url}"/>
    <ows:ServiceContact>
      <ows:IndividualName>SagarDrishti-3D Technical Lead</ows:IndividualName>
      <ows:PositionName>Ocean Data Architect</ows:PositionName>
      <ows:ContactInfo>
        <ows:Address>
          <ows:DeliveryPoint>Pragati Vihar</ows:DeliveryPoint>
          <ows:City>Hyderabad</ows:City>
          <ows:AdministrativeArea>Telangana</ows:AdministrativeArea>
          <ows:PostalCode>500090</ows:PostalCode>
          <ows:Country>India</ows:Country>
          <ows:ElectronicMailAddress>sagardrishti@incois.gov.in</ows:ElectronicMailAddress>
        </ows:Address>
      </ows:ContactInfo>
    </ows:ServiceContact>
  </ows:ServiceProvider>
  <ows:OperationsMetadata>
    <ows:Operation name="GetCapabilities">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get xlink:href="{base_url}"/>
        </ows:HTTP>
      </ows:DCP>
    </ows:Operation>
    <ows:Operation name="DescribeCoverage">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get xlink:href="{base_url}"/>
        </ows:HTTP>
      </ows:DCP>
    </ows:Operation>
    <ows:Operation name="GetCoverage">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get xlink:href="{base_url}"/>
        </ows:HTTP>
      </ows:DCP>
    </ows:Operation>
  </ows:OperationsMetadata>
  <wcs:ServiceMetadata>
    <wcs:formatSupported>application/x-netcdf</wcs:formatSupported>
    <wcs:formatSupported>image/tiff</wcs:formatSupported>
    <wcs:Extension>
      <wcs:crsSupported>http://www.opengis.net/def/crs/EPSG/0/4326</wcs:crsSupported>
      <wcs:crsSupported>http://www.opengis.net/def/crs/OGC/1.3/CRS84</wcs:crsSupported>
      <wcs:crsSupported>http://www.opengis.net/def/crs/EPSG/0/3857</wcs:crsSupported>
    </wcs:Extension>
  </wcs:ServiceMetadata>
  <wcs:Contents>
{summaries_joined}
  </wcs:Contents>
</wcs:Capabilities>"""

    def _build_capabilities_1_0_0(
        self, base_url: str, lat_min: float, lat_max: float, lon_min: float, lon_max: float
    ) -> str:
        coverage_offerings = []
        for cov_id, info in COVERAGE_CATALOG.items():
            coverage_offerings.append(f"""
    <CoverageOfferingBrief>
      <name>{escape(cov_id)}</name>
      <label>{escape(info['title'])}</label>
      <description>{escape(info['abstract'])}</description>
      <lonLatEnvelope srsName="WGS84(DD)">
        <pos>{lon_min:.4f} {lat_min:.4f}</pos>
        <pos>{lon_max:.4f} {lat_max:.4f}</pos>
      </lonLatEnvelope>
    </CoverageOfferingBrief>""")

        offerings_joined = "\n".join(coverage_offerings)

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<WCS_Capabilities version="1.0.0" xmlns="http://www.opengis.net/wcs"
    xmlns:xlink="http://www.w3.org/1999/xlink">
  <Service>
    <name>OGC:WCS</name>
    <label>SagarDrishti-3D Ocean Model Web Coverage Service</label>
    <description>OGC Web Coverage Service (WCS 1.0.0) providing access to numerical gridded ocean model coverages from CMEMS archives.</description>
    <fees>NONE</fees>
    <accessConstraints>Public Access for Research</accessConstraints>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities><DCPType><HTTP><Get><OnlineResource xlink:href="{base_url}"/></Get></HTTP></DCPType></GetCapabilities>
      <DescribeCoverage><DCPType><HTTP><Get><OnlineResource xlink:href="{base_url}"/></Get></HTTP></DCPType></DescribeCoverage>
      <GetCoverage><DCPType><HTTP><Get><OnlineResource xlink:href="{base_url}"/></Get></HTTP></DCPType></GetCoverage>
    </Request>
  </Capability>
  <ContentMetadata>
{offerings_joined}
  </ContentMetadata>
</WCS_Capabilities>"""

    def describe_coverage_xml(self, coverage_ids: List[str], version: str = "2.0.1") -> str:
        """
        Generate a valid CoverageDescriptions XML document for the requested coverages.
        """
        meta = self.model_service.get_metadata()
        times = self.model_service.get_times()
        phy_depths = self.model_service.get_depths("temperature")
        bgc_depths = self.model_service.get_depths("chlorophyll")

        lat_range = meta.get("latitude_range", (-35.0, 30.0))
        lon_range = meta.get("longitude_range", (40.0, 100.0))
        lat_min, lat_max = float(lat_range[0]), float(lat_range[1])
        lon_min, lon_max = float(lon_range[0]), float(lon_range[1])

        time_begin = times[0] if times else "2026-01-01"
        time_end = times[-1] if times else "2026-03-31"

        descriptions = []
        for raw_id in coverage_ids:
            cov_key = self._resolve_coverage_key(raw_id)
            if not cov_key:
                continue
            info = COVERAGE_CATALOG[cov_key]
            depth_list = bgc_depths if info.get("is_bgc") else phy_depths
            min_depth = float(depth_list[0]) if depth_list else 0.5
            max_depth = float(depth_list[-1]) if depth_list else 1941.9

            descriptions.append(f"""
  <wcs:CoverageDescription gml:id="{escape(cov_key)}">
    <gml:boundedBy>
      <gml:Envelope srsName="http://www.opengis.net/def/crs/EPSG/0/4326" axisLabels="Lat Long" uomLabels="deg deg" srsDimension="2">
        <gml:lowerCorner>{lat_min:.4f} {lon_min:.4f}</gml:lowerCorner>
        <gml:upperCorner>{lat_max:.4f} {lon_max:.4f}</gml:upperCorner>
      </gml:Envelope>
    </gml:boundedBy>
    <wcs:CoverageId>{escape(cov_key)}</wcs:CoverageId>
    <gmlcov:metadata>
      <gmlcov:Extension>
        <ows:Title>{escape(info['title'])}</ows:Title>
        <ows:Abstract>{escape(info['abstract'])}</ows:Abstract>
        <temporalDomain>
          <timeBegin>{time_begin}</timeBegin>
          <timeEnd>{time_end}</timeEnd>
          <timeStepCount>{len(times)}</timeStepCount>
        </temporalDomain>
        <elevationDomain>
          <minElevation>{min_depth:.2f}</minElevation>
          <maxElevation>{max_depth:.2f}</maxElevation>
          <depthLevelsCount>{len(depth_list)}</depthLevelsCount>
          <uom>meters</uom>
        </elevationDomain>
      </gmlcov:Extension>
    </gmlcov:metadata>
    <gml:domainSet>
      <gml:Grid dimension="2" gml:id="grid0_{escape(cov_key)}">
        <gml:limits>
          <gml:GridEnvelope>
            <gml:low>0 0</gml:low>
            <gml:high>780 720</gml:high>
          </gml:GridEnvelope>
        </gml:limits>
        <gml:axisLabels>Lat Long</gml:axisLabels>
      </gml:Grid>
    </gml:domainSet>
    <gmlcov:rangeType>
      <swe:DataRecord>
        <swe:field name="{escape(info['var_name'])}">
          <swe:Quantity definition="http://www.opengis.net/def/property/OGC/0/{escape(info['standard_name'])}">
            <swe:description>{escape(info['title'])}</swe:description>
            <swe:uom code="{escape(info['unit'])}"/>
            <swe:nilValues>
              <swe:NilValues>
                <swe:nilValue reason="http://www.opengis.net/def/nil/OGC/0/missing">-9999.0</swe:nilValue>
              </swe:NilValues>
            </swe:nilValues>
          </swe:Quantity>
        </swe:field>
      </swe:DataRecord>
    </gmlcov:rangeType>
    <wcs:ServiceParameters>
      <wcs:nativeFormat>application/x-netcdf</wcs:nativeFormat>
    </wcs:ServiceParameters>
  </wcs:CoverageDescription>""")

        if not descriptions:
            return self.make_service_exception_xml(
                "NoSuchCoverage",
                f"None of the requested coverages '{coverage_ids}' were found. Available coverages: {list(COVERAGE_CATALOG.keys())}"
            )

        descriptions_joined = "\n".join(descriptions)
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<wcs:CoverageDescriptions
    xmlns:wcs="http://www.opengis.net/wcs/2.0"
    xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:gmlcov="http://www.opengis.net/gmlcov/1.0"
    xmlns:swe="http://www.opengis.net/swe/2.0"
    xmlns:ows="http://www.opengis.net/ows/2.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wcs/2.0 http://schemas.opengis.net/wcs/2.0/wcsDescribeCoverage.xsd">
{descriptions_joined}
</wcs:CoverageDescriptions>"""

    def get_coverage(
        self,
        coverage_id: str,
        bbox: Optional[str] = None,
        subset_params: Optional[List[str]] = None,
        time_val: Optional[str] = None,
        elevation: float = 0.5,
        format_type: str = "application/x-netcdf",
        crs: str = "EPSG:4326",
    ) -> Tuple[bytes, str, str]:
        """
        Execute OGC GetCoverage request:
        Subsets the actual CMEMS NetCDF model field and returns numerical NetCDF-4 or 32-bit Float GeoTIFF.
        Returns: (file_bytes, mime_type, filename)
        """
        cov_key = self._resolve_coverage_key(coverage_id)
        if not cov_key:
            raise ValueError(f"Coverage '{coverage_id}' is not supported. Available: {list(COVERAGE_CATALOG.keys())}")

        info = COVERAGE_CATALOG[cov_key]

        # Parse spatial and dimensional subsets
        lat_min, lat_max = -35.0, 30.0
        lon_min, lon_max = 40.0, 100.0
        target_date = "2026-02-15"
        target_depth = elevation

        # 1. Parse BBOX if provided (minLon,minLat,maxLon,maxLat or minLat,minLon,maxLat,maxLon)
        if bbox:
            try:
                coords = [float(c.strip()) for c in bbox.split(",")]
                if len(coords) == 4:
                    if crs.upper() == "CRS:84" or crs.upper() == "EPSG:4326":
                        # Standard lon_min, lat_min, lon_max, lat_max
                        lon_min, lat_min, lon_max, lat_max = coords[0], coords[1], coords[2], coords[3]
                    elif crs.upper() == "EPSG:3857":
                        # Web mercator meters
                        lon_min = (coords[0] / 20037508.34) * 180.0
                        lon_max = (coords[2] / 20037508.34) * 180.0
                        lat_min = 180.0 / math.pi * (2.0 * math.atan(math.exp((coords[1] / 20037508.34) * math.pi)) - math.pi / 2.0)
                        lat_max = 180.0 / math.pi * (2.0 * math.atan(math.exp((coords[3] / 20037508.34) * math.pi)) - math.pi / 2.0)
                    else:
                        lon_min, lat_min, lon_max, lat_max = coords[0], coords[1], coords[2], coords[3]
            except Exception:
                raise ValueError(f"Invalid BBOX parameter '{bbox}'. Expected 4 comma-separated numbers.")

        # 2. Parse WCS 2.0 KVP SUBSET parameters e.g. SUBSET=Lat(-20,15)&SUBSET=Long(55,85)&SUBSET=time("2026-02-15")
        if subset_params:
            for s in subset_params:
                # Lat subset
                m_lat = re.search(r"(?:lat|latitude|y)\s*\(\s*([-\d\.]+)\s*,\s*([-\d\.]+)\s*\)", s, re.IGNORECASE)
                if m_lat:
                    lat_min, lat_max = float(m_lat.group(1)), float(m_lat.group(2))

                # Long subset
                m_lon = re.search(r"(?:long|longitude|lon|x)\s*\(\s*([-\d\.]+)\s*,\s*([-\d\.]+)\s*\)", s, re.IGNORECASE)
                if m_lon:
                    lon_min, lon_max = float(m_lon.group(1)), float(m_lon.group(2))

                # Time subset
                m_time = re.search(r"time\s*\(\s*\"?([^\",\)]+)\"?\s*\)", s, re.IGNORECASE)
                if m_time:
                    target_date = m_time.group(1).strip().split("T")[0]

                # Elevation subset
                m_elev = re.search(r"(?:elevation|depth|z)\s*\(\s*([-\d\.]+)\s*\)", s, re.IGNORECASE)
                if m_elev:
                    target_depth = float(m_elev.group(1))

        if time_val:
            target_date = time_val.strip().split("T")[0]

        eff_lat_min = max(-35.0, min(lat_min, lat_max))
        eff_lat_max = min(30.0, max(lat_min, lat_max))
        eff_lon_min = max(40.0, min(lon_min, lon_max))
        eff_lon_max = min(100.0, max(lon_min, lon_max))

        # Extract real data slice via ModelService
        if cov_key == "currents":
            u_slice = self.model_service.get_field(
                variable="u_velocity",
                date_str=target_date,
                depth=target_depth,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            v_slice = self.model_service.get_field(
                variable="v_velocity",
                date_str=target_date,
                depth=target_depth,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            u_vals = np.array(u_slice["values"], dtype=np.float32)
            v_vals = np.array(v_slice["values"], dtype=np.float32)
            # Strictly compute sqrt(uo^2 + vo^2)
            raw_data = np.sqrt(u_vals**2 + v_vals**2)
            lats = np.array(u_slice.get("latitudes", []), dtype=np.float32)
            lons = np.array(u_slice.get("longitudes", []), dtype=np.float32)
            resolved_depth = float(u_slice.get("depth", target_depth))
        else:
            data_slice = self.model_service.get_field(
                variable=cov_key,
                date_str=target_date,
                depth=target_depth,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            raw_data = np.array(data_slice["values"], dtype=np.float32)
            lats = np.array(data_slice.get("latitudes", []), dtype=np.float32)
            lons = np.array(data_slice.get("longitudes", []), dtype=np.float32)
            resolved_depth = float(data_slice.get("depth", target_depth))

        fmt_lower = format_type.lower()

        # Format 1: GeoTIFF (32-bit float numerical raster with GeoTIFF tags)
        if "tiff" in fmt_lower or "geotiff" in fmt_lower:
            # Replace NaNs with standard GeoTIFF nodata -9999.0
            fill_val = -9999.0
            tif_data = np.where(np.isnan(raw_data), fill_val, raw_data).astype(np.float32)

            # In image rasters, row 0 is North. If latitudes ascending (-35 to +30), flip vertically.
            if len(lats) > 1 and lats[0] < lats[-1]:
                tif_data = np.flipud(tif_data)

            img = Image.fromarray(tif_data, mode="F")
            buf = io.BytesIO()

            dx = float(abs(lons[1] - lons[0])) if len(lons) > 1 else 0.083
            dy = float(abs(lats[1] - lats[0])) if len(lats) > 1 else 0.083
            top_lat = float(max(lats)) if len(lats) > 0 else eff_lat_max
            left_lon = float(min(lons)) if len(lons) > 0 else eff_lon_min

            tiff_tags = {
                33550: (dx, dy, 0.0),  # ModelPixelScaleTag
                33922: (0.0, 0.0, 0.0, left_lon, top_lat, 0.0),  # ModelTiepointTag
                34735: (1, 1, 0, 7, 1024, 0, 1, 1, 1025, 0, 1, 1, 2048, 0, 1, 4326),  # GeoKeyDirectory EPSG:4326
                42113: str(fill_val),  # GDAL_NODATA
            }
            img.save(buf, format="TIFF", tiffinfo=tiff_tags)
            filename = f"sagardrishti_{cov_key}_{target_date}_{resolved_depth:.1f}m.tif"
            return buf.getvalue(), "image/tiff", filename

        # Format 2: Scientific NetCDF-4 (application/x-netcdf)
        else:
            da = xr.DataArray(
                raw_data,
                coords=[("latitude", lats), ("longitude", lons)],
                name=info["var_name"],
                attrs={
                    "long_name": info["title"],
                    "units": info["unit"],
                    "standard_name": info["standard_name"],
                    "_FillValue": np.float32(-9999.0),
                    "valid_min": np.float32(info.get("min_val", -100.0)),
                    "valid_max": np.float32(info.get("max_val", 100.0)),
                },
            )
            ds = da.to_dataset()
            ds.attrs["title"] = f"SagarDrishti-3D WCS Ocean Coverage — {info['title']}"
            ds.attrs["source"] = "Copernicus Marine Service (CMEMS)"
            ds.attrs["time"] = target_date
            ds.attrs["depth_meters"] = float(resolved_depth)
            ds.attrs["spatial_crs"] = crs
            ds.attrs["institution"] = "Ministry of Earth Sciences / INCOIS"
            ds.attrs["Conventions"] = "CF-1.8"

            nc_bytes = ds.to_netcdf(format="NETCDF4")
            filename = f"sagardrishti_{cov_key}_{target_date}_{resolved_depth:.1f}m.nc"
            return nc_bytes, "application/x-netcdf", filename

    def make_service_exception_xml(self, code: str, message: str) -> str:
        """Generate standard OGC ExceptionReport XML."""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<ows:ExceptionReport version="2.0.1"
    xmlns:ows="http://www.opengis.net/ows/2.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/ows/2.0 http://schemas.opengis.net/ows/2.0/owsExceptionReport.xsd">
  <ows:Exception exceptionCode="{escape(code)}">
    <ows:ExceptionText>{escape(message)}</ows:ExceptionText>
  </ows:Exception>
</ows:ExceptionReport>"""
