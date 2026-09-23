"""
backend/scripts/fetch_marine_regions_eez.py
-------------------------------------------
Downloads authoritative Indian Exclusive Economic Zone (EEZ) boundaries directly from
Marine Regions (Flanders Marine Institute - VLIZ) WFS service:
  - MRGID 8480: Indian Exclusive Economic Zone (Mainland + Lakshadweep)
  - MRGID 8333: Indian Exclusive Economic Zone (Andaman and Nicobar Islands)

Processes and saves authentic GeoJSON with Polygon / MultiPolygon support.
"""
import json
import urllib.request
from pathlib import Path
from shapely.geometry import shape, mapping

def fetch_and_save_eez():
    url = (
        "https://geo.vliz.be/geoserver/wfs"
        "?request=getfeature&service=wfs&version=1.1.0"
        "&typename=MarineRegions:eez&outputformat=json"
        "&filter=%3CPropertyIsEqualTo%3E%3CPropertyName%3Eiso_sov1%3C/PropertyName%3E%3CLiteral%3EIND%3C/Literal%3E%3C/PropertyIsEqualTo%3E"
    )

    print("Fetching authentic EEZ data from Marine Regions WFS...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw_data = json.loads(resp.read().decode("utf-8"))

    out_features = []
    
    for feat in raw_data.get("features", []):
        props = feat.get("properties", {})
        geom = shape(feat["geometry"])
        
        # High fidelity Douglas-Peucker simplification (0.015 deg ~ 1.6 km tolerance)
        # Keeps true coastal curves, bilateral lines, and natural maritime geometry intact
        simplified_geom = geom.simplify(0.015, preserve_topology=True)
        mapping_geom = mapping(simplified_geom)
        
        feature_dict = {
            "type": "Feature",
            "id": f"MRGID-{props.get('mrgid')}",
            "properties": {
                "mrgid": props.get("mrgid"),
                "geoname": props.get("geoname"),
                "territory": props.get("territory1"),
                "sovereign": props.get("sovereign1"),
                "iso_sov": props.get("iso_sov1"),
                "area_km2": props.get("area_km2"),
                "pol_type": props.get("pol_type"),
                "source": "Marine Regions Maritime Boundaries (Flanders Marine Institute - VLIZ)",
                "mrgid_url": f"https://www.marineregions.org/gazetteer.php?id={props.get('mrgid')}",
                "color": "#0284c7"
            },
            "geometry": mapping_geom
        }
        out_features.append(feature_dict)

    total_area = sum(f["properties"]["area_km2"] for f in out_features if f["properties"].get("area_km2"))

    final_geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Indian Exclusive Economic Zone (EEZ) Boundary",
            "source": "Marine Regions (VLIZ) World EEZ Dataset v12 (MRGID 8480, 8333)",
            "gazetteer_reference": "https://www.marineregions.org/gazetteer.php?id=8480",
            "crs": "EPSG:4326",
            "total_area_sq_km": total_area,
            "features_count": len(out_features)
        },
        "features": out_features
    }

    base_dir = Path(__file__).resolve().parent.parent.parent
    data_path = base_dir / "data" / "geospatial" / "india_eez.geojson"
    public_path = base_dir / "public" / "data" / "india_eez.geojson"

    data_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(final_geojson, f, indent=2)

    with open(public_path, "w", encoding="utf-8") as f:
        json.dump(final_geojson, f, indent=2)

    print(f"Successfully saved authentic GeoJSON to {data_path} and {public_path}")
    print(f"Features: {len(out_features)}, Total Area: {total_area:,.0f} km²")
    for feat in out_features:
        p = feat["properties"]
        g = feat["geometry"]
        print(f" - {p['geoname']} (MRGID {p['mrgid']}): {p['area_km2']:,} km², type={g['type']}")

if __name__ == "__main__":
    fetch_and_save_eez()
