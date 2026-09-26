"use client"

import React, { useMemo, useRef, useLayoutEffect } from "react"
import * as THREE from "three"
import { ModelFieldResponse } from "@/lib/modelApi"
import { buildLut } from "@/lib/colormaps"

interface CurrentsVectorLayerProps {
  uField: ModelFieldResponse
  vField: ModelFieldResponse
  vectorDensity?: "low" | "medium" | "high"
  radius?: number
  opacity?: number
}

// Convert geographic coordinates to 3D sphere position
function geoToSphere(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -r * Math.sin(phi) * Math.cos(theta)
  const y = r * Math.cos(phi)
  const z = r * Math.sin(phi) * Math.sin(theta)
  return new THREE.Vector3(x, y, z)
}

export default function CurrentsVectorLayer({
  uField,
  vField,
  vectorDensity = "medium",
  radius = 2.006,
  opacity = 1.0,
}: CurrentsVectorLayerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // Determine stride based on vectorDensity
  const step = useMemo(() => {
    if (vectorDensity === "low") return 6
    if (vectorDensity === "high") return 2
    return 4 // medium
  }, [vectorDensity])

  // Extract vector items (lat, lon, u, v, speed, heading)
  const vectors = useMemo(() => {
    if (!uField.values || !vField.values) return []

    const uVals = uField.values
    const vVals = vField.values
    const lats = uField.latitudes
    const lons = uField.longitudes
    const nRows = Math.min(uVals.length, vVals.length)

    const list: { pos: THREE.Vector3; dir: THREE.Vector3; speed: number }[] = []
    const lut = buildLut("turbo", 256)

    for (let r = 0; r < nRows; r += step) {
      const lat = lats[r]
      const uRow = uVals[r]
      const vRow = vVals[r]
      if (!uRow || !vRow) continue

      const nCols = Math.min(uRow.length, vRow.length)
      for (let c = 0; c < nCols; c += step) {
        const u = uRow[c]
        const v = vRow[c]
        if (u === null || v === null || isNaN(u) || isNaN(v)) continue

        const speed = Math.sqrt(u * u + v * v)
        if (speed < 0.02) continue // Filter dead water

        const lon = lons[c]
        const pos = geoToSphere(lat, lon, radius)

        // Compute local tangent directions on sphere
        const normal = pos.clone().normalize()
        const north = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize()
        const east = new THREE.Vector3().crossVectors(north, normal).normalize()

        // Velocity vector on sphere tangent plane
        const flowDir = east.clone().multiplyScalar(u).add(north.clone().multiplyScalar(v)).normalize()

        list.push({ pos, dir: flowDir, speed })
      }
    }

    return list
  }, [uField, vField, step, radius])

  // Sharp cone arrow glyph geometry
  const arrowGeo = useMemo(() => new THREE.ConeGeometry(0.012, 0.038, 5), [])

  useLayoutEffect(() => {
    if (!meshRef.current || vectors.length === 0) return

    const tempObj = new THREE.Object3D()
    const color = new THREE.Color()
    const lut = buildLut("turbo", 256)

    for (let i = 0; i < vectors.length; i++) {
      const { pos, dir, speed } = vectors[i]
      tempObj.position.copy(pos)

      // Align cone tip along flow direction
      tempObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      const scale = Math.min(1.8, Math.max(0.6, speed * 1.5))
      tempObj.scale.set(scale, scale * 1.2, scale)
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)

      // Color by speed magnitude [0, 1.2 m/s]
      const t = Math.min(1, Math.max(0, speed / 1.2))
      const lutIdx = Math.round(t * 255) * 3
      color.setRGB(lut[lutIdx] / 255, lut[lutIdx + 1] / 255, lut[lutIdx + 2] / 255)
      meshRef.current.setColorAt(i, color)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, [vectors])

  if (vectors.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[arrowGeo, undefined, vectors.length]}
      renderOrder={3} raycast={() => null}
    >
      <meshBasicMaterial
        toneMapped={false}
        transparent={opacity < 1.0}
        opacity={opacity}
      />
    </instancedMesh>
  )
}
