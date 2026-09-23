"use client"

import React from "react"
import { GeographicBounds } from "../globe/RegionSelectionBox"
import { ModelControlState } from "./ModelControlPanel"
import { ModelFieldResponse } from "@/lib/modelApi"

interface RegionInformationPanelProps {
  selectedRegion: GeographicBounds | null
  modelState: ModelControlState
  regionalCounts: Record<string, number>
  totalObservations: number
  scalarFieldData: ModelFieldResponse | null
  uFieldData: ModelFieldResponse | null
  vFieldData: ModelFieldResponse | null
  modelLoading: boolean
}

const VAR_METADATA: Record<
  string,
  { label: string; cmemsVar: string; unit: string; product: string }
> = {
  temperature: {
    label: "Temperature",
    cmemsVar: "thetao",
    unit: "°C",
    product: "GLOBAL_ANALYSIS_PHY_001_024",
  },
  salinity: {
    label: "Salinity",
    cmemsVar: "so",
    unit: "PSU",
    product: "GLOBAL_ANALYSIS_PHY_001_024",
  },
  currents: {
    label: "Currents",
    cmemsVar: "uo, vo",
    unit: "m/s",
    product: "GLOBAL_ANALYSIS_PHY_001_024",
  },
  chlorophyll: {
    label: "Chlorophyll",
    cmemsVar: "chl",
    unit: "mg/m³",
    product: "GLOBAL_ANALYSIS_BGC_001_028",
  },
}

