"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ObservationItem } from "@/lib/observationsApi"
import {
  fetchModelObsComparison,
  ComparisonResponse,
  ComparisonPoint,
} from "@/lib/comparisonApi"

interface ModelObsComparisonViewProps {
  observation: ObservationItem
}

export default function ModelObsComparisonView({
  observation,
}: ModelObsComparisonViewProps) {
  const [activeVar, setActiveVar] = useState<string>("temperature")
  const [compData, setCompData] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [showTable, setShowTable] = useState<boolean>(false)

  // Fetch comparison whenever observation or active variable changes
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchModelObsComparison(observation.id, activeVar)
      .then((res) => {
        if (!active) return
        setCompData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        console.warn("Model comparison fetch notice:", err)
        setError(err.message || "Model comparison unavailable for this observation.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [observation.id, activeVar])

  // Supported variables from observation or response
  const supportedVars = useMemo(() => {
    if (compData?.supported_variables && compData.supported_variables.length > 0) {
      return compData.supported_variables
    }
    const obsVars = observation.variables || ["temperature", "salinity"]
    const list = []
    if (obsVars.includes("temperature")) list.push({ id: "temperature", label: "Temperature", unit: "°C" })
    if (obsVars.includes("salinity")) list.push({ id: "salinity", label: "Salinity", unit: "PSU" })
    if (obsVars.includes("chlorophyll")) list.push({ id: "chlorophyll", label: "Chlorophyll", unit: "mg/m³" })
    return list.length > 0 ? list : [{ id: "temperature", label: "Temperature", unit: "°C" }]
  }, [compData, observation.variables])

  // Chart coordinate math
  const points = compData?.profile_comparison || []
  const modelFull = compData?.model_full_profile || []
  const unit = compData?.model_match?.unit || "°C"

  const { minVal, maxVal, maxDepth } = useMemo(() => {
    if (points.length === 0 && modelFull.length === 0) {
      return { minVal: 0, maxVal: 30, maxDepth: 1000 }
    }
    let minV = Infinity
    let maxV = -Infinity
    let maxD = 0

    for (const p of points) {
      if (p.obs_value < minV) minV = p.obs_value
      if (p.obs_value > maxV) maxV = p.obs_value
      if (p.model_value < minV) minV = p.model_value
      if (p.model_value > maxV) maxV = p.model_value
      if (p.depth > maxD) maxD = p.depth
    }

    for (const m of modelFull) {
      if (m.value < minV) minV = m.value
      if (m.value > maxV) maxV = m.value
      if (m.depth > maxD) maxD = m.depth
    }

    if (minV === Infinity) minV = 0
    if (maxV === -Infinity) maxV = 30
    if (minV === maxV) {
      minV -= 1
      maxV += 1
    }
    const pad = (maxV - minV) * 0.08
    return { minVal: minV - pad, maxVal: maxV + pad, maxDepth: Math.max(50, maxD) }
  }, [points, modelFull])

  const W = 340
  const H = 220
  const PAD_L = 48
  const PAD_R = 20
  const PAD_T = 24
  const PAD_B = 24

  const valToX = (v: number) => {
    const norm = (v - minVal) / (maxVal - minVal)
    return PAD_L + norm * (W - PAD_L - PAD_R)
  }

  const depthToY = (d: number) => {
    const norm = d / maxDepth
    return PAD_T + norm * (H - PAD_T - PAD_B)
  }

  // SVG Paths
  const obsPathD = useMemo(() => {
    if (points.length < 2) return ""
    return points.reduce((acc, pt, i) => {
      const x = valToX(pt.obs_value)
      const y = depthToY(pt.depth)
      return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`
    }, "")
  }, [points, minVal, maxVal, maxDepth])

  const modelPathD = useMemo(() => {
    const source = modelFull.length > 0 ? modelFull : points.map((p) => ({ depth: p.depth, value: p.model_value }))
    if (source.length < 2) return ""
    return source.reduce((acc, pt, i) => {
      const x = valToX(pt.value)
      const y = depthToY(pt.depth)
      return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`
    }, "")
  }, [modelFull, points, minVal, maxVal, maxDepth])

  // Ticks
  const depthTicks = useMemo(() => {
    const step = maxDepth <= 200 ? 50 : maxDepth <= 1000 ? 200 : 500
    const ticks: number[] = []
    for (let d = 0; d <= maxDepth; d += step) {
      ticks.push(d)
    }
    return ticks
  }, [maxDepth])

  const valTicks = useMemo(() => {
    const count = 4
    const ticks: number[] = []
    const range = maxVal - minVal
    for (let i = 0; i <= count; i++) {
      ticks.push(minVal + (i / count) * range)
    }
    return ticks
  }, [minVal, maxVal])

  return (
    <div className="flex flex-col gap-3 text-slate-800 select-none">
      {/* ─── Variable Selector Pill (Only mutually supported variables) ─── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
        {supportedVars.map((v) => {
          const isActive = v.id === activeVar
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveVar(v.id)}
              className={`flex-1 py-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#0284c7] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {v.label} ({v.unit})
            </button>
          )
        })}
      </div>

      {/* ─── Loading / Error States ─── */}
      {loading ? (
        <div className="rounded-xl bg-[#f8fafc] border border-slate-200/80 p-6 flex flex-col items-center justify-center gap-2 text-[#0284c7]">
          <span className="w-6 h-6 rounded-full border-2 border-[#0284c7] border-t-transparent animate-spin" />
          <span className="text-xs font-mono font-semibold">
            Fetching numerical model slice &amp; calculating residuals…
          </span>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-4 text-center text-amber-800 text-xs font-mono">
          {error}
        </div>
      ) : compData?.status === "out_of_bounds" ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-4 text-center text-amber-800 text-xs font-mono">
          {compData.message}
        </div>
      ) : compData && compData.model_match ? (
        <>
          {/* ─── Matching Metadata Info Bar ─── */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 font-mono text-[10.5px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-500">
              <span>Observation:</span>
              <span className="text-slate-900 font-semibold">
                {compData.observation.latitude >= 0 ? `${compData.observation.latitude}°N` : `${Math.abs(compData.observation.latitude)}°S`},{" "}
                {compData.observation.longitude >= 0 ? `${compData.observation.longitude}°E` : `${Math.abs(compData.observation.longitude)}°W`}
                {compData.observation.timestamp ? ` · ${compData.observation.timestamp}` : ""}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-500">
              <span>Model Grid Match:</span>
              <span className="text-[#0284c7] font-semibold">
                {compData.model_match.nearest_latitude >= 0 ? `${compData.model_match.nearest_latitude}°N` : `${Math.abs(compData.model_match.nearest_latitude)}°S`},{" "}
                {compData.model_match.nearest_longitude >= 0 ? `${compData.model_match.nearest_longitude}°E` : `${Math.abs(compData.model_match.nearest_longitude)}°W`}{" "}
                (Δd: {compData.model_match.spatial_distance_km} km)
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-500">
              <span>Model Simulation Date:</span>
              <span className="text-slate-800 font-semibold">
                {compData.model_match.model_date}
                {compData.model_match.time_difference_days !== null
                  ? ` (Δt: ${Math.abs(compData.model_match.time_difference_days)} days)`
                  : ""}
              </span>
            </div>
          </div>

          {/* ─── Profile Comparison Dual Chart ─── */}
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-[10.5px] font-bold tracking-wider text-slate-700 uppercase">
                DEPTH PROFILE COMPARISON
              </span>
              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" />
                  <span className="text-slate-700 font-semibold">Observation</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />
                  <span className="text-slate-700 font-semibold">Model</span>
                </div>
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div className="relative w-full flex justify-center py-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto overflow-visible select-none max-w-[380px]"
              >
                {/* Grid Lines */}
                {depthTicks.map((d) => {
                  const y = depthToY(d)
                  return (
                    <g key={`d-${d}`}>
                      <line
                        x1={PAD_L}
                        y1={y}
                        x2={W - PAD_R}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth={1}
                      />
                      <text
                        x={PAD_L - 6}
                        y={y + 3}
                        textAnchor="end"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fill="#94a3b8"
                      >
                        {d}m
                      </text>
                    </g>
                  )
                })}

                {valTicks.map((v, i) => {
                  const x = valToX(v)
                  return (
                    <g key={`v-${i}`}>
                      <line
                        x1={x}
                        y1={PAD_T}
                        x2={x}
                        y2={H - PAD_B}
                        stroke="#f1f5f9"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={H - PAD_B + 12}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fill="#94a3b8"
                      >
                        {v.toFixed(1)}
                      </text>
                    </g>
                  )
                })}

                {/* Model Curve (Amber dashed/solid line) */}
                {modelPathD && (
                  <path
                    d={modelPathD}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.9}
                  />
                )}

                {/* Observation Curve (Emerald solid line) */}
                {obsPathD && (
                  <path
                    d={obsPathD}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2}
                    opacity={0.95}
                  />
                )}

                {/* Interactive Points on Observation Layers */}
                {points.map((pt, idx) => {
                  const x = valToX(pt.obs_value)
                  const y = depthToY(pt.depth)
                  const isHovered = hoveredIndex === idx

                  return (
                    <g key={idx}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 4.5 : 2}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        className="transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Hover Tooltip Card */}
            {hoveredIndex !== null && points[hoveredIndex] && (
              <div className="w-full mt-1 p-2 rounded-xl bg-slate-900 text-white font-mono text-[10.5px] flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-slate-400">Depth: </span>
                  <span className="font-bold">{points[hoveredIndex].depth}m</span>
                </div>
                <div>
                  <span className="text-emerald-400">Obs: </span>
                  <span className="font-bold">{points[hoveredIndex].obs_value} {unit}</span>
                </div>
                <div>
                  <span className="text-amber-400">Model: </span>
                  <span className="font-bold">{points[hoveredIndex].model_value} {unit}</span>
                </div>
                <div>
                  <span className="text-sky-300">Residual: </span>
                  <span className="font-bold">
                    {points[hoveredIndex].residual >= 0 ? `+${points[hoveredIndex].residual}` : points[hoveredIndex].residual} {unit}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Residual & Statistical Error Section ─── */}
          {compData.metrics && (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                  SCIENTIFIC RESIDUAL METRICS (OBS − MODEL)
                </span>
                <span className="text-[9.5px] font-mono text-slate-400">
                  N = {compData.metrics.valid_points_count} layers
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg p-2 border border-slate-200/60 shadow-2xs">
                  <span className="text-[9.5px] text-slate-400 block font-mono">Mean Residual</span>
                  <span className="text-xs font-bold font-mono text-slate-900">
                    {compData.metrics.mean_residual !== null
                      ? (compData.metrics.mean_residual >= 0 ? `+${compData.metrics.mean_residual}` : `${compData.metrics.mean_residual}`)
                      : "—"}{" "}
                    {unit}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-2 border border-slate-200/60 shadow-2xs">
                  <span className="text-[9.5px] text-slate-400 block font-mono">Mean Abs Error (MAE)</span>
                  <span className="text-xs font-bold font-mono text-slate-900">
                    {compData.metrics.mean_absolute_error !== null ? `${compData.metrics.mean_absolute_error}` : "—"} {unit}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-2 border border-slate-200/60 shadow-2xs">
                  <span className="text-[9.5px] text-slate-400 block font-mono">RMS Difference</span>
                  <span className="text-xs font-bold font-mono text-slate-900">
                    {compData.metrics.root_mean_square_difference !== null ? `${compData.metrics.root_mean_square_difference}` : "—"} {unit}
                  </span>
                </div>
              </div>

              {/* Toggle Layer Residuals Table */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowTable((prev) => !prev)}
                  className="text-[10.5px] text-[#0284c7] hover:underline font-mono font-semibold cursor-pointer"
                >
                  {showTable ? "Hide Residual Sounding Table ▲" : "View Layer Residuals Table ▼"}
                </button>
                <span className="text-[9.5px] text-slate-400 font-mono">
                  Residual = Obs − Model
                </span>
              </div>

              {showTable && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white text-[10px] font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-slate-600">
                      <tr>
                        <th className="p-1.5 border-b">Depth</th>
                        <th className="p-1.5 border-b">Obs</th>
                        <th className="p-1.5 border-b">Model</th>
                        <th className="p-1.5 border-b">Residual</th>
                        <th className="p-1.5 border-b">|Error|</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-sky-50/50">
                          <td className="p-1.5 font-bold">{p.depth}m</td>
                          <td className="p-1.5 text-emerald-700">{p.obs_value}</td>
                          <td className="p-1.5 text-amber-700">{p.model_value}</td>
                          <td className={`p-1.5 font-bold ${p.residual >= 0 ? "text-sky-700" : "text-indigo-700"}`}>
                            {p.residual >= 0 ? `+${p.residual}` : p.residual}
                          </td>
                          <td className="p-1.5 text-slate-600">{p.abs_error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
