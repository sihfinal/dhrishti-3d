"""
backend/services/opendap_service.py
-----------------------------------
Native OGC / NASA ESE standard-compliant OPeNDAP DAP 2.0 and THREDDS Scientific Data Service.
Directly exposes real CMEMS Physical and Biogeochemical 4D NetCDF ocean model archives
over the DAP2 wire protocol (DDS, DAS, DODS binary XDR, HTML info, and THREDDS Catalog).

Enables native remote dataset opening and multidimensional server-side subsetting in
scientific clients (e.g., Python xarray/netCDF4, MATLAB, R, GDAL, CDO, and QGIS).
"""
from __future__ import annotations

import collections
import glob
import logging
from pathlib import Path
import re
import threading
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import xarray as xr

import pydap.model as pm
from pydap.responses.dds import DDSResponse
from pydap.responses.das import DASResponse
from pydap.responses.dods import DODSResponse
from pydap.responses.html import HTMLResponse
from webob.request import Request as WebobRequest

log = logging.getLogger(__name__)


def _parse_ce_parts(query_string: str) -> List[Tuple[str, Optional[Tuple[slice, ...]]]]:
    """
    Parse a DAP2 constraint expression projection string.
    Example: 'latitude,longitude,thetao.thetao[0:1:0][0:1:0][100:1:110][200:1:210]'
    Returns list of (var_name, tuple_of_slices_or_None).
    """
    if not query_string:
        return []
    proj_part = query_string.split("&")[0].strip("?")
    results = []
    for part in proj_part.split(","):
        part = part.strip()
        if not part:
            continue
        if "[" in part:
            raw_name = part[: part.index("[")].strip()
            var_name = raw_name.split(".")[-1]
            slices = []
            for s in re.findall(r"\[(\d+)(?::(\d+))?(?::(\d+))?\]", part):
                nums = [int(x) for x in s if x != ""]
                if len(nums) == 1:
                    slices.append(slice(nums[0], nums[0] + 1, 1))
                elif len(nums) == 2:
                    slices.append(slice(nums[0], nums[1] + 1, 1))
                elif len(nums) == 3:
                    slices.append(slice(nums[0], nums[2] + 1, nums[1]))
            results.append((var_name, tuple(slices) if slices else None))
        else:
            var_name = part.split(".")[-1]
            results.append((var_name, None))
    return results


