"""
backend/services/wms_service.py
-------------------------------
Native OGC Web Map Service (WMS 1.3.0 & 1.1.1) Implementation for Sagar Netra 3D.

Features:
  - Valid OGC WMS 1.3.0 & 1.1.1 GetCapabilities XML metadata.
  - 2D raster GetMap generation directly from CMEMS NetCDF model archives.
  - Standard GetLegendGraphic generation for all exposed ocean layers.
  - Scientific oceanographic colormaps (turbo, viridis, YlGn, coolwarm, plasma).
  - Multi-CRS support (EPSG:4326, CRS:84, EPSG:3857) with standard axis ordering.
  - Multi-depth and multi-temporal dimensional querying with accurate model coordinate bounds.
  - OGC ServiceExceptionReport XML error handling.
"""
from __future__ import annotations

import io
import logging
import math
from typing import Any, Dict, List, Optional, Tuple
from xml.sax.saxutils import escape

import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib as mpl

from backend.services.model_service import ModelService

log = logging.getLogger("sagarnetra.wms")

# Layer specification with title, standard name, unit, and default colormap
LAYER_CATALOG: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "title": "Sea Water Potential Temperature (thetao)",
        "abstract": "Potential temperature of the water column from CMEMS Physical model.",
        "unit": "°C",
        "cmap": "turbo",
        "min_val": 5.0,
        "max_val": 32.0,
        "is_bgc": False,
        "aliases": ["thetao", "temp", "sst"],
    },
    "salinity": {
        "title": "Sea Water Practical Salinity (so)",
        "abstract": "Practical salinity of the ocean water column from CMEMS Physical model.",
        "unit": "PSU",
        "cmap": "viridis",
        "min_val": 30.0,
        "max_val": 37.0,
        "is_bgc": False,
        "aliases": ["so", "sal", "sss"],
    },
    "chlorophyll": {
        "title": "Mass Concentration of Chlorophyll-a (chl)",
        "abstract": "Biogeochemical chlorophyll concentration from CMEMS BGC model.",
        "unit": "mg/m³",
        "cmap": "YlGn",
        "min_val": 0.01,
        "max_val": 2.5,
        "is_bgc": True,
        "aliases": ["chl", "chla"],
    },
    "u_velocity": {
        "title": "Eastward Current Velocity (uo)",
        "abstract": "Zonal eastward component of horizontal ocean current from CMEMS Physical model.",
        "unit": "m/s",
        "cmap": "coolwarm",
        "min_val": -1.0,
        "max_val": 1.0,
        "is_bgc": False,
        "aliases": ["uo"],
    },
    "v_velocity": {
        "title": "Northward Current Velocity (vo)",
        "abstract": "Meridional northward component of horizontal ocean current from CMEMS Physical model.",
        "unit": "m/s",
        "cmap": "coolwarm",
        "min_val": -1.0,
        "max_val": 1.0,
        "is_bgc": False,
        "aliases": ["vo"],
    },
    "currents": {
        "title": "Ocean Current Velocity Magnitude (Speed)",
        "abstract": "Total horizontal current velocity magnitude computed via sqrt(uo² + vo²).",
        "unit": "m/s",
        "cmap": "plasma",
        "min_val": 0.0,
        "max_val": 1.5,
        "is_bgc": False,
        "aliases": ["current_speed", "speed", "velocity_magnitude"],
    },
}

SUPPORTED_CRS = ["EPSG:4326", "CRS:84", "EPSG:3857"]
SUPPORTED_FORMATS = ["image/png", "image/jpeg"]


