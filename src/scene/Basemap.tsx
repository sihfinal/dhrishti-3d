"use client"

/**
 * Sea surface: flat earth-texture plane UV-windowed to the ROI, plus
 * coastline vectors. No waves — clean, reliable.
 */
import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { useTexture, Line } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import type { Roi } from "@/types"
import { makeMapping, SPHERE_RADIUS, geoToSphere, sphereToGeo, sampleField } from "./mapping"
import { getFieldData } from "@/lib/fieldCache"
import { useOcean } from "@/lib/store"

const EARTH_TEXTURE = "/textures/earth_4k_v3.jpg"

export default function Basemap({ roi }: { roi: Roi }) {
  const theme = useOcean((s) => s.theme)
  const map = useMemo(() => makeMapping(roi), [roi])
  const texture = useTexture(EARTH_TEXTURE)
  const setProbe = useOcean((s) => s.setProbe)
  const manifest = useOcean((s) => s.manifest)
  const variableId = useOcean((s) => s.variableId)
  const depthIdx = useOcean((s) => s.depthIdx)

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  async function handleMeshClick(e: ThreeEvent<MouseEvent>) {
    if (e.point) {
      const geo = sphereToGeo(e.point)
      const meta = manifest?.variables.find((v) => v.id === variableId)
      let val: number | null = null
      if (meta && manifest) {
        try {
          const data = await getFieldData(meta)
          const depthM = meta.depthsM[depthIdx] ?? 0
          const q = sampleField(data, manifest.grid, meta.depthsM, geo.lon, geo.lat, depthM)
          if (q !== null && q < 255) {
            val = meta.encoding.offset + (q / 254) * (meta.globalMax - meta.globalMin)
          }
        } catch {
          val = null
        }
      }
      setProbe({
        lat: geo.lat,
        lon: geo.lon,
        depthM: meta?.depthsM[depthIdx] ?? 0,
        value: val,
        variableName: meta?.name,
        unit: meta?.unit,
      })
    }
  }

  return (
    <group>
      <mesh onClick={handleMeshClick}>
        <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={theme === "dark" ? 0.75 : 0.55}
          metalness={theme === "dark" ? 0.08 : 0.15}
          emissive={theme === "dark" ? "#000000" : "#0f2b4c"}
        />
      </mesh>
      <Coastlines roi={roi} map={map} />
    </group>
  )
}

function Coastlines({
  roi,
  map,
}: {
  roi: Roi
  map: ReturnType<typeof makeMapping>
}) {
  const [rings, setRings] = useState<[number, number, number][][]>([])
  useEffect(() => {
    let cancelled = false
    fetch("/data/coastlines.json")
      .then((r) => r.json())
      .then((gj) => {
        if (cancelled) return
        const out: [number, number, number][][] = []
        for (const f of gj.features) {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates]
              : f.geometry.coordinates
          for (const poly of polys) {
            for (const ring of poly) {
              const pts: [number, number, number][] = []
              let prev: [number, number, number] | null = null
              for (const pt of ring as [number, number][]) {
                const [lon, lat] = pt
                if (lon < roi.lonMin - 2 || lon > roi.lonMax + 2) continue
                if (lat < roi.latMin - 2 || lat > roi.latMax + 2) continue
                const pVec = geoToSphere(lon, lat, 0, 0).multiplyScalar(1.001)
                const p: [number, number, number] = [pVec.x, pVec.y, pVec.z]
                if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) > 4.0) {
                  if (pts.length > 1) out.push(pts)
                  pts.length = 0
                }
                pts.push(p)
                prev = p
              }
              if (pts.length > 1) out.push(pts)
            }
          }
        }
        setRings(out)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [roi, map])

  return (
    <group>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color="#f1f5f9" lineWidth={1} />
      ))}
    </group>
  )
}
