"use client"

import React, { useMemo } from "react"

interface DataPoint {
  date: string
  mean: number
  min: number
  max: number
}

interface DataEvolutionChartProps {
  dataPoints: DataPoint[]
  variable: string
  unit: string
  depth: number
}

export default function DataEvolutionChart({
  dataPoints,
  variable,
  unit,
  depth,
}: DataEvolutionChartProps) {
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return null

    const means = dataPoints.map((d) => d.mean)
    const mins = dataPoints.map((d) => d.min)
    const maxs = dataPoints.map((d) => d.max)

    const allVals = [...means, ...mins, ...maxs].filter((v) => isFinite(v))
    if (allVals.length === 0) return null

    const yMin = Math.min(...allVals)
    const yMax = Math.max(...allVals)
    const yRange = yMax - yMin || 1

    const padding = yRange * 0.1
    const effectiveMin = yMin - padding
    const effectiveMax = yMax + padding
    const effectiveRange = effectiveMax - effectiveMin

    return {
      means,
      mins,
      maxs,
      yMin: effectiveMin,
      yMax: effectiveMax,
      yRange: effectiveRange,
    }
  }, [dataPoints])

  if (!chartData || dataPoints.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
        <div className="text-[10px] font-sans font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Data Evolution
        </div>
        <div className="text-[11px] text-slate-400 italic h-10 flex items-center">
          Waiting for data...
        </div>
      </div>
    )
  }

  if (dataPoints.length === 1) {
    const pt = dataPoints[0]
    return (
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-sans font-semibold text-slate-700 uppercase tracking-wider">
            Data Evolution
          </span>
          <span className="text-[10px] font-sans text-slate-500">
            {variable} at {depth}m · {unit}
          </span>
        </div>
        <div className="h-14 flex items-center justify-between px-3 bg-sky-50/50 rounded-lg border border-sky-100 font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="font-semibold text-slate-800">{pt.date}</span>
          </div>
          <div className="text-sky-700 font-bold">
            Mean: {pt.mean.toFixed(2)} {unit}
          </div>
          <div className="text-slate-500 text-[10px]">
            [{pt.min.toFixed(1)} – {pt.max.toFixed(1)}]
          </div>
        </div>
      </div>
    )
  }

  const W = 280
  const H = 64
  const n = dataPoints.length

  const toX = (i: number) => (i / Math.max(n - 1, 1)) * W
  const toY = (v: number) => H - ((v - chartData.yMin) / chartData.yRange) * H

  // Build SVG path for means
  const meanPath = dataPoints
    .map((_, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(chartData.means[i]).toFixed(1)}`)
    .join(" ")

  // Build min/max range area
  const rangeTop = dataPoints
    .map((_, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(chartData.maxs[i]).toFixed(1)}`)
    .join(" ")
  const rangeBottom = [...dataPoints]
    .reverse()
    .map((_, ri) => {
      const i = n - 1 - ri
      return `L${toX(i).toFixed(1)},${toY(chartData.mins[i]).toFixed(1)}`
    })
    .join(" ")
  const rangePath = `${rangeTop} ${rangeBottom} Z`

  // Label ticks
  const firstDate = dataPoints[0].date
  const lastDate = dataPoints[n - 1].date
  const midIdx = Math.floor(n / 2)
  const midDate = dataPoints[midIdx]?.date || ""

  const fmtDate = (d: string) => {
    const parts = d.split("-")
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1] || parts[1]}`
  }

  const lastMean = chartData.means[n - 1]

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-sans font-semibold text-slate-700 uppercase tracking-wider">
          Data Evolution
        </span>
        <span className="text-[10px] font-sans text-slate-500">
          {variable} at {depth}m · {unit}
        </span>
      </div>

      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-slate-400 font-mono -ml-1 pointer-events-none" style={{ width: 36 }}>
          <span>{chartData.yMax.toFixed(1)}</span>
          <span>{chartData.yMin.toFixed(1)}</span>
        </div>

        <div className="ml-9">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 64 }}
            preserveAspectRatio="none"
          >
            {/* Range fill */}
            <path d={rangePath} fill="rgba(14, 165, 233, 0.12)" stroke="none" />

            {/* Mean line */}
            <path
              d={meanPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Current point */}
            <circle
              cx={toX(n - 1)}
              cy={toY(lastMean)}
              r="3"
              fill="#0284c7"
              stroke="white"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
            <span>{fmtDate(firstDate)}</span>
            {n > 4 && <span>{fmtDate(midDate)}</span>}
            <span>{fmtDate(lastDate)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
