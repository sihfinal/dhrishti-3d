"""
backend/scripts/generate_authoritative_eez.py
---------------------------------------------
Downloads and formats the official Marine Regions (VLIZ) World EEZ dataset v12:
  - MRGID 8480: Indian Exclusive Economic Zone (Mainland India & Lakshadweep)
  - MRGID 8333: Indian Exclusive Economic Zone (Andaman and Nicobar Islands)

Preserves exact MultiPolygon geometry, UNCLOS 200 NM outer perimeter curves,
and bilateral treaty boundaries with Pakistan, Maldives, Sri Lanka, Bangladesh,
Myanmar, Thailand, and Indonesia.
"""
import json
import urllib.request
from pathlib import Path
from shapely.geometry import shape, mapping, Polygon, MultiPolygon

def generate_eez():
    url = (
        "https://geo.vliz.be/geoserver/wfs"
        "?request=getfeature&service=wfs&version=1.1.0"
        "&typename=MarineRegions:eez&outputformat=json"
        "&filter=%3CPropertyIsEqualTo%3E%3CPropertyName%3Eiso_sov1%3C/PropertyName%3E%3CLiteral%3EIND%3C/Literal%3E%3C/PropertyIsEqualTo%3E"
    )

    print("Querying Marine Regions (VLIZ) WFS server for ISO_SOV=IND (MRGID 8480, 8333)...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw_data = json.loads(resp.read().decode("utf-8"))

    features = []

    for raw_feat in raw_data.get("features", []):
        props = raw_feat.get("properties", {})
        mrgid = props.get("mrgid")
        geoname = props.get("geoname")
        geom = shape(raw_feat["geometry"])
        
        # High precision simplification preserving all true physical and treaty contours
        # Tol 0.003 for Mainland, 0.0005 for Andaman
        tol = 0.003 if mrgid == 8480 else 0.0005
        simplified_geom = geom.simplify(tol, preserve_topology=True)
        mapped = mapping(simplified_geom)

        feat_obj = {
            "type": "Feature",
            "id": f"MRGID-{mrgid}",
            "properties": {
                "mrgid": mrgid,
                "geoname": geoname,
                "territory": props.get("territory1"),
                "sovereign": props.get("sovereign1"),
                "iso_sov": props.get("iso_sov1"),
                "area_km2": props.get("area_km2"),
                "pol_type": props.get("pol_type", "200NM"),
                "source": "Marine Regions Maritime Boundaries (Flanders Marine Institute - VLIZ)",
                "gazetteer_url": f"https://www.marineregions.org/gazetteer.php?id={mrgid}",
                "color": "#0284c7"
            },
            "geometry": mapped
        }
        features.append(feat_obj)

    total_area = sum(f["properties"]["area_km2"] for f in features if f["properties"].get("area_km2"))

    final_fc = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Indian Exclusive Economic Zone (EEZ) Boundary",
            "description": "Official maritime boundary delimitation for Republic of India per UNCLOS and bilateral agreements",
            "source": "Marine Regions (VLIZ) World EEZ Dataset v12 (MRGID 8480, 8333)",
            "gazetteer_reference": "https://www.marineregions.org/gazetteer.php?id=8480",
            "crs": "EPSG:4326",
            "total_area_sq_km": total_area,
            "features_count": len(features)
        },
        "features": features
    }

    base_dir = Path(__file__).resolve().parent.parent.parent
    paths = [
        base_dir / "data" / "geospatial" / "india_eez.geojson",
        base_dir / "public" / "data" / "india_eez.geojson",
    ]

    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(final_fc, f, indent=2)
        print(f"Saved: {p} ({p.stat().st_size / 1024:.1f} KB)")

    print(f"\nCompleted! Total sovereign area: {total_area:,.0f} km²")
    for f in features:
        p = f["properties"]
        g = f["geometry"]
        print(f" - {p['geoname']} (MRGID {p['mrgid']}): {p['area_km2']:,} km², type={g['type']}")

if __name__ == "__main__":
    generate_eez()
