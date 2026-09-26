"use client"

import React, { useState } from "react"
import Page3Globe from "./globe/Page3Globe"
import { GeographicBounds } from "./globe/RegionSelectionBox"
import RegionConfirmationModal from "./RegionConfirmationModal"
import ObservationDetailModal from "./ObservationDetailModal"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { ObservationItem } from "@/lib/observationsApi"
import { ModelFieldResponse } from "@/lib/modelApi"

interface Page3CenterViewportProps {
  onHoverCoordinates?: (coords: { lat: number; lon: number } | null) => void
  hoverCoordinates?: { lat: number; lon: number } | null
  currentOrientation?: number
  onOrientationReset?: () => void
  selectedRegion?: GeographicBounds | null
  onConfirmRegionExplore?: (bounds: GeographicBounds) => void
  onRegionChange?: (bounds: GeographicBounds | null) => void
  // Real In-Situ Observations
  observations?: ObservationItem[]
  visibleTypes?: Record<string, boolean>
  obsLoading?: boolean
  obsError?: string | null
  selectedObservation?: ObservationItem | null
  onSelectObservation?: (obs: ObservationItem | null) => void
  // Real Model Data Layers
  activeLayerId?: string
  activeLayerLabel?: string
  layerVisibility?: Record<string, boolean>
  scalarFieldData?: ModelFieldResponse | null
  uFieldData?: ModelFieldResponse | null
  vFieldData?: ModelFieldResponse | null
  modelLoading?: boolean
  modelError?: string | null
  isInitialModelLoad?: boolean
  loadingVariableId?: string | null
  isDepthUpdating?: boolean
  isTimeUpdating?: boolean
  depth?: number
  currentDateStr?: string
  vectorDensity?: "low" | "medium" | "high"
  showEEZ?: boolean
}

