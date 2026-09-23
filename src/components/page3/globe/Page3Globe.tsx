"use client"

import React, { useRef, useEffect } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import EarthSphere from "./EarthSphere"
import { GeographicBounds } from "./RegionSelectionBox"
import { ObservationItem } from "@/lib/observationsApi"
import { ModelFieldResponse } from "@/lib/modelApi"

interface Page3GlobeProps {
  onHoverCoordinates?: (coords: { lat: number; lon: number } | null) => void
  zoomTrigger?: number
  resetTrigger?: number
  onOrientationChange?: (heading: number) => void
  selectionMode?: boolean
  selectedRegion?: GeographicBounds | null
  onRegionSelect?: (bounds: GeographicBounds | null) => void
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

const TARGET_CAM_POS = new THREE.Vector3(5.75, 0.38, 1.54)
const START_CAM_POS = new THREE.Vector3(65.0, 4.29, 17.41)

function ControlsHandler({
  zoomTrigger,
  resetTrigger,
  onOrientationChange,
  selectionMode,
}: {
  zoomTrigger?: number
  resetTrigger?: number
  onOrientationChange?: (heading: number) => void
  selectionMode?: boolean
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const prevZoomTrigger = useRef(zoomTrigger)
  const prevResetTrigger = useRef(resetTrigger)
  const isEnteringRef = useRef(true)
  const enterStartTimeRef = useRef(performance.now())

  useEffect(() => {
    if (zoomTrigger === undefined || zoomTrigger === prevZoomTrigger.current) return
    const direction = zoomTrigger > (prevZoomTrigger.current || 0) ? -0.4 : 0.4
    prevZoomTrigger.current = zoomTrigger

    const cam = camera as THREE.PerspectiveCamera
    const newPos = cam.position.clone().add(cam.position.clone().normalize().multiplyScalar(direction))
    if (newPos.length() >= 2.6 && newPos.length() <= 8.5) {
      cam.position.copy(newPos)
    }
  }, [zoomTrigger, camera])

  useEffect(() => {
    if (resetTrigger === undefined || resetTrigger === prevResetTrigger.current) return
    prevResetTrigger.current = resetTrigger

    const cam = camera as THREE.PerspectiveCamera
    cam.position.copy(TARGET_CAM_POS)
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [resetTrigger, camera])

  useFrame(() => {
    if (isEnteringRef.current) {
      const elapsed = (performance.now() - enterStartTimeRef.current) / 2400 // 2.4s smooth zoom-in
      if (elapsed >= 1) {
        camera.position.copy(TARGET_CAM_POS)
        isEnteringRef.current = false
      } else {
        // Smooth easeOutCubic: 1 - Math.pow(1 - t, 3)
        const t = 1 - Math.pow(1 - elapsed, 3)
        camera.position.lerpVectors(START_CAM_POS, TARGET_CAM_POS, t)
      }
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
      }
    }

    if (controlsRef.current) {
      controlsRef.current.update()
    }
    if (!onOrientationChange) return
    const camPos = camera.position
    const azimuth = Math.atan2(camPos.x, camPos.z) * (180 / Math.PI)
    let heading = (azimuth - 75) % 360
    if (heading < 0) heading += 360
    onOrientationChange(heading)
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={!selectionMode && !isEnteringRef.current}
      enableZoom={!selectionMode && !isEnteringRef.current}
      enablePan={false}
      minDistance={2.6}
      maxDistance={8.5}
      rotateSpeed={1.0}
      zoomSpeed={1.0}
      dampingFactor={0.14}
      enableDamping={true}
    />
  )
}

export default function Page3Globe({
  onHoverCoordinates,
  zoomTrigger,
  resetTrigger,
  onOrientationChange,
  selectionMode = false,
  selectedRegion = null,
  onRegionSelect,
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
}: Page3GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{
          fov: 38,
          near: 0.1,
          far: 1000,
          position: [START_CAM_POS.x, START_CAM_POS.y, START_CAM_POS.z],
        }}
        className="w-full h-full"
      >
        {/* ─── Satellite Lighting ─── */}
        <ambientLight intensity={0.95} />
        <directionalLight position={[6, 4, 5]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-5, -2, -4]} intensity={1.1} color="#60a5fa" />
        <directionalLight position={[0, 6, -2]} intensity={0.8} color="#e0f2fe" />

        {/* ─── Earth with Country Boundaries, Real Observations, Model Layer & Selection ─── */}
        <React.Suspense fallback={null}>
          <EarthSphere
            onHoverCoordinates={onHoverCoordinates}
            selectionMode={selectionMode}
            selectedRegion={selectedRegion}
            onRegionSelect={onRegionSelect}
            radius={2}
            observations={observations}
            visibleTypes={visibleTypes}
            selectedObservationId={selectedObservationId}
            onSelectObservation={onSelectObservation}
            activeLayerId={activeLayerId}
            layerVisibility={layerVisibility}
            scalarFieldData={scalarFieldData}
            uFieldData={uFieldData}
            vFieldData={vFieldData}
            vectorDensity={vectorDensity}
            showEEZ={showEEZ}
          />
        </React.Suspense>

        {/* ─── Camera Controls & Zoom Handlers ─── */}
        <ControlsHandler
          zoomTrigger={zoomTrigger}
          resetTrigger={resetTrigger}
          onOrientationChange={onOrientationChange}
          selectionMode={selectionMode}
        />
      </Canvas>
    </div>
  )
}
