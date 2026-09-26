"use client"

import React, { useEffect, useState, useMemo } from "react"
import * as THREE from "three"
import { getApiBaseUrl } from "@/lib/apiBase"

interface IndianEEZLayerProps {
  radius?: number
  visible?: boolean
}

interface GeoJSONFeature {
  type: string
  id?: string
  properties?: {
    geoname?: string
    mrgid?: number
    territory?: string
    area_km2?: number
  }
  geometry: {
    type: "Polygon" | "MultiPolygon"
    coordinates: number[][][] | number[][][][]
  }
}

interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
}

// Exact geographic coordinates (lon, lat) to 3D Cartesian coordinates on sphere matching Earth texture orientation
function latLonToVec3(lon: number, lat: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

export default function IndianEEZLayer({
  radius = 2.009,
  visible = true,
}: IndianEEZLayerProps) {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null)

  useEffect(() => {
    let active = true
    fetch("/data/india_eez.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load /data/india_eez.geojson")
        return res.json()
      })
      .then((data: GeoJSONData) => {
        if (active) setGeoData(data)
      })
      .catch((err) => {
        console.warn("Fallback to FastAPI backend for EEZ layer:", err)
        fetch(`${getApiBaseUrl()}/geospatial/india-eez`)
          .then((res) => res.json())
          .then((data: GeoJSONData) => {
            if (active) setGeoData(data)
          })
          .catch((e) => console.warn("Failed to load Indian EEZ dataset:", e))
      })

    return () => {
      active = false
    }
  }, [])

  // Build Three.js BufferGeometry once from authoritative Marine Regions MultiPolygon data
  const geometry = useMemo(() => {
    if (!geoData || !geoData.features || geoData.features.length === 0) return null

    const positions: number[] = []

    for (const feature of geoData.features) {
      const geom = feature.geometry
      if (!geom || !geom.coordinates) continue

      const exteriorRings: number[][][] = []

      if (geom.type === "Polygon") {
        // First ring is the sovereign exterior boundary
        const coords = geom.coordinates as number[][][]
        if (coords.length > 0 && coords[0].length >= 2) {
          exteriorRings.push(coords[0])
        }
      } else if (geom.type === "MultiPolygon") {
        // For each polygon part, first ring is the exterior boundary
        const multiCoords = geom.coordinates as number[][][][]
        for (const poly of multiCoords) {
          if (poly.length > 0 && poly[0].length >= 2) {
            exteriorRings.push(poly[0])
          }
        }
      }

      for (const ring of exteriorRings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const [lon1, lat1] = ring[i]
          const [lon2, lat2] = ring[i + 1]

          // Suppress anti-meridian wraps
          if (Math.abs(lon1 - lon2) > 180) continue

          const [x1, y1, z1] = latLonToVec3(lon1, lat1, radius)
          const [x2, y2, z2] = latLonToVec3(lon2, lat2, radius)

          positions.push(x1, y1, z1, x2, y2, z2)
        }
      }
    }

    if (positions.length === 0) return null

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [geoData, radius])

  if (!visible || !geometry) return null

  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial
        color="#0284c7"
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </lineSegments>
  )
}
