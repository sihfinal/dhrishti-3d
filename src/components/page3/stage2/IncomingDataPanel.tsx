"use client"

import React, { useMemo } from "react"
import { ModelFieldResponse } from "@/lib/modelApi"
import { timeStepIndexToDateString } from "@/lib/modelApi"

interface IncomingDataPanelProps {
  variable: string
  timeStepIndex: number
  depth: number
  depthStack: ModelFieldResponse[]
  uDepthStack: ModelFieldResponse[]
  vDepthStack: ModelFieldResponse[]
  preloadedCount: number
  totalCount: number
  isPreloading: boolean
  monthlyDataReady: boolean
}

const VARIABLE_UNITS: Record<string, string> = {
  temperature: "°C",
  salinity: "PSU",
  chlorophyll: "mg/m³",
  currents: "m/s",
  u_velocity: "m/s",
  v_velocity: "m/s",
}

function computeStats(values: (number | null)[][]): {
  min: number
  max: number
  mean: number
  sample: number | null
  validCount: number
  totalCount: number
} {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let validCount = 0
  const totalCount = values.length * (values[0]?.length || 0)
  const midRow = Math.floor(values.length / 2)
  const midCol = Math.floor((values[0]?.length || 0) / 2)
  let sample = values[midRow]?.[midCol] ?? null

  for (let r = 0; r < values.length; r++) {
    const row = values[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      if (v !== null && v !== undefined && !Number.isNaN(v)) {
        if (v < min) min = v
        if (v > max) max = v
        sum += v
        validCount++
      }
    }
  }

  // If exact center cell is land/null, search outwards for the nearest valid ocean cell
  if (sample === null && validCount > 0) {
    const maxRadius = Math.max(values.length, values[0]?.length || 0)
    outer: for (let radius = 1; radius < maxRadius; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) === radius || Math.abs(dc) === radius) {
            const r = midRow + dr
            const c = midCol + dc
            if (r >= 0 && r < values.length && c >= 0 && c < (values[0]?.length || 0)) {
              const v = values[r]?.[c]
              if (v !== null && v !== undefined && !Number.isNaN(v)) {
                sample = v
                break outer
              }
            }
          }
        }
      }
    }
  }

  return {
    min: validCount > 0 ? min : 0,
    max: validCount > 0 ? max : 0,
    mean: validCount > 0 ? sum / validCount : 0,
    sample,
    validCount,
    totalCount,
  }
}

export default function IncomingDataPanel({
  variable,
  timeStepIndex,
  depth,
  depthStack,
  uDepthStack,
  vDepthStack,
  preloadedCount,
  totalCount,
  isPreloading,
  monthlyDataReady,
}: IncomingDataPanelProps) {
  const dateStr = timeStepIndexToDateString(timeStepIndex)
  const isCurrents = variable.toLowerCase() === "currents"
  const unit = VARIABLE_UNITS[variable.toLowerCase()] || ""

  // Find nearest depth slice
  const nearestSlice = useMemo(() => {
    const stack = isCurrents ? uDepthStack : depthStack
    if (!stack || stack.length === 0) return null
    return stack.reduce((prev, curr) =>
      Math.abs((curr.depth ?? 0) - depth) < Math.abs((prev.depth ?? 0) - depth) ? curr : prev
    )
  }, [depthStack, uDepthStack, isCurrents, depth])

  const nearestVSlice = useMemo(() => {
    if (!isCurrents || !vDepthStack || vDepthStack.length === 0) return null
    return vDepthStack.reduce((prev, curr) =>
      Math.abs((curr.depth ?? 0) - depth) < Math.abs((prev.depth ?? 0) - depth) ? curr : prev
    )
  }, [vDepthStack, isCurrents, depth])

  const scalarStats = useMemo(() => {
    if (!nearestSlice?.values) return null
    return computeStats(nearestSlice.values)
  }, [nearestSlice, timeStepIndex])

  const uStats = useMemo(() => {
    if (!isCurrents || !nearestSlice?.values) return null
    return computeStats(nearestSlice.values)
  }, [nearestSlice, isCurrents, timeStepIndex])

  const vStats = useMemo(() => {
    if (!isCurrents || !nearestVSlice?.values) return null
    return computeStats(nearestVSlice.values)
  }, [nearestVSlice, isCurrents, timeStepIndex])

  const resolvedDepth = nearestSlice?.depth ?? depth
  const gridW = nearestSlice?.width ?? 0
  const gridH = nearestSlice?.height ?? 0
  const hasData = nearestSlice != null

  const statusText = !hasData
    ? "No Data"
    : isPreloading
    ? `Loading ${preloadedCount}/${totalCount}`
    : monthlyDataReady
    ? "Loaded"
    : "Loading..."

  const statusColor = !hasData
    ? "text-slate-400"
    : isPreloading
    ? "text-amber-600"
    : monthlyDataReady
    ? "text-emerald-600"
    : "text-sky-600"

  const fmt = (v: number | null | undefined, decimals: number = 3) =>
    v != null && !Number.isNaN(v) ? v.toFixed(decimals) : "—"

  const dateParts = dateStr.split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const displayDate = dateParts.length === 3
    ? `${parseInt(dateParts[2], 10)} ${months[parseInt(dateParts[1], 10) - 1] || dateParts[1]} ${dateParts[0]}`
    : dateStr
  const currentDay = dateParts.length === 3 ? parseInt(dateParts[2], 10) : 1

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-sans font-semibold text-slate-700 uppercase tracking-wider">
          Incoming Data
        </span>
        <span className={`text-[10px] font-sans font-semibold ${statusColor} flex items-center gap-1`}>
          {isPreloading && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          )}
          {statusText}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <Row label="DATE" value={displayDate} />
        <Row label="VARIABLE" value={variable.charAt(0).toUpperCase() + variable.slice(1)} />
        <Row label="DEPTH" value={`${depth} m`} />
        <Row label="RESOLVED" value={`${fmt(resolvedDepth, 1)} m`} />

        {!isCurrents && scalarStats && (
          <>
            <Row label="MIN" value={`${fmt(scalarStats.min)} ${unit}`} accent />
            <Row label="MAX" value={`${fmt(scalarStats.max)} ${unit}`} accent />
            <Row label="MEAN" value={`${fmt(scalarStats.mean)} ${unit}`} accent />
            <Row label="SAMPLE" value={`${fmt(scalarStats.sample)} ${unit}`} />
          </>
        )}

        {isCurrents && uStats && vStats && (
          <>
            <Row label="U MIN" value={`${fmt(uStats.min)} ${unit}`} accent />
            <Row label="U MAX" value={`${fmt(uStats.max)} ${unit}`} accent />
            <Row label="V MIN" value={`${fmt(vStats.min)} ${unit}`} accent />
            <Row label="V MAX" value={`${fmt(vStats.max)} ${unit}`} accent />
            <Row label="VECTOR COUNT" value={`${(gridW * gridH).toLocaleString()}`} />
          </>
        )}

        <Row label="GRID" value={gridW > 0 ? `${gridW} × ${gridH}` : "—"} />
        <Row label="FRAME" value={totalCount > 0 ? `${currentDay} / ${totalCount}` : "—"} />
        <Row label="STATUS" value={!hasData ? "No Data" : isPreloading ? "Preloading…" : "Loaded"} />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className={accent ? "text-sky-700 font-semibold" : "text-slate-800"}>
        {value}
      </span>
    </>
  )
}
