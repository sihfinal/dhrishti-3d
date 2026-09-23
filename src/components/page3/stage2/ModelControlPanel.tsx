"use client"

import React, { useState, useEffect } from "react"

export interface ModelControlState {
  variable: string
  depth: number
  timeStepIndex: number
  showDepthSlices: boolean
  show3DVolume: boolean
  showIsosurfaces: boolean
  showCurrentVectors: boolean
  vectorDensity: number
  verticalExaggeration?: number
  isosurfaceValue?: number
  colorScale: string
}

interface ModelControlPanelProps {
  state: ModelControlState
  onChange: (updater: (prev: ModelControlState) => ModelControlState) => void
}

const VARIABLES = [
  { id: "temperature", label: "Temperature (°C)", icon: "🌡️", unit: "°C", min: 10, max: 35 },
  { id: "salinity", label: "Salinity (PSU)", icon: "💧", unit: "PSU", min: 32, max: 37 },
  { id: "currents", label: "Currents (m/s)", icon: "🧭", unit: "m/s", min: 0, max: 1.5 },
  { id: "chlorophyll", label: "Chlorophyll (mg/m³)", icon: "🌿", unit: "mg/m³", min: 0.01, max: 5.0 },
]

export default function ModelControlPanel({ state, onChange }: ModelControlPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const activeVar = VARIABLES.find((v) => v.id === state.variable) || VARIABLES[0]

  // Time Playback Timer: Advances through real model daily steps (0..89)
  useEffect(() => {
    if (!isPlaying) return
    const intervalMs = Math.max(350, Math.round(1100 / speed))
    const timer = setInterval(() => {
      onChange((prev) => ({
        ...prev,
        timeStepIndex: (prev.timeStepIndex + 1) % 90,
      }))
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isPlaying, speed, onChange])

  // Calculate formatted time date from timeStepIndex (0 - 89)
  const getDateStr = (index: number) => {
    const baseDate = new Date(Date.UTC(2026, 0, 1))
    baseDate.setUTCDate(baseDate.getUTCDate() + index)
    const day = baseDate.getUTCDate().toString().padStart(2, "0")
    const month = baseDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    const year = baseDate.getUTCFullYear()
    return `${day} ${month} ${year}`
  }

  // Determine variable-specific isosurface thresholds
  const isoMin =
    state.variable === "temperature"
      ? 15
      : state.variable === "salinity"
      ? 33.0
      : state.variable === "chlorophyll"
      ? 0.02
      : 0.05

  const isoMax =
    state.variable === "temperature"
      ? 32
      : state.variable === "salinity"
      ? 36.5
      : state.variable === "chlorophyll"
      ? 2.0
      : 1.2

  const isoStep =
    state.variable === "temperature"
      ? 0.5
      : state.variable === "salinity"
      ? 0.1
      : state.variable === "chlorophyll"
      ? 0.02
      : 0.05

  const defaultIso =
    state.variable === "temperature"
      ? 26.0
      : state.variable === "salinity"
      ? 35.0
      : state.variable === "chlorophyll"
      ? 0.3
      : 0.35

  const currentIso = state.isosurfaceValue ?? defaultIso

  return (
    <aside className="w-full flex flex-col gap-3 pr-0.5 text-slate-800 font-sans text-xs select-none">
      
      {/* ─── CARD 1: MODEL CONTROLS ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-2.5 shrink-0">
        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
          MODEL CONTROLS
        </h3>

        {/* 1. Variable Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-700">
            Variable
          </label>
          <div className="relative">
            <select
              value={state.variable}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  variable: e.target.value,
                  isosurfaceValue: undefined,
                }))
              }
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition cursor-pointer appearance-none"
            >
              {VARIABLES.map((v) => (
                <option key={v.id} value={v.id} className="bg-white text-slate-800">
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Depth Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700">
              Depth (Model Layer)
            </label>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-50 border border-sky-200 text-[#0284c7]">
              {state.depth} m
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2000}
            step={25}
            value={state.depth}
            onChange={(e) => onChange((prev) => ({ ...prev, depth: Number(e.target.value) }))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none mt-1"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>0 m</span>
            <span>2000 m</span>
          </div>
        </div>

        {/* 3. Time Slider & Media Playback */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700">
              Time
            </label>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-50 border border-sky-200 text-[#0284c7]">
              {getDateStr(state.timeStepIndex)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={89}
            value={state.timeStepIndex}
            onChange={(e) => onChange((prev) => ({ ...prev, timeStepIndex: Number(e.target.value) }))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none mt-1"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>01 Jan 2026</span>
            <span>31 Mar 2026</span>
          </div>

          {/* Media Playback Controls */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, timeStepIndex: Math.max(0, prev.timeStepIndex - 1) }))}
              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition shadow-xs cursor-pointer"
              title="Previous Day"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center shadow-md shadow-sky-500/20 transition cursor-pointer"
              title={isPlaying ? "Pause Timeline" : "Play Timeline Animation"}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, timeStepIndex: (prev.timeStepIndex + 1) % 90 }))}
              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition shadow-xs cursor-pointer"
              title="Next Day"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-[#0284c7] transition shadow-xs cursor-pointer"
              title="Toggle Playback Speed"
            >
              {speed}x
            </button>
          </div>
        </div>
      </div>

      {/* ─── CARD 2: VISUALIZATION OPTIONS (Expanded with flex-1 and justify-between for flush bottom alignment) ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex-1 flex flex-col justify-between">
        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
          VISUALIZATION OPTIONS
        </h3>

        {/* 2x2 Checkbox Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.showDepthSlices}
              onChange={(e) => onChange((prev) => ({ ...prev, showDepthSlices: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">Depth Slices</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.show3DVolume}
              onChange={(e) => onChange((prev) => ({ ...prev, show3DVolume: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">3D Volume</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.showIsosurfaces}
              onChange={(e) => onChange((prev) => ({ ...prev, showIsosurfaces: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">Isosurfaces</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.showCurrentVectors}
              onChange={(e) => onChange((prev) => ({ ...prev, showCurrentVectors: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">Current Vectors</span>
          </label>
        </div>

        {/* Vector Density Slider */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
            <span className="font-semibold">Vector Density</span>
            <span className="font-mono text-[#0284c7] font-bold">{state.vectorDensity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            disabled={!state.showCurrentVectors}
            value={state.vectorDensity}
            onChange={(e) => onChange((prev) => ({ ...prev, vectorDensity: Number(e.target.value) }))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none ${
              state.showCurrentVectors ? "bg-slate-200 accent-[#0284c7]" : "bg-slate-100 opacity-40 cursor-not-allowed"
            }`}
          />
        </div>

        {/* Vertical Exaggeration Slider (1x to 10x, default 7x) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
            <span className="font-semibold">Vertical Exaggeration</span>
            <span className="font-mono text-slate-900 font-bold">{state.verticalExaggeration || 7}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={state.verticalExaggeration || 7}
            onChange={(e) => onChange((prev) => ({ ...prev, verticalExaggeration: Number(e.target.value) }))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Isosurface Threshold Slider */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
            <span className="font-semibold">Isosurface Threshold</span>
            <span className="font-mono text-emerald-600 font-bold">
              {currentIso.toFixed(state.variable === "chlorophyll" ? 2 : 1)} {activeVar.unit}
            </span>
          </div>
          <input
            type="range"
            min={isoMin}
            max={isoMax}
            step={isoStep}
            value={currentIso}
            onChange={(e) => onChange((prev) => ({ ...prev, isosurfaceValue: Number(e.target.value) }))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
            <span>{isoMin} {activeVar.unit}</span>
            <span>{isoMax} {activeVar.unit}</span>
          </div>
        </div>

      </div>
    </aside>
  )
}