export default function Page3CenterViewport({
  onHoverCoordinates,
  hoverCoordinates: externalHoverCoords,
  currentOrientation = 0,
  onOrientationReset,
  selectedRegion = null,
  onConfirmRegionExplore,
  onRegionChange,
  observations = [],
  visibleTypes = { argo: true, glider: true, ctd: true, bgc: true },
  obsLoading = false,
  obsError = null,
  selectedObservation = null,
  onSelectObservation,
  activeLayerId = "temperature",
  activeLayerLabel = "Temperature",
  layerVisibility = { temperature: true, salinity: true, currents: true, chlorophyll: true },
  scalarFieldData = null,
  uFieldData = null,
  vFieldData = null,
  modelLoading = false,
  modelError = null,
  isInitialModelLoad = false,
  loadingVariableId = null,
  isDepthUpdating = false,
  isTimeUpdating = false,
  depth = 75,
  currentDateStr = "15 Feb 2026",
  vectorDensity = "medium",
  showEEZ = true,
}: Page3CenterViewportProps) {
  const [zoomTrigger, setZoomTrigger] = useState<number>(0)
  const [resetTrigger, setResetTrigger] = useState<number>(0)
  const compassNeedleRef = React.useRef<SVGSVGElement>(null)
  const [selectionMode, setSelectionMode] = useState<boolean>(false)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [internalHoverCoords, setInternalHoverCoords] = useState<{ lat: number; lon: number } | null>(null)

  const activeHover = externalHoverCoords !== undefined ? externalHoverCoords : internalHoverCoords

  const handleOrientationChange = React.useCallback((heading: number) => {
    if (compassNeedleRef.current) {
      compassNeedleRef.current.style.transform = `rotate(${-heading}deg)`
    }
  }, [])

  const handleHover = (coords: { lat: number; lon: number } | null) => {
    setInternalHoverCoords(coords)
    onHoverCoordinates?.(coords)
  }

  const handleZoomIn = () => setZoomTrigger((prev) => prev + 1)
  const handleZoomOut = () => setZoomTrigger((prev) => prev - 1)
  const handleResetView = () => {
    setResetTrigger((prev) => prev + 1)
    if (compassNeedleRef.current) {
      compassNeedleRef.current.style.transform = "rotate(0deg)"
    }
    onOrientationReset?.()
  }

  const handleRegionSelect = (bounds: GeographicBounds | null) => {
    onRegionChange?.(bounds)
    if (bounds) {
      setShowConfirmModal(true)
    }
  }

  const handleConfirmExplore = () => {
    setShowConfirmModal(false)
    if (selectedRegion) {
      onConfirmRegionExplore?.(selectedRegion)
    }
  }

  return (
    <div
      className="relative w-full h-full min-h-[520px] flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 shadow-sm select-none bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url('/textures/globe-sky-background.jpg')`,
      }}
    >
      {/* ─── Confirmation Modal after Region Selection ─── */}
      <RegionConfirmationModal
        open={showConfirmModal}
        bounds={selectedRegion}
        onConfirm={handleConfirmExplore}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* ─── Observation Detail Modal / Inspector ─── */}
      <ObservationDetailModal
        observation={selectedObservation}
        onClose={() => onSelectObservation?.(null)}
      />

      {/* ─── Top Left Region Selection Button ─── */}
      <div className="absolute left-3.5 top-3.5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setSelectionMode(!selectionMode)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md border transition-all cursor-pointer ${
            selectionMode
              ? "bg-[#0284c7] text-white border-sky-400 shadow-sky-500/20 ring-2 ring-sky-300"
              : "bg-white/95 hover:bg-white text-slate-700 hover:text-[#0284c7] border-slate-200/90 backdrop-blur-md hover:shadow-lg"
          }`}
          title={selectionMode ? "Cancel Region Selection" : "Click to select the region"}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          <span>{selectionMode ? "Cancel selection" : "Click to select the region"}</span>
        </button>
      </div>

      {/* ─── Active Selection Mode Helper Banner ─── */}
      {selectionMode && (
        <div className="absolute top-3.5 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="bg-[#0a2540]/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-lg border border-sky-400/40 text-xs font-semibold flex items-center gap-2 pointer-events-auto">
            <span>📐</span>
            <span>Click & drag on globe to draw a region box</span>
          </div>
        </div>
      )}

      {/* ─── Non-Blocking Data Loading Banner ─── */}
      {modelLoading && !selectionMode && !isInitialModelLoad && (
        <div className="absolute top-3.5 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="bg-white/95 border border-sky-300 rounded-full px-4 py-1.5 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-slate-800 pointer-events-auto animate-in fade-in duration-200">
            <LoadingSpinner size="xs" color="#0284c7" label={loadingVariableId ? `Fetching ${activeLayerLabel} model data` : "Updating ocean data"} />
            {loadingVariableId ? (
              <>
                <span>Fetching {activeLayerLabel} model data…</span>
                <span className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Depth: {depth}m · {currentDateStr}
                </span>
              </>
            ) : (
              <>
                <span>Updating ocean data…</span>
                <span className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {isDepthUpdating ? `Depth: ${depth}m` : currentDateStr}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Right Floating Camera Toolbar ─── */}
      <div className="absolute right-3 top-4 z-20 pointer-events-auto flex flex-col items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-md p-1.5">
        {/* Reset / Center View Button */}
        <button
          type="button"
          onClick={handleResetView}
          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-[#0284c7] text-xs transition-colors cursor-pointer"
          title="Reset View & Orientation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
            <path strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {/* Zoom In (+) */}
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 hover:text-[#0284c7] text-base font-bold transition-colors cursor-pointer select-none"
          title="Zoom In"
        >
          +
        </button>

        {/* Zoom Out (−) */}
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 hover:text-[#0284c7] text-base font-bold transition-colors cursor-pointer select-none"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* ─── Elevated Compass Rose Indicator ─── */}
      <div className="absolute bottom-10 left-5 z-20 pointer-events-none select-none">
        <div className="relative w-16 h-16 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-slate-200/90 flex items-center justify-center p-1.5">
          <span className="absolute top-1 text-[9px] font-bold text-[#0284c7]">N</span>
          <span className="absolute bottom-1 text-[9px] font-bold text-slate-500">S</span>
          <span className="absolute left-1.5 text-[9px] font-bold text-slate-500">W</span>
          <span className="absolute right-1.5 text-[9px] font-bold text-slate-500">E</span>
          <svg
            ref={compassNeedleRef}
            className="w-7 h-7 fill-current text-[#0284c7] opacity-90 transition-transform duration-75"
            viewBox="0 0 24 24"
            style={{ transform: "rotate(0deg)" }}
          >
            <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
          </svg>
        </div>
      </div>

      {/* ─── Interactive 3D Earth Globe Canvas ─── */}
      <div className="relative flex-1 w-full h-full min-h-[400px]">
        <Page3Globe
          onHoverCoordinates={handleHover}
          zoomTrigger={zoomTrigger}
          resetTrigger={resetTrigger}
          onOrientationChange={handleOrientationChange}
          selectionMode={selectionMode}
          selectedRegion={selectedRegion}
          onRegionSelect={handleRegionSelect}
          observations={observations}
          visibleTypes={visibleTypes}
          selectedObservationId={selectedObservation?.id}
          onSelectObservation={onSelectObservation}
          activeLayerId={activeLayerId}
          layerVisibility={layerVisibility}
          scalarFieldData={scalarFieldData}
          uFieldData={uFieldData}
          vFieldData={vFieldData}
          vectorDensity={vectorDensity}
          showEEZ={showEEZ}
          isModelLoading={modelLoading && !isInitialModelLoad}
        />
      </div>

      {/* ─── Bottom Sub-status Bar ─── */}
      <div className="relative z-20 flex items-center justify-between px-4 py-1.5 bg-white/80 border-t border-slate-200/60 backdrop-blur-xs text-[10.5px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          {activeHover ? (
            <span className="text-slate-700 font-bold">
              Lat: {activeHover.lat >= 0 ? `${activeHover.lat.toFixed(2)}°N` : `${Math.abs(activeHover.lat).toFixed(2)}°S`}, Lon: {activeHover.lon >= 0 ? `${activeHover.lon.toFixed(2)}°E` : `${Math.abs(activeHover.lon).toFixed(2)}°W`}
            </span>
          ) : (
            <span>Center Lat: 0.00° · Lon: 75.00°E (Indian Ocean Basin)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {obsLoading && (
            <span className="text-sky-600 font-semibold flex items-center gap-1.5">
              <LoadingSpinner size="xs" color="#0284c7" label="Loading observations" />
              <span>Loading observations…</span>
            </span>
          )}
          {modelLoading && !isInitialModelLoad && (
            <span className="text-sky-700 font-semibold flex items-center gap-1.5">
              <LoadingSpinner size="xs" color="#0284c7" label={`Loading ${activeLayerId} model layer`} />
              <span>Loading {activeLayerLabel || activeLayerId} model layer…</span>
            </span>
          )}
          {modelError && !modelLoading && (
            <span className="text-rose-600 font-semibold flex items-center gap-1">
              <span>⚠️</span>
              <span>{modelError}</span>
            </span>
          )}
          {!obsLoading && !modelLoading && !modelError && (
            <span className="text-slate-400">Orbit, pan & zoom enabled</span>
          )}
        </div>
      </div>
    </div>
  )
}
