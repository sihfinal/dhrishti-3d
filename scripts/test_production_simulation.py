#!/usr/bin/env python3
"""
scripts/test_production_simulation.py
=====================================
Simulates the Render production environment locally.
Tests all endpoints against the deployment dataset and measures memory usage.
"""

from __future__ import annotations

import gc
import os
import sys
import time
import tracemalloc
from pathlib import Path
from typing import Any, Dict

from starlette.testclient import TestClient

# Ensure environment matches Render production configuration
os.environ["DATA_DIR"] = "sagar-netra-deployment-data"
os.environ["PORT"] = "8000"
os.environ["HOST"] = "0.0.0.0"

from backend.main import app


def get_rss_mb() -> float:
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return float(line.split()[1]) / 1024.0
    except Exception:
        pass
    try:
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0
    except Exception:
        return 0.0

def get_peak_rss_mb() -> float:
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmHWM:"):
                    return float(line.split()[1]) / 1024.0
    except Exception:
        pass
    return get_rss_mb()


def run_simulation() -> int:
    print("=" * 72)
    print("  Sagar Netra 3D — Production Endpoint & Resource Simulation")
    print("=" * 72)

    tracemalloc.start()
    gc.collect()
    start_rss = get_rss_mb()
    print(f"Initial Process RSS: {start_rss:.1f} MB")

    failures = []
    successes = []

    with TestClient(app) as client:
        tests = [
            ("Health Check", "GET", "/api/v1/health", {}, 200, lambda r: r.json().get("status") == "healthy"),
            ("Model Metadata", "GET", "/api/v1/model/metadata", {}, 200, lambda r: "grid" in r.json() or "latitude_range" in r.json()),
            ("Model Times", "GET", "/api/v1/model/times", {}, 200, lambda r: r.json().get("count") >= 6),
            ("Model Depths", "GET", "/api/v1/model/depths?variable=temperature", {}, 200, lambda r: len(r.json().get("depths", [])) >= 30),
            ("Model Field Slice (JSON)", "GET", "/api/v1/model/field?variable=temperature&depth=0.5&time=2026-02-15", {}, 200, lambda r: b"values" in r.content),
            ("Model Field Stack (Currents)", "GET", "/api/v1/model/field-stack?variable=currents&time=2026-02-15&depths=0.5,10", {}, 200, lambda r: b"u_slices" in r.content and b"v_slices" in r.content),
            ("Model Field Binary", "GET", "/api/v1/model/field-binary?variable=temperature&depth=0.5&time=2026-02-15", {}, 200, lambda r: len(r.content) > 1000),
            ("Model Field Binary (Accept Header)", "GET", "/api/v1/model/field?variable=temperature&depth=0.5&time=2026-02-15", {"Accept": "application/octet-stream"}, 200, lambda r: len(r.content) > 1000),
            ("Observations List", "GET", "/api/v1/observations?type=argo&limit=10", {}, 200, lambda r: r.json().get("count", 0) > 0),
            ("Observation Profile", "GET", "/api/v1/observations/argo_19770705", {}, 200, lambda r: "profiles" in r.json() or "id" in r.json()),
            ("Model-Obs Comparison", "GET", "/api/v1/compare/model-observation?obs_id=argo_19770705&variable=temperature", {}, 200, lambda r: "metrics" in r.json()),
            ("Geospatial India EEZ", "GET", "/api/v1/geospatial/india-eez", {}, 200, lambda r: r.json().get("type") == "FeatureCollection"),
            ("Geospatial Boundary Info", "GET", "/api/v1/geospatial/info", {}, 200, lambda r: "title" in r.json() or "description" in r.json()),
            ("WMS GetCapabilities", "GET", "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities", {}, 200, lambda r: "WMS_Capabilities" in r.text or "WMT_MS_Capabilities" in r.text),
            ("WMS GetMap PNG", "GET", "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=temperature&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=400&HEIGHT=250", {}, 200, lambda r: r.content.startswith(b"\x89PNG")),
            ("WCS GetCapabilities", "GET", "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities", {}, 200, lambda r: "Capabilities" in r.text),
            ("WCS GetCoverage NetCDF", "GET", "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=temperature&SUBSET=lat(-10,10)&SUBSET=long(60,80)&FORMAT=application/x-netcdf4", {}, 200, lambda r: len(r.content) > 1000),
            ("OPeNDAP Datasets", "GET", "/api/v1/opendap/datasets", {}, 200, lambda r: len(r.json().get("datasets", [])) >= 2),
            ("OPeNDAP THREDDS Catalog", "GET", "/api/v1/opendap/catalog.xml", {}, 200, lambda r: "<catalog" in r.text),
            ("OPeNDAP DDS Physical", "GET", "/api/v1/opendap/cmems_physical.dds", {}, 200, lambda r: "Dataset {" in r.text and "thetao" in r.text),
            ("OPeNDAP DAS Physical", "GET", "/api/v1/opendap/cmems_physical.das", {}, 200, lambda r: "Attributes {" in r.text),
            ("OPeNDAP DODS Physical", "GET", "/api/v1/opendap/cmems_physical.dods?latitude", {}, 200, lambda r: b"Dataset {" in r.content),
        ]

        for item in tests:
            name, method, path, headers, expected_status, validator = item

            t0 = time.time()
            if method == "GET":
                resp = client.get(path, headers=headers)
            else:
                resp = client.post(path, headers=headers)
            lat_ms = (time.time() - t0) * 1000

            valid = resp.status_code == expected_status
            if valid and validator:
                try:
                    valid = bool(validator(resp))
                except Exception as e:
                    valid = False

            if valid:
                print(f"  ✅  {name:<36} {lat_ms:6.1f} ms  (HTTP {resp.status_code})")
                successes.append(name)
            else:
                print(f"  ❌  {name:<36} {lat_ms:6.1f} ms  (HTTP {resp.status_code}) -> Error: {resp.text[:120]}")
                failures.append((name, resp.status_code, resp.text[:120]))

    current_heap, peak_heap = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    gc.collect()
    end_rss = get_rss_mb()

    peak_hwm = get_peak_rss_mb()
    print("─" * 72)
    print("Simulation Results:")
    print(f"  Passed: {len(successes)}/{len(tests)}")
    print(f"  Failed: {len(failures)}/{len(tests)}")
    print("Resource Profile (Render Free limit: 512 MB):")
    print(f"  Initial RSS:   {start_rss:.1f} MB")
    print(f"  End RSS:       {end_rss:.1f} MB")
    print(f"  Peak RSS:      {peak_hwm:.1f} MB")
    print(f"  Peak Heap:     {peak_heap / (1024 * 1024):.1f} MB")
    print("=" * 72)

    return 0 if len(failures) == 0 else 1


if __name__ == "__main__":
    sys.exit(run_simulation())
