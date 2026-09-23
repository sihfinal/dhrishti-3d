"use client"

import React, { useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { useTexture } from "@react-three/drei"
import { ThreeEvent } from "@react-three/fiber"
import AtmosphereGlow from "./AtmosphereGlow"
import CountryBoundaries from "./CountryBoundaries"
import IndianEEZLayer from "./IndianEEZLayer"
import RegionSelectionBox, { GeographicBounds } from "./RegionSelectionBox"
import ObservationLayers from "./ObservationLayers"
import ModelLayerManager from "./ModelLayerManager"
import { ObservationItem } from "@/lib/observationsApi"
import { ModelFieldResponse } from "@/lib/modelApi"

const EARTH_TEXTURE = "/textures/earth_4k_v3.jpg"
const INITIAL_ROTATION_Y = -Math.PI / 2

interface EarthSphereProps {
  onHoverCoordinates?: (coords: { lat: number; lon: number } | null) => void
  selectionMode?: boolean
  selectedRegion?: GeographicBounds | null
  onRegionSelect?: (bounds: GeographicBounds | null) => void
  radius?: number
  observations?: ObservationItem[]
  visibleTypes?: Record<string, boolean>
  selectedObservationId?: string | null
  onSelectObservation?: (obs: ObservationItem | null) => void
  // Model Data Layers
  activeLayerId?: string
  layerVisibility?: Record<string, boolean>
  scalarFieldData?: ModelFieldResponse | null
  uFieldData?: ModelFieldResponse | null
  vFieldData?: ModelFieldResponse | null
  vectorDensity?: "low" | "medium" | "high"
  showEEZ?: boolean
}

export default function EarthSphere({
  onHoverCoordinates,
  selectionMode = false,
  selectedRegion = null,
  onRegionSelect,
  radius = 2,
  observations = [],
  visibleTypes = { argo: true, glider: true, ctd: true, bgc: true },
  selectedObservationId = null,
  onSelectObservation,
  activeLayerId = "temperature",
  layerVisibility = { temperature: true, salinity: true, currents: true, chlorophyll: true, sla: false },
  scalarFieldData = null,
  uFieldData = null,
  vFieldData = null,
  vectorDensity = "medium",
  showEEZ = true,
}: EarthSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const isDraggingRef = useRef(false)
  const dragStartCoordsRef = useRef<{ lat: number; lon: number } | null>(null)
  const [activeDragBounds, setActiveDragBounds] = useState<GeographicBounds | null>(null)

  const texture = useTexture(EARTH_TEXTURE, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.anisotropy = 16
    t.needsUpdate = true
  })

  // Convert raycast 3D intersection to exact geographic coordinates (lat, lon)
  const getGeoCoordsFromEvent = useCallback((e: ThreeEvent<PointerEvent>): { lat: number; lon: number } | null => {
    if (!e.point || !meshRef.current) return null
    const localPoint = meshRef.current.worldToLocal(e.point.clone())
    const r = localPoint.length()
    if (r === 0) return null

    const lat = Math.asin(Math.max(-1, Math.min(1, localPoint.y / r))) * (180 / Math.PI)
    let lon = Math.atan2(localPoint.z, -localPoint.x) * (180 / Math.PI) - 180
    while (lon < -180) lon += 360
    while (lon > 180) lon -= 360

    return { lat, lon }
  }, [])

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!selectionMode) return
    e.stopPropagation()
    const coords = getGeoCoordsFromEvent(e)
    if (!coords) return

    isDraggingRef.current = true
    dragStartCoordsRef.current = coords
    setActiveDragBounds({
      latMin: coords.lat,
      latMax: coords.lat,
      lonMin: coords.lon,
      lonMax: coords.lon,
    })
  }

  const lastHoverTimeRef = useRef(0)

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const now = performance.now()
    if (now - lastHoverTimeRef.current > 60) {
      lastHoverTimeRef.current = now
      const coords = getGeoCoordsFromEvent(e)
      if (coords) onHoverCoordinates?.(coords)
    }

    if (!selectionMode || !isDraggingRef.current || !dragStartCoordsRef.current) return
    const coords = getGeoCoordsFromEvent(e)
    if (!coords) return
    e.stopPropagation()

    const start = dragStartCoordsRef.current
    const current = coords

    setActiveDragBounds({
      latMin: Math.min(start.lat, current.lat),
      latMax: Math.max(start.lat, current.lat),
      lonMin: Math.min(start.lon, current.lon),
      lonMax: Math.max(start.lon, current.lon),
    })
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!selectionMode || !isDraggingRef.current) return
    e.stopPropagation()
    isDraggingRef.current = false

    if (activeDragBounds) {
      const latDiff = Math.abs(activeDragBounds.latMax - activeDragBounds.latMin)
      const lonDiff = Math.abs(activeDragBounds.lonMax - activeDragBounds.lonMin)

      if (latDiff > 0.5 && lonDiff > 0.5) {
        onRegionSelect?.(activeDragBounds)
      } else {
        setActiveDragBounds(null)
      }
    }
  }

  const handlePointerOut = () => {
    onHoverCoordinates?.(null)
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      if (activeDragBounds) {
        onRegionSelect?.(activeDragBounds)
      }
    }
  }

  return (
    <group rotation={[0, INITIAL_ROTATION_Y, 0]}>
      {/* ─── 1. Core Realistic Earth Sphere (R = 2.000) ─── */}
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[radius, 128, 128]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.65}
          metalness={0.08}
          toneMapped={false}
        />
      </mesh>

      {/* ─── 2. Real Scientific Model Layer Overlay (R = 2.004) ─── */}
      <ModelLayerManager
        activeLayerId={activeLayerId}
        isVisible={layerVisibility[activeLayerId] ?? true}
        scalarFieldData={scalarFieldData}
        uFieldData={uFieldData}
        vFieldData={vFieldData}
        vectorDensity={vectorDensity}
      />

      {/* ─── 3. Natural Earth Country Boundary Outlines (R = 2.008) ─── */}
      <CountryBoundaries radius={radius + 0.008} />

      {/* ─── 3b. Indian Exclusive Economic Zone (EEZ) Boundary (R = 2.010) ─── */}
      <IndianEEZLayer radius={radius + 0.010} visible={showEEZ} />

      {/* ─── 4. Real In-Situ Observation Markers (R = 2.014) ─── */}
      <ObservationLayers
        observations={observations}
        visibleTypes={visibleTypes}
        selectedObservationId={selectedObservationId}
        onSelectObservation={onSelectObservation}
        selectionMode={selectionMode}
        radius={radius + 0.014}
      />

      {/* ─── 5. Selected Region Box (R = 2.018) ─── */}
      <RegionSelectionBox
        bounds={activeDragBounds || selectedRegion}
        radius={radius + 0.018}
      />

      {/* ─── 6. Atmospheric Scattering Glow ─── */}
      <AtmosphereGlow radius={radius} />
    </group>
  )
}
