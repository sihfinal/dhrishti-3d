"use client"

import React from "react"
import { DataLayerItem } from "./page3Config"
import { cssGradient, PaletteId } from "@/lib/colormaps"

interface ColorbarCardProps {
  activeLayer: DataLayerItem | null
  minVal?: number | null
  maxVal?: number | null
  unit?: string
  depth?: number
  currentDateStr?: string
}

export default function ColorbarCard({
  activeLayer,
  minVal,
  maxVal,
  unit,
  depth = 75,
  currentDateStr = "15 Feb 2026",
}: ColorbarCardProps) {
  // If no model layer is selected -> Default to Base Ocean explanation or Temperature default
  const isBase = !activeLayer
  const label = isBase ? "Base Ocean" : activeLayer.label
  const icon = isBase ? "🌍" : activeLayer.icon
  const dataset =
    activeLayer?.id === "chlorophyll"
      ? "CMEMS Global Ocean Biogeochemistry"
      : isBase
      ? "GEBCO & Blue Marble High-Res Imagery"
      : "CMEMS Global Ocean Physics"
  const displayUnit = isBase ? "—" : unit || activeLayer.unit

  // Scientific Min / Max
  const effMin = isBase
    ? 0
    : minVal !== undefined && minVal !== null
    ? minVal
    : activeLayer.defaultMin
  const effMax = isBase
    ? 30
    : maxVal !== undefined && maxVal !== null
    ? maxVal
    : activeLayer.defaultMax

  // Palette gradient
  const palette: PaletteId =
    activeLayer?.id === "salinity"
      ? "viridis"
      : activeLayer?.id === "chlorophyll"
      ? "plasma"
      : "turbo"
  const gradient = cssGradient(palette, 32)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 select-none">
      <h3 className="text-[11px] font-bold tracking-[0.14em] text-slate-800 uppercase mb-2.5">
        LAYER INFORMATION
      </h3>

      {/* Layer Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-lg select-none">{icon}</span>
        <h4 className="text-sm font-bold text-slate-900 tracking-tight">
          {label}
        </h4>
      </div>

      {/* Metadata Table */}
      <div className="space-y-1 text-xs mb-3">
        <div className="flex items-center justify-between text-slate-600">
          <span className="text-slate-500 font-medium">Dataset</span>
          <span className="font-semibold text-slate-800 text-right truncate max-w-[170px]">
            {dataset}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="text-slate-500 font-medium">Depth</span>
          <span className="font-semibold text-slate-800 font-mono">
            {depth} m
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="text-slate-500 font-medium">Time</span>
          <span className="font-semibold text-slate-800 font-mono">
            {currentDateStr}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="text-slate-500 font-medium">Units</span>
          <span className="font-semibold text-slate-800 font-mono">
            {displayUnit}
          </span>
        </div>
      </div>

      {/* Horizontal Color Scale Bar */}
      {!isBase && (
        <div className="pt-1 border-t border-slate-100 flex flex-col gap-1">
          {/* Gradient Bar */}
          <div
            className="w-full h-2.5 rounded-full shadow-inner border border-slate-200"
            style={{ background: gradient }}
          />

          {/* Numerical Ticks */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
            <span>{effMin.toFixed(0)}</span>
            <span>{(effMin + (effMax - effMin) * 0.2).toFixed(0)}</span>
            <span>{(effMin + (effMax - effMin) * 0.4).toFixed(0)}</span>
            <span>{(effMin + (effMax - effMin) * 0.6).toFixed(0)}</span>
            <span>{(effMin + (effMax - effMin) * 0.8).toFixed(0)}</span>
            <span>{effMax.toFixed(0)}</span>
          </div>

          <p className="text-[10px] text-center text-slate-500 font-medium mt-0.5">
            {activeLayer.id === "temperature"
              ? "Sea Water Temperature (°C)"
              : activeLayer.id === "salinity"
              ? "Sea Water Practical Salinity (PSU)"
              : activeLayer.id === "currents"
              ? "Current Velocity Magnitude (m/s)"
              : "Mass Concentration of Chlorophyll (mg/m³)"}
          </p>
        </div>
      )}
    </div>
  )
}
