#!/usr/bin/env python3
"""
scripts/profile_endpoints_memory.py
===================================
Profiles the memory impact (RSS and Heap) of every backend endpoint individually.
Runs in a fresh process to get accurate baseline and delta metrics.
"""

from __future__ import annotations

import gc
import os
import resource
import sys
import time
import tracemalloc

os.environ["DATA_DIR"] = "sagar-netra-deployment-data"
os.environ["PORT"] = "8000"
os.environ["HOST"] = "0.0.0.0"

def get_rss_mb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0

def main():
    print("=" * 80)
    print("  SAGAR NETRA 3D — INDIVIDUAL ENDPOINT MEMORY PROFILING")
    print("=" * 80)
    
    baseline_rss = get_rss_mb()
    print(f"Python minimal start RSS: {baseline_rss:.1f} MB")
    
    t0 = time.time()
    from backend.main import app
    from starlette.testclient import TestClient
    import_rss = get_rss_mb()
    print(f"After importing app & dependencies RSS: {import_rss:.1f} MB (Delta: +{import_rss - baseline_rss:.1f} MB)")
    
    endpoints = [
        ("Health Check", "GET", "/api/v1/health", {}),
        ("Model Metadata", "GET", "/api/v1/model/metadata", {}),
        ("Model Times", "GET", "/api/v1/model/times", {}),
        ("Model Depths", "GET", "/api/v1/model/depths?variable=temperature", {}),
        ("Model Field Slice (JSON)", "GET", "/api/v1/model/field?variable=temperature&depth=0.5&time=2026-02-15", {}),
        ("Model Field Stack (Currents)", "GET", "/api/v1/model/field-stack?variable=currents&time=2026-02-15&depths=0.5,10", {}),
        ("Model Field Binary", "GET", "/api/v1/model/field-binary?variable=temperature&depth=0.5&time=2026-02-15", {}),
        ("Model Field Binary (Accept Header)", "GET", "/api/v1/model/field?variable=temperature&depth=0.5&time=2026-02-15", {"Accept": "application/octet-stream"}),
        ("Observations List", "GET", "/api/v1/observations?type=argo&limit=10", {}),
        ("Observation Profile", "GET", "/api/v1/observations/argo_19770705", {}),
        ("Model-Obs Comparison", "GET", "/api/v1/compare/model-observation?obs_id=argo_19770705&variable=temperature", {}),
        ("Geospatial India EEZ", "GET", "/api/v1/geospatial/india-eez", {}),
        ("Geospatial Boundary Info", "GET", "/api/v1/geospatial/info", {}),
        ("WMS GetCapabilities", "GET", "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities", {}),
        ("WMS GetMap PNG", "GET", "/api/v1/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=temperature&CRS=CRS:84&BBOX=40,-35,100,30&FORMAT=image/png&WIDTH=400&HEIGHT=250", {}),
        ("WCS GetCapabilities", "GET", "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities", {}),
        ("WCS GetCoverage NetCDF", "GET", "/api/v1/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=temperature&SUBSET=lat(-10,10)&SUBSET=long(60,80)&FORMAT=application/x-netcdf4", {}),
        ("OPeNDAP Datasets", "GET", "/api/v1/opendap/datasets", {}),
        ("OPeNDAP THREDDS Catalog", "GET", "/api/v1/opendap/catalog.xml", {}),
        ("OPeNDAP DDS Physical", "GET", "/api/v1/opendap/cmems_physical.dds", {}),
        ("OPeNDAP DAS Physical", "GET", "/api/v1/opendap/cmems_physical.das", {}),
        ("OPeNDAP DODS Physical", "GET", "/api/v1/opendap/cmems_physical.dods?latitude", {}),
    ]

    print("-" * 80)
    print(f"{'Endpoint':<36} | {'Status':<6} | {'Latency':<8} | {'RSS Peak':<9} | {'Heap Peak':<9}")
    print("-" * 80)

    with TestClient(app) as client:
        for name, method, path, headers in endpoints:
            gc.collect()
            tracemalloc.start()
            rss_before = get_rss_mb()
            t0 = time.time()
            if method == "GET":
                resp = client.get(path, headers=headers)
            else:
                resp = client.post(path, headers=headers)
            lat_ms = (time.time() - t0) * 1000
            rss_after = get_rss_mb()
            cur_heap, peak_heap = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            gc.collect()
            
            status_str = f"HTTP {resp.status_code}"
            print(f"{name:<36} | {status_str:<6} | {lat_ms:6.1f}ms | {rss_after:6.1f} MB | {peak_heap / (1024*1024):6.2f} MB")
            if resp.status_code != 200:
                print(f"   -> Response Error: {resp.text[:100]}")

    print("=" * 80)

if __name__ == "__main__":
    main()