export default function RegionInformationPanel({
  selectedRegion,
  modelState,
  regionalCounts,
  totalObservations,
  scalarFieldData,
  uFieldData,
  vFieldData,
  modelLoading,
}: RegionInformationPanelProps) {
  const getDateStr = (index: number) => {
    const baseDate = new Date(Date.UTC(2026, 0, 1))
    baseDate.setUTCDate(baseDate.getUTCDate() + index)
    const day = baseDate.getUTCDate().toString().padStart(2, "0")
    const month = baseDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    const year = baseDate.getUTCFullYear()
    return `${day} ${month} ${year}`
  }

  const bounds = selectedRegion || { latMin: -18.0, latMax: -5.0, lonMin: 65.0, lonMax: 85.0 }
  const latMin = Math.min(bounds.latMin, bounds.latMax)
  const latMax = Math.max(bounds.latMin, bounds.latMax)
  const lonMin = Math.min(bounds.lonMin, bounds.lonMax)
  const lonMax = Math.max(bounds.lonMin, bounds.lonMax)

  const dLat = (latMax - latMin).toFixed(2)
  const dLon = (lonMax - lonMin).toFixed(2)

  const formatCoord = (val: number, isLat: boolean) => {
    if (isLat) {
      return val >= 0 ? `${val.toFixed(2)}° N` : `${Math.abs(val).toFixed(2)}° S`
    }
    return val >= 0 ? `${val.toFixed(2)}° E` : `${Math.abs(val).toFixed(2)}° W`
  }

  const isCurrents = modelState.variable === "currents"
  const activeModel = isCurrents ? uFieldData : scalarFieldData
  const meta = VAR_METADATA[modelState.variable] || VAR_METADATA.temperature

  // Bounding box percentage in Indian Ocean reference window (Lon: 30..120, Lat: -40..30)
  const boxLeft = Math.max(5, Math.min(85, ((lonMin - 30) / 90) * 100))
  const boxTop = Math.max(5, Math.min(85, ((30 - latMax) / 70) * 100))
  const boxWidth = Math.max(10, Math.min(60, ((lonMax - lonMin) / 90) * 100))
  const boxHeight = Math.max(10, Math.min(60, ((latMax - latMin) / 70) * 100))

  return (
    <aside className="w-full flex flex-col gap-2.5 text-slate-800 font-sans text-xs select-none">
      
      {/* ─── CARD 1: REGION INFORMATION ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-2 shrink-0">
        <h3 className="text-[11.5px] font-bold tracking-wider text-slate-800 uppercase">
          REGION INFORMATION
        </h3>

        <div className="flex items-center gap-3">
          {/* Mini Regional Map Thumbnail with Dynamic Bounding Box */}
          <div className="relative w-[90px] h-[58px] rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0c4a6e] shrink-0">
            {/* Satellite/Bathymetry Texture layer */}
            <div
              className="absolute inset-0 opacity-85 bg-cover bg-center"
              style={{ backgroundImage: "url('/textures/earth_4k_v3.jpg')", backgroundPosition: "62% 52%" }}
            />
            {/* Region Selection Highlight Bounding Box */}
            <div
              className="absolute border-2 border-white rounded-[2px] shadow-[0_0_6px_rgba(255,255,255,0.8)] bg-sky-400/20"
              style={{
                left: `${boxLeft}%`,
                top: `${boxTop}%`,
                width: `${boxWidth}%`,
                height: `${boxHeight}%`,
              }}
            />
          </div>

          {/* Regional Coordinates */}
          <div className="flex flex-col font-mono text-[11px] leading-tight space-y-0.5">
            <span className="font-bold text-slate-900 text-xs font-sans">Indian Ocean</span>
            <span className="text-slate-600">{formatCoord(latMin, true)} → {formatCoord(latMax, true)}</span>
            <span className="text-slate-600">{formatCoord(lonMin, false)} → {formatCoord(lonMax, false)}</span>
            <span className="text-slate-500 font-sans text-[10px]">
              Span: <strong className="font-mono text-slate-700">▲ {dLat}° × {dLon}°</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ─── CARD 2: MODEL DATA & RESOLUTION ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-1.5 shrink-0">
        <h3 className="text-[11.5px] font-bold tracking-wider text-slate-800 uppercase">
          MODEL DATA &amp; RESOLUTION
        </h3>

        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Active Variable:</span>
            <span className="text-[#0284c7] font-semibold text-[11px] font-mono">
              {meta.label} ({meta.cmemsVar})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Selected Depth:</span>
            <span className="text-slate-900 font-mono font-bold text-[11px]">
              {activeModel?.depth !== undefined
                ? `${modelState.depth} m (${activeModel.depth.toFixed(0)} m)`
                : `${modelState.depth} m`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Simulation Date:</span>
            <span className="text-slate-900 font-mono text-[11px]">{getDateStr(modelState.timeStepIndex)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Spatial Grid:</span>
            <span className="text-slate-900 font-mono text-[11px]">0.083° (~9 km)</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Grid Cells:</span>
            <span className="text-slate-900 font-mono text-[11px]">
              {activeModel ? `${activeModel.width} × ${activeModel.height}` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Value Range:</span>
            <span className="text-slate-900 font-mono font-bold text-[11px]">
              {activeModel && activeModel.min_value != null && activeModel.max_value != null
                ? `${activeModel.min_value.toFixed(1)} – ${activeModel.max_value.toFixed(1)} ${meta.unit}`
                : isCurrents
                ? "0.00 – 1.00 m/s"
                : "—"}
            </span>
          </div>

          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">CMEMS Status:</span>
            {modelLoading ? (
              <span className="text-[#0284c7] font-semibold text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full border border-[#0284c7] border-t-transparent animate-spin inline-block" />
                Loading…
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold font-mono text-[10px]">Real CMEMS Data</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── CARD 3: INSTRUMENTS IN REGION ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-1.5 shrink-0">
        <h3 className="text-[11.5px] font-bold tracking-wider text-slate-800 uppercase">
          INSTRUMENTS IN REGION
        </h3>

        <div className="space-y-1.5 text-[11.5px]">
          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50/90 hover:bg-slate-100/90 transition">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-700 font-medium">Argo Floats</span>
            </div>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {regionalCounts.argo?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50/90 hover:bg-slate-100/90 transition">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-500" />
              <span className="text-slate-700 font-medium">Gliders</span>
            </div>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {regionalCounts.glider?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50/90 hover:bg-slate-100/90 transition">
            <div className="flex items-center gap-2">
              <span className="text-[11px] leading-none text-orange-500 font-bold">▲</span>
              <span className="text-slate-700 font-medium">CTD Profiles</span>
            </div>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {regionalCounts.ctd?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50/90 hover:bg-slate-100/90 transition">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-700 font-medium">BGC Measurements</span>
            </div>
            <span className="font-mono font-bold text-slate-800 text-[11px]">
              {regionalCounts.bgc?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* ─── CARD 4: HOW TO USE ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-1.5 shrink-0">
        <h3 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
          HOW TO USE
        </h3>

        <div className="space-y-1 text-[10px] text-slate-600 leading-snug">
          <div className="flex items-start gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0284c7] text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span>Select variable, depth and time from the left controls.</span>
          </div>

          <div className="flex items-start gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0284c7] text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span>Explore 3D volume using mouse (rotate, zoom, pan).</span>
          </div>

          <div className="flex items-start gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0284c7] text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span>Toggle slices, isosurfaces and vectors to analyze structures.</span>
          </div>

          <div className="flex items-start gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0284c7] text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <span>Click any feature or observation for vertical profile details.</span>
          </div>
        </div>
      </div>

    </aside>
  )
}