class OpenDAPService:
    """
    High-performance, secure OPeNDAP DAP 2.0 & THREDDS scientific service engine.
    """

    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir).resolve()
        self.phy_dir = self.data_dir / "model" / "copernicus_daily"
        self.bgc_dir = self.data_dir / "model" / "copernicus_chlorophyll_daily"

        self._phy_files: List[str] = sorted(glob.glob(str(self.phy_dir / "*.nc")))
        self._bgc_files: List[str] = sorted(glob.glob(str(self.bgc_dir / "*.nc")))

        self._date_to_phy_file: Dict[str, str] = {}
        self._date_to_bgc_file: Dict[str, str] = {}
        self._index_files()

        self._ds_cache: Dict[str, Tuple[xr.Dataset, pm.DatasetType]] = {}
        self._lock = threading.Lock()

    def _index_files(self) -> None:
        """Index available daily NetCDF files by YYYY-MM-DD for fast O(1) retrieval."""
        for f in self._phy_files:
            stem = Path(f).stem
            if "T00-00-00" in stem:
                d_str = stem.split("_")[-1].replace("T00-00-00", "")
                self._date_to_phy_file[d_str] = f

        for f in self._bgc_files:
            stem = Path(f).stem
            if "T00-00-00" in stem:
                d_str = stem.split("_")[-1].replace("T00-00-00", "")
                self._date_to_bgc_file[d_str] = f

    def get_available_datasets(self) -> List[Dict[str, Any]]:
        """List all valid configured dataset identifiers and metadata."""
        datasets = [
            {
                "id": "cmems_physical",
                "title": "CMEMS Global Ocean Physics Analysis & Forecast (Daily 4D)",
                "variables": ["thetao", "so", "uo", "vo", "currents"],
                "coordinates": ["time", "depth", "latitude", "longitude"],
                "spatial_bounds": {"lat_min": -35.0, "lat_max": 30.0, "lon_min": 40.0, "lon_max": 100.0},
                "depth_range": [0.494, 2000.0],
                "time_range": ["2026-01-01", "2026-03-31"],
                "days_count": len(self._phy_files),
            },
            {
                "id": "cmems_bgc",
                "title": "CMEMS Global Ocean Biogeochemistry Chlorophyll Analysis (Daily 4D)",
                "variables": ["chl"],
                "coordinates": ["time", "depth", "latitude", "longitude"],
                "spatial_bounds": {"lat_min": -35.0, "lat_max": 30.0, "lon_min": 40.0, "lon_max": 100.0},
                "depth_range": [0.505, 2000.0],
                "time_range": ["2026-01-01", "2026-03-31"],
                "days_count": len(self._bgc_files),
            },
        ]
        return datasets

    def _get_xds_and_pds(self, dataset_id: str) -> Optional[Tuple[xr.Dataset, pm.DatasetType]]:
        """Retrieve or build the base (xr.Dataset, pm.DatasetType) pair."""
        with self._lock:
            if dataset_id in self._ds_cache:
                return self._ds_cache[dataset_id]

            xds = None
            pds = None
            if dataset_id in ("cmems_physical", "copernicus_daily", "physics"):
                if not self._phy_files:
                    return None
                file_path = self._phy_files[0]
                xds = xr.open_dataset(file_path, decode_times=False)
                pds = self._create_physical_pydap_ds("cmems_physical", xds)

            elif dataset_id in ("cmems_bgc", "copernicus_chlorophyll_daily", "chlorophyll", "bgc"):
                if not self._bgc_files:
                    return None
                file_path = self._bgc_files[0]
                xds = xr.open_dataset(file_path, decode_times=False)
                pds = self._create_bgc_pydap_ds("cmems_bgc", xds)

            elif dataset_id.startswith("cmems_phy_") or dataset_id in self._date_to_phy_file:
                date_key = dataset_id.replace("cmems_phy_", "")
                if date_key in self._date_to_phy_file:
                    file_path = self._date_to_phy_file[date_key]
                    xds = xr.open_dataset(file_path, decode_times=False)
                    pds = self._create_physical_pydap_ds(f"cmems_phy_{date_key}", xds)

            elif dataset_id.startswith("cmems_bgc_") or dataset_id in self._date_to_bgc_file:
                date_key = dataset_id.replace("cmems_bgc_", "")
                if date_key in self._date_to_bgc_file:
                    file_path = self._date_to_bgc_file[date_key]
                    xds = xr.open_dataset(file_path, decode_times=False)
                    pds = self._create_bgc_pydap_ds(f"cmems_bgc_{date_key}", xds)

            if xds is not None and pds is not None:
                self._ds_cache[dataset_id] = (xds, pds)
                return (xds, pds)

            return None

    def build_pydap_dataset(self, dataset_id: str) -> Optional[pm.DatasetType]:
        """Construct or return base DatasetType."""
        pair = self._get_xds_and_pds(dataset_id)
        return pair[1] if pair else None

    def _create_physical_pydap_ds(self, name: str, xds: xr.Dataset) -> pm.DatasetType:
        """Create DAP2 DatasetType for physical ocean variables."""
        pds = pm.DatasetType(name)

        for coord_name in ["time", "depth", "latitude", "longitude"]:
            if coord_name in xds.coords:
                coord_val = np.asarray(xds[coord_name].values)
                c_var = pm.BaseType(coord_name, coord_val, dims=(coord_name,))
                for k, v in xds[coord_name].attrs.items():
                    c_var.attributes[k] = str(v)
                pds[coord_name] = c_var

        for var_name in ["thetao", "so", "uo", "vo"]:
            if var_name in xds.data_vars:
                var_data = xds[var_name].data
                b_var = pm.BaseType(var_name, var_data, dims=("time", "depth", "latitude", "longitude"))
                # Clean attributes to prevent double scaling in external netCDF clients
                for k, v in xds[var_name].attrs.items():
                    if k not in ("scale_factor", "add_offset", "valid_min", "valid_max"):
                        b_var.attributes[k] = str(v)
                b_var.attributes["_FillValue"] = -9999.0
                pds[var_name] = b_var

        # Global dataset attributes
        for k, v in xds.attrs.items():
            pds.attributes[k] = str(v)
        pds.attributes["institution"] = "INCOIS / SAGAR NETRA 3D Ocean Intelligence"
        pds.attributes["title"] = "CMEMS Physical Ocean Analysis (DAP 2.0)"
        pds.attributes["Conventions"] = "CF-1.8"
        pds.attributes["source"] = "Copernicus Marine Environment Monitoring Service (CMEMS)"

        return pds

    def _create_bgc_pydap_ds(self, name: str, xds: xr.Dataset) -> pm.DatasetType:
        """Create DAP2 DatasetType for biogeochemical ocean variables (chl)."""
        pds = pm.DatasetType(name)

        for coord_name in ["time", "depth", "latitude", "longitude"]:
            if coord_name in xds.coords:
                coord_val = np.asarray(xds[coord_name].values)
                c_var = pm.BaseType(coord_name, coord_val, dims=(coord_name,))
                for k, v in xds[coord_name].attrs.items():
                    c_var.attributes[k] = str(v)
                pds[coord_name] = c_var

        if "chl" in xds.data_vars:
            var_data = xds["chl"].data
            b_var = pm.BaseType("chl", var_data, dims=("time", "depth", "latitude", "longitude"))
            for k, v in xds["chl"].attrs.items():
                if k not in ("scale_factor", "add_offset", "valid_min", "valid_max"):
                    b_var.attributes[k] = str(v)
            b_var.attributes["_FillValue"] = -9999.0
            pds["chl"] = b_var

        for k, v in xds.attrs.items():
            pds.attributes[k] = str(v)
        pds.attributes["institution"] = "INCOIS / SAGAR NETRA 3D Ocean Intelligence"
        pds.attributes["title"] = "CMEMS Biogeochemical Ocean Chlorophyll Analysis (DAP 2.0)"
        pds.attributes["Conventions"] = "CF-1.8"
        pds.attributes["source"] = "Copernicus Marine Environment Monitoring Service (CMEMS)"

        return pds

    def _build_constrained_dap_dataset(
        self, dataset_id: str, query_string: str
    ) -> Optional[pm.DatasetType]:
        """
        Build a lightweight, highly efficient DatasetType containing ONLY requested variables
        and sliced indices from the DAP2 constraint expression.
        """
        pair = self._get_xds_and_pds(dataset_id)
        if pair is None:
            return None
        xds, base_pds = pair

        ce_items = _parse_ce_parts(query_string)
        if not ce_items:
            return base_pds

        sub_pds = pm.DatasetType(base_pds.name)
        for k, v in base_pds.attributes.items():
            sub_pds.attributes[k] = v

        for var_name, slices in ce_items:
            # Handle coordinate variables
            if var_name in xds.coords:
                arr = np.asarray(xds[var_name].values)
                if slices:
                    arr = arr[slices]
                c_var = pm.BaseType(var_name, arr, dims=(var_name,))
                for k, v in xds[var_name].attrs.items():
                    c_var.attributes[k] = str(v)
                sub_pds[var_name] = c_var

            # Handle 4D data variables
            elif var_name in xds.data_vars:
                arr = xds[var_name].data
                if slices:
                    arr = arr[slices]
                else:
                    arr = arr[:]
                b_var = pm.BaseType(var_name, arr, dims=("time", "depth", "latitude", "longitude"))
                for k, v in xds[var_name].attrs.items():
                    if k not in ("scale_factor", "add_offset", "valid_min", "valid_max"):
                        b_var.attributes[k] = str(v)
                b_var.attributes["_FillValue"] = -9999.0
                sub_pds[var_name] = b_var

            # Handle derived currents magnitude: sqrt(uo^2 + vo^2)
            elif var_name == "currents" and "uo" in xds.data_vars and "vo" in xds.data_vars:
                uo_arr = xds["uo"].data
                vo_arr = xds["vo"].data
                if slices:
                    uo_arr = uo_arr[slices]
                    vo_arr = vo_arr[slices]
                else:
                    uo_arr = uo_arr[:]
                    vo_arr = vo_arr[:]
                speed_arr = np.sqrt(np.square(uo_arr) + np.square(vo_arr))
                b_var = pm.BaseType("currents", speed_arr, dims=("time", "depth", "latitude", "longitude"))
                b_var.attributes["long_name"] = "Hydrodynamic Ocean Current Speed"
                b_var.attributes["units"] = "m/s"
                b_var.attributes["_FillValue"] = -9999.0
                sub_pds["currents"] = b_var

        return sub_pds

    def handle_dap_request(
        self,
        dataset_id: str,
        extension: str,
        query_string: str = "",
        base_url: str = "/api/v1/opendap",
    ) -> Tuple[bytes, int, Dict[str, str]]:
        """
        Process incoming OPeNDAP DAP2 request (.dds, .das, .dods, .html, .info, .ver).
        Returns (content_bytes, status_code, headers_dict).
        """
        clean_id = dataset_id.strip("/").replace(".nc", "")
        if clean_id.endswith((".dds", ".das", ".dods", ".html", ".info", ".ver", ".asc", ".ascii")):
            for suf in [".dds", ".das", ".dods", ".html", ".info", ".ver", ".asc", ".ascii"]:
                if clean_id.endswith(suf):
                    extension = suf
                    clean_id = clean_id[:-len(suf)]
                    break

        pair = self._get_xds_and_pds(clean_id)
        if pair is None:
            err_msg = f"Dataset '{clean_id}' not found or not configured in SAGAR NETRA 3D OPeNDAP server."
            return (
                f"Error {{\n    code = 404;\n    message = \"{err_msg}\";\n}};\n".encode("utf-8"),
                404,
                {"Content-Type": "text/plain; charset=utf-8", "XDODS-Server": "pydap/3.5.9"},
            )

        # For DODS and constrained DDS, use fast slice-evaluated dataset
        if extension == ".dods" and query_string:
            target_ds = self._build_constrained_dap_dataset(clean_id, query_string)
        else:
            target_ds = pair[1]

        url_path = f"{base_url}/{clean_id}{extension}"
        if query_string:
            url_path += f"?{query_string}"

        wreq = WebobRequest.blank(url_path)

        try:
            if extension in (".dds",):
                resp = wreq.get_response(DDSResponse(target_ds))
            elif extension in (".das",):
                resp = wreq.get_response(DASResponse(target_ds))
            elif extension in (".dods",):
                resp = wreq.get_response(DODSResponse(target_ds))
            elif extension in (".html", ".info", ""):
                resp = wreq.get_response(HTMLResponse(target_ds))
            else:
                resp = wreq.get_response(HTMLResponse(target_ds))

            headers = dict(resp.headers)
            headers["XDODS-Server"] = "pydap/3.5.9"
            headers["Access-Control-Allow-Origin"] = "*"
            return resp.body, resp.status_code, headers

        except Exception as err:
            log.exception("Error processing OPeNDAP request for %s%s: %s", clean_id, extension, err)
            err_text = f"Error {{\n    code = 500;\n    message = \"Internal OPeNDAP Error: {str(err)}\";\n}};\n"
            return (
                err_text.encode("utf-8"),
                500,
                {"Content-Type": "text/plain; charset=utf-8", "XDODS-Server": "pydap/3.5.9"},
            )

    def generate_thredds_catalog_xml(self, service_base_url: str = "/api/v1/opendap") -> str:
        """
        Generate a valid, standard THREDDS Catalog XML (v1.0.2 / 1.2)
        indexing all available ocean model datasets with standard OpenDAP serviceType.
        """
        catalog = f"""<?xml version="1.0" encoding="UTF-8"?>
<catalog name="SAGAR NETRA 3D THREDDS / OPeNDAP Data Catalog"
        xmlns="http://www.unidata.ucar.edu/namespaces/thredds/InvCatalog/v1.0"
        xmlns:xlink="http://www.w3.org/1999/xlink">

    <service name="all" serviceType="Compound" base="">
        <service name="dap" serviceType="OpenDAP" base="{service_base_url}/" />
    </service>

    <dataset name="SAGAR NETRA 3D Ocean Model Collections" ID="sagarnetra-models">
        
        <dataset name="CMEMS Global Ocean Physics Daily Analysis" ID="cmems_physical" urlPath="cmems_physical">
            <serviceName>dap</serviceName>
            <dataType>Grid</dataType>
            <dataFormat>NetCDF</dataFormat>
            <documentation type="summary">
                Global ocean physical fields: Potential Temperature (thetao), Practical Salinity (so),
                Eastward Velocity (uo), Northward Velocity (vo), and Hydrodynamic Currents.
            </documentation>
            <documentation type="rights">Ministry of Earth Sciences (MoES) / INCOIS Open Scientific Data Policy</documentation>
            <property name="variables" value="thetao, so, uo, vo, currents" />
            <property name="spatial_domain" value="40E to 100E, 35S to 30N" />
            <property name="depth_levels" value="17 standard depths (0 to 2000m)" />
        </dataset>

        <dataset name="CMEMS Global Ocean Biogeochemistry Daily Chlorophyll" ID="cmems_bgc" urlPath="cmems_bgc">
            <serviceName>dap</serviceName>
            <dataType>Grid</dataType>
            <dataFormat>NetCDF</dataFormat>
            <documentation type="summary">
                Global ocean biogeochemical chlorophyll-a concentration fields (chl).
            </documentation>
            <documentation type="rights">Ministry of Earth Sciences (MoES) / INCOIS Open Scientific Data Policy</documentation>
            <property name="variables" value="chl" />
            <property name="spatial_domain" value="40E to 100E, 35S to 30N" />
            <property name="depth_levels" value="17 standard depths (0 to 2000m)" />
        </dataset>

    </dataset>
</catalog>
"""
        return catalog

    def generate_thredds_catalog_html(self, service_base_url: str = "/api/v1/opendap") -> str:
        """Generate human-readable THREDDS Catalog HTML."""
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SAGAR NETRA 3D THREDDS &amp; OPeNDAP Data Catalog</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f8fafc; color: #1e293b; }}
        .container {{ max-width: 900px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
        h1 {{ color: #0f172a; font-size: 24px; margin-bottom: 8px; }}
        p.sub {{ color: #64748b; font-size: 14px; margin-top: 0; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }}
        th, td {{ padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }}
        th {{ background: #f8fafc; font-weight: 600; color: #475569; }}
        a {{ color: #0284c7; text-decoration: none; font-weight: 500; }}
        a:hover {{ text-decoration: underline; }}
        .badge {{ background: #ecfdf5; color: #047857; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }}
        .code {{ font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🌊 SAGAR NETRA 3D THREDDS / OPeNDAP Server</h1>
        <p class="sub">National Ocean Information Processing Center · Ministry of Earth Sciences (MoES) / INCOIS</p>
        
        <h2>Available Ocean Model Datasets</h2>
        <table>
            <thead>
                <tr>
                    <th>Dataset Name</th>
                    <th>ID</th>
                    <th>Variables</th>
                    <th>OPeNDAP Access</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>CMEMS Global Ocean Physics (Daily)</strong></td>
                    <td><span class="code">cmems_physical</span></td>
                    <td>thetao, so, uo, vo, currents</td>
                    <td>
                        <a href="{service_base_url}/cmems_physical.html">HTML Info</a> · 
                        <a href="{service_base_url}/cmems_physical.dds">DDS</a> · 
                        <a href="{service_base_url}/cmems_physical.das">DAS</a>
                    </td>
                </tr>
                <tr>
                    <td><strong>CMEMS Global Ocean Biogeochemistry (Daily)</strong></td>
                    <td><span class="code">cmems_bgc</span></td>
                    <td>chl</td>
                    <td>
                        <a href="{service_base_url}/cmems_bgc.html">HTML Info</a> · 
                        <a href="{service_base_url}/cmems_bgc.dds">DDS</a> · 
                        <a href="{service_base_url}/cmems_bgc.das">DAS</a>
                    </td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top: 32px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; font-size: 13px;">
            <p style="margin: 0; font-weight: 600; color: #166534;">Python xarray Quick Access Example:</p>
            <pre style="margin-top: 8px; margin-bottom: 0; font-family: monospace; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">import xarray as xr
ds = xr.open_dataset("http://127.0.0.1:8000{service_base_url}/cmems_physical")
print(ds)</pre>
        </div>
    </div>
</body>
</html>
"""
        return html