def _reproject_web_mercator_to_wgs84(minx: float, miny: float, maxx: float, maxy: float) -> Tuple[float, float, float, float]:
    """Convert EPSG:3857 bounding box (meters) to EPSG:4326 (lon/lat degrees)."""
    def meters_to_lon(x: float) -> float:
        return (x / 20037508.34) * 180.0

    def meters_to_lat(y: float) -> float:
        y_val = (y / 20037508.34) * 180.0
        return 180.0 / math.pi * (2.0 * math.atan(math.exp(y_val * (math.pi / 180.0))) - math.pi / 2.0)

    lon_min = meters_to_lon(minx)
    lon_max = meters_to_lon(maxx)
    lat_min = meters_to_lat(miny)
    lat_max = meters_to_lat(maxy)
    return lon_min, lat_min, lon_max, lat_max


class WMSService:
    """
    OGC Web Map Service 1.3.0 & 1.1.1 Engine.
    """

    def __init__(self, model_service: ModelService):
        self.model_service = model_service

    def _resolve_layer_key(self, layer_name: str) -> Optional[str]:
        """Resolve layer name or alias to canonical layer key."""
        target = layer_name.strip().lower()
        if target in LAYER_CATALOG:
            return target
        for key, spec in LAYER_CATALOG.items():
            if target in spec.get("aliases", []):
                return key
        return None

    def get_capabilities_xml(self, base_url: str, version: str = "1.3.0") -> str:
        """
        Generate a fully standards-compliant OGC WMS GetCapabilities XML document.
        """
        meta = self.model_service.get_metadata()
        times = self.model_service.get_times()
        phy_depths = self.model_service.get_depths("temperature")
        bgc_depths = self.model_service.get_depths("chlorophyll")

        time_str = ",".join(times) if times else "2026-01-01"
        phy_depth_str = ",".join(str(round(d, 2)).rstrip("0").rstrip(".") for d in phy_depths) if phy_depths else "0.5"
        bgc_depth_str = ",".join(str(round(d, 2)).rstrip("0").rstrip(".") for d in bgc_depths) if bgc_depths else "0.5"

        lat_range = meta.get("latitude_range", (-35.0, 30.0))
        lon_range = meta.get("longitude_range", (40.0, 100.0))
        lat_min, lat_max = float(lat_range[0]), float(lat_range[1])
        lon_min, lon_max = float(lon_range[0]), float(lon_range[1])

        clean_base_url = escape(base_url.rstrip("?&"))

        if version == "1.1.1":
            return self._build_capabilities_1_1_1(
                clean_base_url, times, phy_depth_str, bgc_depth_str, time_str, lat_min, lat_max, lon_min, lon_max
            )
        return self._build_capabilities_1_3_0(
            clean_base_url, times, phy_depth_str, bgc_depth_str, time_str, lat_min, lat_max, lon_min, lon_max
        )

    def _build_capabilities_1_3_0(
        self,
        base_url: str,
        times: List[str],
        phy_depth_str: str,
        bgc_depth_str: str,
        time_str: str,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
    ) -> str:
        layers_xml = []
        for key, info in LAYER_CATALOG.items():
            default_time = times[0] if times else "2026-01-01"
            layer_depth_str = bgc_depth_str if info.get("is_bgc") else phy_depth_str
            layers_xml.append(f"""
    <Layer queryable="0">
      <Name>{escape(key)}</Name>
      <Title>{escape(info['title'])}</Title>
      <Abstract>{escape(info['abstract'])}</Abstract>
      <CRS>EPSG:4326</CRS>
      <CRS>CRS:84</CRS>
      <CRS>EPSG:3857</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>{lon_min:.4f}</westBoundLongitude>
        <eastBoundLongitude>{lon_max:.4f}</eastBoundLongitude>
        <southBoundLatitude>{lat_min:.4f}</southBoundLatitude>
        <northBoundLatitude>{lat_max:.4f}</northBoundLatitude>
      </EX_GeographicBoundingBox>
      <BoundingBox CRS="EPSG:4326" minx="{lat_min:.4f}" miny="{lon_min:.4f}" maxx="{lat_max:.4f}" maxy="{lon_max:.4f}"/>
      <BoundingBox CRS="CRS:84" minx="{lon_min:.4f}" miny="{lat_min:.4f}" maxx="{lon_max:.4f}" maxy="{lat_max:.4f}"/>
      <Dimension name="time" units="ISO8601" default="{default_time}">{escape(time_str)}</Dimension>
      <Dimension name="elevation" units="meters" default="0.5">{escape(layer_depth_str)}</Dimension>
      <Style>
        <Name>default</Name>
        <Title>Standard Oceanographic Palette</Title>
        <LegendURL width="160" height="40">
          <Format>image/png</Format>
          <OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:type="simple" xlink:href="{base_url}?SERVICE=WMS&amp;REQUEST=GetLegendGraphic&amp;LAYER={key}&amp;FORMAT=image/png"/>
        </LegendURL>
      </Style>
    </Layer>""")

        layers_joined = "\n".join(layers_xml)

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" updateSequence="1"
    xmlns="http://www.opengis.net/wms"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wms http://schemas.opengis.net/wms/1.3.0/capabilities_1_3_0.xsd">
  <Service>
    <Name>WMS</Name>
    <Title>Sagar Netra 3D Ocean Model WMS Service</Title>
    <Abstract>OGC Web Map Service providing 2D georeferenced oceanographic map layers generated from Copernicus Marine Service (CMEMS) numerical model archives (Q1 2026) across the Indian Ocean basin.</Abstract>
    <KeywordList>
      <Keyword>Oceanography</Keyword>
      <Keyword>Indian Ocean</Keyword>
      <Keyword>CMEMS</Keyword>
      <Keyword>Temperature</Keyword>
      <Keyword>Salinity</Keyword>
      <Keyword>Chlorophyll</Keyword>
      <Keyword>Currents</Keyword>
      <Keyword>Sagar Netra 3D</Keyword>
    </KeywordList>
    <OnlineResource xlink:type="simple" xlink:href="{base_url}"/>
    <ContactInformation>
      <ContactPersonPrimary>
        <ContactPerson>Sagar Netra 3D Ocean Science Team</ContactPerson>
        <ContactOrganization>Ministry of Earth Sciences / INCOIS</ContactOrganization>
      </ContactPersonPrimary>
      <ContactPosition>Technical Lead</ContactPosition>
      <ContactAddress>
        <AddressType>postal</AddressType>
        <Address>Pragati Vihar</Address>
        <City>Hyderabad</City>
        <StateOrProvince>Telangana</StateOrProvince>
        <PostCode>500090</PostCode>
        <Country>India</Country>
      </ContactAddress>
      <ContactVoiceTelephone>+91-40-23895000</ContactVoiceTelephone>
      <ContactElectronicMailAddress>sagarnetra@incois.gov.in</ContactElectronicMailAddress>
    </ContactInformation>
    <Fees>NONE</Fees>
    <AccessConstraints>Public Access for Scientific and Research Applications</AccessConstraints>
    <LayerLimit>10</LayerLimit>
    <MaxWidth>4096</MaxWidth>
    <MaxHeight>4096</MaxHeight>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities>
        <Format>text/xml</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="{base_url}"/></Get>
          </HTTP>
        </DCPType>
      </GetCapabilities>
      <GetMap>
        <Format>image/png</Format>
        <Format>image/jpeg</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="{base_url}"/></Get>
          </HTTP>
        </DCPType>
      </GetMap>
      <GetLegendGraphic>
        <Format>image/png</Format>
        <Format>image/jpeg</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="{base_url}"/></Get>
          </HTTP>
        </DCPType>
      </GetLegendGraphic>
    </Request>
    <Exception>
      <Format>XML</Format>
      <Format>INIMAGE</Format>
    </Exception>
    <Layer>
      <Title>Sagar Netra 3D Ocean Layers</Title>
      <CRS>EPSG:4326</CRS>
      <CRS>CRS:84</CRS>
      <CRS>EPSG:3857</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>{lon_min:.4f}</westBoundLongitude>
        <eastBoundLongitude>{lon_max:.4f}</eastBoundLongitude>
        <southBoundLatitude>{lat_min:.4f}</southBoundLatitude>
        <northBoundLatitude>{lat_max:.4f}</northBoundLatitude>
      </EX_GeographicBoundingBox>
      <BoundingBox CRS="EPSG:4326" minx="{lat_min:.4f}" miny="{lon_min:.4f}" maxx="{lat_max:.4f}" maxy="{lon_max:.4f}"/>
      <BoundingBox CRS="CRS:84" minx="{lon_min:.4f}" miny="{lat_min:.4f}" maxx="{lon_max:.4f}" maxy="{lat_max:.4f}"/>
{layers_joined}
    </Layer>
  </Capability>
