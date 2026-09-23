"use client"

import React, { useState, useRef, useEffect, useMemo, Suspense } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { ObservationItem } from "@/lib/observationsApi"
import EarthSphere from "../page3/globe/EarthSphere"

interface ObservationsMapViewerProps {
  observations: ObservationItem[]
  selectedObsId: string | null
  onSelectObservation: (obs: ObservationItem) => void
  onRegionChange?: (region: string) => void
}

const REGION_POSITIONS: Record<string, THREE.Vector3> = {
  indian_ocean: new THREE.Vector3(5.2, 0.4, 1.8),
  arabian_sea: new THREE.Vector3(3.2, 1.1, 1.4),
  bay_of_bengal: new THREE.Vector3(3.4, 0.9, 0.1),
  equatorial: new THREE.Vector3(3.7, 0.0, 1.0),
  global: new THREE.Vector3(6.8, 1.5, 2.4),
}

function GlobeCameraHandler({
  zoomTrigger,
  resetTrigger,
  targetRegion,
  controlsRef,
}: {
  zoomTrigger: number
  resetTrigger: number
  targetRegion: string
  controlsRef: React.RefObject<any>
}) {
  const { camera } = useThree()
  const targetPosRef = useRef<THREE.Vector3>(REGION_POSITIONS.indian_ocean.clone())
  const isAnimatingRef = useRef(false)
  const prevZoom = useRef(zoomTrigger)
  const prevReset = useRef(resetTrigger)
  const prevRegion = useRef(targetRegion)

  useEffect(() => {
    if (targetRegion !== prevRegion.current) {
      prevRegion.current = targetRegion
      const target = REGION_POSITIONS[targetRegion] || REGION_POSITIONS.indian_ocean
      targetPosRef.current = target.clone()
      isAnimatingRef.current = true
    }
  }, [targetRegion])

  useEffect(() => {
    if (zoomTrigger === prevZoom.current) return
    const delta = zoomTrigger > prevZoom.current ? -0.5 : 0.5
    prevZoom.current = zoomTrigger
    const cam = camera as THREE.PerspectiveCamera
    const newPos = cam.position.clone().add(cam.position.clone().normalize().multiplyScalar(delta))
    if (newPos.length() >= 2.6 && newPos.length() <= 8.5) {
      targetPosRef.current = newPos
      isAnimatingRef.current = true
    }
  }, [zoomTrigger, camera])

  useEffect(() => {
    if (resetTrigger === prevReset.current) return
    prevReset.current = resetTrigger
    targetPosRef.current = REGION_POSITIONS.indian_ocean.clone()
    isAnimatingRef.current = true
  }, [resetTrigger])

  useEffect(() => {
    let frameId: number
    const animate = () => {
      if (isAnimatingRef.current) {
        camera.position.lerp(targetPosRef.current, 0.09)
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0)
          controlsRef.current.update()
        }
        if (camera.position.distanceTo(targetPosRef.current) < 0.01) {
          camera.position.copy(targetPosRef.current)
          isAnimatingRef.current = false
        }
      }
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [camera, controlsRef])

  return null
}

export default function ObservationsMapViewer({
  observations,
  selectedObsId,
  onSelectObservation,
  onRegionChange,
}: ObservationsMapViewerProps) {
  const [regionSelect, setRegionSelect] = useState("indian_ocean")
  const [zoomTrigger, setZoomTrigger] = useState(0)
  const [resetTrigger, setResetTrigger] = useState(0)
  const controlsRef = useRef<any>(null)

  const handleZoomIn = () => setZoomTrigger((z) => z + 1)
  const handleZoomOut = () => setZoomTrigger((z) => z - 1)
  const handleResetView = () => {
    setRegionSelect("indian_ocean")
    setResetTrigger((r) => r + 1)
    onRegionChange?.("indian_ocean")
  }

  const handleRegionDropdownChange = (val: string) => {
    setRegionSelect(val)
    onRegionChange?.(val)
  }

  return (
    <div className="w-full h-full bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between overflow-hidden select-none">
      
      {/* ─── GLOBE HEADER CONTROLS ─── */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1.5">
          <span>OBSERVATION LOCATIONS</span>
          <span className="text-[9.5px] font-semibold text-[#0284c7] bg-sky-50 border border-sky-200/80 px-1.5 py-0.5 rounded-md font-sans">
            3D Globe
          </span>
        </h2>

        <div className="flex items-center gap-2">
          {/* Region Quick Select */}
          <select
            value={regionSelect}
            onChange={(e) => handleRegionDropdownChange(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-md px-2 py-0.5 text-[11px] text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
          >
            <option value="indian_ocean">Indian Ocean ▾</option>
            <option value="arabian_sea">Arabian Sea</option>
            <option value="bay_of_bengal">Bay of Bengal</option>
            <option value="equatorial">Equatorial Indian Ocean</option>
            <option value="global">Global Oceans</option>
          </select>
        </div>
      </div>

      {/* ─── 3D INTERACTIVE THREE.JS GLOBE VIEWPORT ─── */}
      <div
        className="relative flex-1 w-full my-1.5 rounded-xl overflow-hidden border border-slate-200 shadow-inner select-none cursor-grab active:cursor-grabbing min-h-[290px] bg-cover bg-center bg-no-repeat transition-all"
        style={{
          backgroundColor: "#00172e",
          backgroundImage: `url('/textures/globe-sky-background.jpg')`,
        }}
      >
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [5.2, 0.4, 1.8], fov: 42 }}
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.15,
            }}
          >
            {/* Satellite Lighting */}
            <ambientLight intensity={1.0} />
            <directionalLight position={[6, 4, 5]} intensity={2.2} color="#ffffff" />
            <directionalLight position={[-5, -2, -4]} intensity={1.1} color="#60a5fa" />
            <directionalLight position={[0, 6, -2]} intensity={0.8} color="#e0f2fe" />

            {/* Core Earth with rotated Country Boundaries and Observation Layers */}
            <Suspense fallback={null}>
              <EarthSphere
                radius={2.0}
                observations={observations}
                visibleTypes={{ argo: true, glider: true, ctd: true, bgc: true }}
                selectedObservationId={selectedObsId}
                onSelectObservation={(obs) => {
                  if (obs) onSelectObservation(obs)
                }}
              />
            </Suspense>

            {/* Camera Zoom & Region Target Handler */}
            <GlobeCameraHandler
              zoomTrigger={zoomTrigger}
              resetTrigger={resetTrigger}
              targetRegion={regionSelect}
              controlsRef={controlsRef}
            />

            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              minDistance={2.6}
              maxDistance={8.5}
              rotateSpeed={0.9}
              zoomSpeed={0.9}
              enableDamping={true}
              dampingFactor={0.12}
            />
          </Canvas>
        </div>

        {/* Floating Zoom & Orientation Controls */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 z-20">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-800 text-xs font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-800 text-xs font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer"
            title="Reset View to Indian Ocean"
          >
            🧭
          </button>
        </div>
      </div>

      {/* ─── BOTTOM LEGEND BAR ─── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 shrink-0 text-[10px] sm:text-[10.5px] font-medium text-slate-700">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Argo */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Argo Float</span>
          </div>

          {/* Glider */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-[2px] bg-cyan-500" />
            <span>Glider</span>
          </div>

          {/* CTD */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-amber-500 leading-none font-bold">▲</span>
            <span>CTD Profile</span>
          </div>

          {/* BGC */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>BGC Measurement</span>
          </div>
        </div>

        <div className="text-[9.5px] font-mono text-slate-400">
          Showing {observations.length} locations
        </div>
      </div>

    </div>
  )
}