</WMS_Capabilities>"""

    def _build_capabilities_1_1_1(
        self,
        base_url: str,
        times: List[str],
        phy_depth_str: str,
        bgc_depth_str: str,
        time_str: str,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
    ) -> str:
        layers_xml = []
        for key, info in LAYER_CATALOG.items():
            layer_depth_str = bgc_depth_str if info.get("is_bgc") else phy_depth_str
            layers_xml.append(f"""
    <Layer queryable="0">
      <Name>{escape(key)}</Name>
      <Title>{escape(info['title'])}</Title>
      <Abstract>{escape(info['abstract'])}</Abstract>
      <SRS>EPSG:4326</SRS>
      <SRS>EPSG:3857</SRS>
      <LatLonBoundingBox minx="{lon_min:.4f}" miny="{lat_min:.4f}" maxx="{lon_max:.4f}" maxy="{lat_max:.4f}"/>
      <BoundingBox SRS="EPSG:4326" minx="{lon_min:.4f}" miny="{lat_min:.4f}" maxx="{lon_max:.4f}" maxy="{lat_max:.4f}"/>
      <Dimension name="time" units="ISO8601"/>
      <Extent name="time" default="{times[0] if times else '2026-01-01'}">{escape(time_str)}</Extent>
      <Dimension name="elevation" units="meters"/>
      <Extent name="elevation" default="0.5">{escape(layer_depth_str)}</Extent>
    </Layer>""")

        layers_joined = "\n".join(layers_xml)

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE WMT_MS_Capabilities SYSTEM "http://schemas.opengis.net/wms/1.1.1/capabilities_1_1_1.dtd">
<WMT_MS_Capabilities version="1.1.1">
  <Service>
    <Name>OGC:WMS</Name>
    <Title>Sagar Netra 3D Ocean Model WMS Service</Title>
    <Abstract>OGC Web Map Service providing 2D georeferenced oceanographic map layers generated from Copernicus Marine Service (CMEMS) numerical model archives (Q1 2026) across the Indian Ocean basin.</Abstract>
    <OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:type="simple" xlink:href="{base_url}"/>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities>
        <Format>application/vnd.ogc.wms_xml</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:type="simple" xlink:href="{base_url}"/></Get>
          </HTTP>
        </DCPType>
      </GetCapabilities>
      <GetMap>
        <Format>image/png</Format>
        <Format>image/jpeg</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:type="simple" xlink:href="{base_url}"/></Get>
          </HTTP>
        </DCPType>
      </GetMap>
    </Request>
    <Layer>
      <Title>Sagar Netra 3D Ocean Layers</Title>
      <SRS>EPSG:4326</SRS>
      <SRS>EPSG:3857</SRS>
      <LatLonBoundingBox minx="{lon_min:.4f}" miny="{lat_min:.4f}" maxx="{lon_max:.4f}" maxy="{lat_max:.4f}"/>
{layers_joined}
    </Layer>
  </Capability>
</WMT_MS_Capabilities>"""

    def render_map(
        self,
        layer_name: str,
        bbox_str: str,
        width: int,
        height: int,
        crs: str = "EPSG:4326",
        version: str = "1.3.0",
        format_type: str = "image/png",
        transparent: bool = True,
        time_val: Optional[str] = None,
        elevation: float = 0.5,
        style: Optional[str] = None,
    ) -> Tuple[bytes, str]:
        """
        Execute OGC GetMap request: subset the NetCDF array and render a georeferenced raster image.
        """
        layer_key = self._resolve_layer_key(layer_name)
        if not layer_key:
            raise ValueError(f"Layer '{layer_name}' is not supported. Available layers: {list(LAYER_CATALOG.keys())}")

        layer_info = LAYER_CATALOG[layer_key]

        # Parse BBOX coordinates
        try:
            coords = [float(c.strip()) for c in bbox_str.split(",")]
            if len(coords) != 4:
                raise ValueError
        except Exception:
            raise ValueError(f"Invalid BBOX parameter '{bbox_str}'. Expected 4 comma-separated float numbers.")

        # Coordinate axis ordering:
        # In WMS 1.3.0 with EPSG:4326, BBOX is minLat, minLon, maxLat, maxLon
        # In WMS 1.1.1, CRS:84, and EPSG:3857, BBOX is minLon, minLat, maxLon, maxLat
        crs_upper = crs.strip().upper()
        if version == "1.3.0" and crs_upper == "EPSG:4326":
            lat_min, lon_min, lat_max, lon_max = coords[0], coords[1], coords[2], coords[3]
        elif crs_upper == "EPSG:3857":
            minx, miny, maxx, maxy = coords[0], coords[1], coords[2], coords[3]
            lon_min, lat_min, lon_max, lat_max = _reproject_web_mercator_to_wgs84(minx, miny, maxx, maxy)
        else:
            # CRS:84, WMS 1.1.1 EPSG:4326, etc.
            lon_min, lat_min, lon_max, lat_max = coords[0], coords[1], coords[2], coords[3]

        eff_lat_min = max(-35.0, min(lat_min, lat_max))
        eff_lat_max = min(30.0, max(lat_min, lat_max))
        eff_lon_min = max(40.0, min(lon_min, lon_max))
        eff_lon_max = min(100.0, max(lon_min, lon_max))

        # Date resolution
        date_str = time_val.strip().split("T")[0] if time_val else "2026-02-15"

        # Width and height sanity
        width = max(16, min(4096, width))
        height = max(16, min(4096, height))

        # Data extraction via ModelService
        if layer_key == "currents":
            # Current velocity magnitude = sqrt(uo² + vo²)
            u_slice = self.model_service.get_field(
                variable="u_velocity",
                date_str=date_str,
                depth=elevation,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            v_slice = self.model_service.get_field(
                variable="v_velocity",
                date_str=date_str,
                depth=elevation,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            u_vals = np.array(u_slice["values"], dtype=np.float32)
            v_vals = np.array(v_slice["values"], dtype=np.float32)
            raw_data = np.sqrt(u_vals**2 + v_vals**2)
            latitudes = u_slice.get("latitudes", [])
        else:
            data_slice = self.model_service.get_field(
                variable=layer_key,
                date_str=date_str,
                depth=elevation,
                lat_min=eff_lat_min,
                lat_max=eff_lat_max,
                lon_min=eff_lon_min,
                lon_max=eff_lon_max,
            )
            raw_data = np.array(data_slice["values"], dtype=np.float32)
            latitudes = data_slice.get("latitudes", [])

        # Normalize data and apply colormap
        val_min = layer_info["min_val"]
        val_max = layer_info["max_val"]

        # If data is empty or invalid
        if raw_data.size == 0 or np.all(np.isnan(raw_data)):
            img = Image.new("RGBA" if transparent else "RGB", (width, height), (0, 0, 0, 0) if transparent else (255, 255, 255))
            buf = io.BytesIO()
            img_format = "PNG" if "png" in format_type.lower() else "JPEG"
            img.save(buf, format=img_format)
            return buf.getvalue(), f"image/{img_format.lower()}"

        # Standard scientific normalization
        norm_data = np.clip((raw_data - val_min) / (val_max - val_min + 1e-6), 0.0, 1.0)
        
        # Colormap selection
        cmap_name = layer_info["cmap"]
        try:
            colormap = mpl.colormaps.get(cmap_name, mpl.colormaps["viridis"])
        except Exception:
            colormap = mpl.colormaps["viridis"]

        rgba_img = colormap(norm_data)
        
        # Mask out NaNs (e.g. land cells)
        nan_mask = np.isnan(raw_data)
        if transparent:
            rgba_img[nan_mask, 3] = 0.0
        else:
            # Render land as soft oceanographic light grey
            rgba_img[nan_mask] = [0.93, 0.94, 0.96, 1.0]

        # Convert to 8-bit uint8 RGBA
        uint8_img = (rgba_img * 255).astype(np.uint8)

        # Standard Image Coordinate Orientation:
        # In 2D image matrices, Row 0 is Top (North) and Row H-1 is Bottom (South).
        # When dataset latitudes are ascending (-35 to +30), row 0 is South (-35), so flip vertically.
        if len(latitudes) > 1 and latitudes[0] < latitudes[-1]:
            uint8_img = np.flipud(uint8_img)

        # Create PIL Image and resize to requested width x height
        src_image = Image.fromarray(uint8_img, mode="RGBA")
        rendered_image = src_image.resize((width, height), resample=Image.Resampling.BILINEAR)

        # Output encoding
        buf = io.BytesIO()
        if "jpeg" in format_type.lower() or "jpg" in format_type.lower():
            rgb_image = rendered_image.convert("RGB")
            rgb_image.save(buf, format="JPEG", quality=90)
            return buf.getvalue(), "image/jpeg"
        else:
            rendered_image.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png"

    def render_legend_graphic(
        self,
        layer_name: str,
        width: int = 160,
        height: int = 40,
        format_type: str = "image/png",
    ) -> Tuple[bytes, str]:
        """
        Render a clean, scientific colormap legend graphic showing gradient and value range.
        """
        layer_key = self._resolve_layer_key(layer_name) or "temperature"
        info = LAYER_CATALOG[layer_key]

        fig, ax = plt.subplots(figsize=(max(120, width) / 80.0, max(30, height) / 80.0), dpi=80)
        fig.patch.set_alpha(0.0)
        ax.patch.set_alpha(0.0)

        cmap_name = info["cmap"]
        colormap = mpl.colormaps.get(cmap_name, mpl.colormaps["viridis"])
        norm = mpl.colors.Normalize(vmin=info["min_val"], vmax=info["max_val"])

        cb = fig.colorbar(
            mpl.cm.ScalarMappable(norm=norm, cmap=colormap),
            cax=ax,
            orientation="horizontal",
        )
        cb.set_label(f"{info['unit']}", fontsize=8, color="#1e293b", weight="bold")
        cb.ax.tick_params(labelsize=7, colors="#334155")
        fig.tight_layout(pad=0.2)

        buf = io.BytesIO()
        img_fmt = "JPEG" if "jpeg" in format_type.lower() or "jpg" in format_type.lower() else "PNG"
        fig.savefig(buf, format=img_fmt, transparent=True, bbox_inches="tight")
        plt.close(fig)
        return buf.getvalue(), f"image/{img_fmt.lower()}"

    def make_service_exception_xml(self, code: str, message: str) -> str:
        """Generate standard OGC ServiceExceptionReport XML."""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<ServiceExceptionReport version="1.3.0"
    xmlns="http://www.opengis.net/ogc"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/ogc http://schemas.opengis.net/wms/1.3.0/exceptions_1_3_0.xsd">
  <ServiceException code="{escape(code)}">{escape(message)}</ServiceException>
</ServiceExceptionReport>"""
