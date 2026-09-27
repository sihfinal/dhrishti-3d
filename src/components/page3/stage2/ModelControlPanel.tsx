"use client"

import React, { useState, useEffect } from "react"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

import { formatDisplayDate, dateStringToTimeStepIndex, timeStepIndexToDateString } from "@/lib/modelApi"

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
  modelLoading?: boolean
  isReady?: boolean
  isPreloading?: boolean
  isPlaying?: boolean
  onTogglePlay?: () => void
  onPrevDay?: () => void
  onNextDay?: () => void
  speed?: number
  onSpeedChange?: (speed: number) => void
  preloadProgress?: { loaded: number; total: number; currentDate: string } | null
  totalFrames?: number
  startDate?: string
  endDate?: string
  availableMinDate?: string
  availableMaxDate?: string
  availableDates?: string[]
  onLoadDateRange?: (start: string, end: string) => void
  activeDates?: string[]
}

const VARIABLES = [
  { id: "temperature", label: "Temperature (°C)", icon: "🌡️", unit: "°C", min: 10, max: 35 },
  { id: "salinity", label: "Salinity (PSU)", icon: "💧", unit: "PSU", min: 32, max: 37 },
  { id: "currents", label: "Currents (m/s)", icon: "🧭", unit: "m/s", min: 0, max: 1.5 },
  { id: "chlorophyll", label: "Chlorophyll (mg/m³)", icon: "🌿", unit: "mg/m³", min: 0.01, max: 5.0 },
]

export default function ModelControlPanel({
  state,
  onChange,
  modelLoading = false,
  isReady = true,
  isPreloading = false,
  isPlaying: isPlayingProp,
  onTogglePlay,
  onPrevDay,
  onNextDay,
  speed: speedProp,
  onSpeedChange,
  preloadProgress,
  totalFrames,
  startDate,
  endDate,
  availableMinDate: availableMinDateProp,
  availableMaxDate: availableMaxDateProp,
  availableDates,
  onLoadDateRange,
  activeDates,
}: ModelControlPanelProps) {
  const [internalPlaying, setInternalPlaying] = useState(false)
  const [internalSpeed, setInternalSpeed] = useState(4)

  // Derive dynamic bounds strictly from available model dates
  const effectiveMinDate =
    availableDates && availableDates.length > 0
      ? availableDates[0]
      : availableMinDateProp || "2026-01-01"

  const effectiveMaxDate =
    availableDates && availableDates.length > 0
      ? availableDates[availableDates.length - 1]
      : availableMaxDateProp || "2026-03-31"

  // Derive available years strictly from backend dataset (e.g. [2026])
  const availableYears = React.useMemo(() => {
    if (availableDates && availableDates.length > 0) {
      const set = new Set<number>()
      for (const d of availableDates) {
        const y = parseInt(d.slice(0, 4), 10)
        if (!isNaN(y)) set.add(y)
      }
      return Array.from(set).sort((a, b) => a - b)
    }
    if (effectiveMinDate && effectiveMaxDate) {
      const yMin = parseInt(effectiveMinDate.slice(0, 4), 10)
      const yMax = parseInt(effectiveMaxDate.slice(0, 4), 10)
      if (!isNaN(yMin) && !isNaN(yMax)) {
        const yrs: number[] = []
        for (let y = yMin; y <= yMax; y++) yrs.push(y)
        return yrs
      }
    }
    return [2026]
  }, [availableDates, effectiveMinDate, effectiveMaxDate])

  const hasAvailableData = availableYears.length > 0 && Boolean(effectiveMinDate && effectiveMaxDate)

  const formatBoundDate = (dateStr: string) => {
    if (!dateStr) return ""
    return formatDisplayDate(dateStringToTimeStepIndex(dateStr))
  }

  const displayAvailableRange = hasAvailableData
    ? `${formatBoundDate(effectiveMinDate)} – ${formatBoundDate(effectiveMaxDate)}`
    : ""

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (startDate) {
      const y = parseInt(startDate.slice(0, 4), 10)
      if (!isNaN(y) && availableYears.includes(y)) return y
    }
    return availableYears[0] || 2026
  })

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const [inputStart, setInputStart] = useState<string>(() => {
    if (startDate && (!effectiveMinDate || startDate >= effectiveMinDate) && (!effectiveMaxDate || startDate <= effectiveMaxDate)) {
      return startDate
    }
    return effectiveMinDate || "2026-02-01"
  })
  const [inputEnd, setInputEnd] = useState<string>(() => {
    if (endDate && (!effectiveMinDate || endDate >= effectiveMinDate) && (!effectiveMaxDate || endDate <= effectiveMaxDate)) {
      return endDate
    }
    return effectiveMaxDate || "2026-02-28"
  })
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    if (startDate) {
      if (effectiveMinDate && startDate < effectiveMinDate) {
        setInputStart(effectiveMinDate)
      } else if (effectiveMaxDate && startDate > effectiveMaxDate) {
        setInputStart(effectiveMaxDate)
      } else {
        setInputStart(startDate)
      }
    }
  }, [startDate, effectiveMinDate, effectiveMaxDate])

  useEffect(() => {
    if (endDate) {
      if (effectiveMinDate && endDate < effectiveMinDate) {
        setInputEnd(effectiveMinDate)
      } else if (effectiveMaxDate && endDate > effectiveMaxDate) {
        setInputEnd(effectiveMaxDate)
      } else {
        setInputEnd(endDate)
      }
    }
  }, [endDate, effectiveMinDate, effectiveMaxDate])

  const validateDateRange = (start: string, end: string): string | null => {
    if (!start || !end) {
      return "Please select both start and end dates."
    }

    const startYr = parseInt(start.slice(0, 4), 10)
    const endYr = parseInt(end.slice(0, 4), 10)

    if (availableYears.length > 0) {
      if (!availableYears.includes(startYr)) {
        return `Start year ${startYr} is not available. Only ${availableYears.join(", ")} is available in the model dataset.`
      }
      if (!availableYears.includes(endYr)) {
        return `End year ${endYr} is not available. Only ${availableYears.join(", ")} is available in the model dataset.`
      }
    }

    if (effectiveMinDate && start < effectiveMinDate) {
      return `Start date cannot be before ${formatBoundDate(effectiveMinDate)}.`
    }
    if (effectiveMaxDate && start > effectiveMaxDate) {
      return `Start date cannot be after ${formatBoundDate(effectiveMaxDate)}.`
    }
    if (effectiveMinDate && end < effectiveMinDate) {
      return `End date cannot be before ${formatBoundDate(effectiveMinDate)}.`
    }
    if (effectiveMaxDate && end > effectiveMaxDate) {
      return `End date cannot be after ${formatBoundDate(effectiveMaxDate)}.`
    }

    if (start > end) {
      return "Start date must be before the end date."
    }

    return null
  }

  const handleStartChange = (val: string) => {
    setInputStart(val)
    const err = validateDateRange(val, inputEnd)
    setRangeError(err)
  }

  const handleEndChange = (val: string) => {
    setInputEnd(val)
    const err = validateDateRange(inputStart, val)
    setRangeError(err)
  }

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear)
    const startYr = parseInt(inputStart.slice(0, 4), 10)
    const endYr = parseInt(inputEnd.slice(0, 4), 10)
    let newStart = inputStart
    let newEnd = inputEnd

    if (startYr !== newYear) {
      const datesInYear = availableDates?.filter((d) => d.startsWith(`${newYear}-`)) || []
      newStart = datesInYear.length > 0 ? datesInYear[0] : `${newYear}-01-01`
    }
    if (endYr !== newYear) {
      const datesInYear = availableDates?.filter((d) => d.startsWith(`${newYear}-`)) || []
      newEnd = datesInYear.length > 0 ? datesInYear[datesInYear.length - 1] : `${newYear}-12-31`
    }

    if (effectiveMinDate && newStart < effectiveMinDate) newStart = effectiveMinDate
    if (effectiveMaxDate && newStart > effectiveMaxDate) newStart = effectiveMaxDate
    if (effectiveMinDate && newEnd < effectiveMinDate) newEnd = effectiveMinDate
    if (effectiveMaxDate && newEnd > effectiveMaxDate) newEnd = effectiveMaxDate

    setInputStart(newStart)
    setInputEnd(newEnd)
    const err = validateDateRange(newStart, newEnd)
    setRangeError(err)
  }

  const handleLoadData = () => {
    const err = validateDateRange(inputStart, inputEnd)
    if (err) {
      setRangeError(err)
      return
    }
    setRangeError(null)
    if (onLoadDateRange) {
      onLoadDateRange(inputStart, inputEnd)
    }
  }

  const isControlled = isPlayingProp !== undefined && onTogglePlay !== undefined
  const activeIsPlaying = isControlled ? isPlayingProp : internalPlaying
  const activeSpeed = speedProp !== undefined ? speedProp : internalSpeed

  const activeVar = VARIABLES.find((v) => v.id === state.variable) || VARIABLES[0]

  // Compute frame progress and boundary status across active date range
  const curDateStr = timeStepIndexToDateString(state.timeStepIndex)
  const hasActiveDates = Boolean(activeDates && activeDates.length > 0)
  const activeTotalFrames = hasActiveDates
    ? activeDates!.length
    : totalFrames && totalFrames > 0
    ? totalFrames
    : 1
  const dateIndexInActive = hasActiveDates ? activeDates!.indexOf(curDateStr) : -1
  const activeCurrentFrame = dateIndexInActive !== -1 ? dateIndexInActive + 1 : 1
  const isAtEnd = !activeIsPlaying && activeCurrentFrame >= activeTotalFrames

  // Time slider bounds and values
  const sliderMin = 0
  const sliderMax = hasActiveDates ? activeDates!.length - 1 : 89
  const sliderValue = hasActiveDates ? (dateIndexInActive !== -1 ? dateIndexInActive : 0) : state.timeStepIndex

  const handleSliderChange = (newVal: number) => {
    if (hasActiveDates && activeDates) {
      const targetDate = activeDates[newVal]
      if (targetDate) {
        onChange((prev) => ({
          ...prev,
          timeStepIndex: dateStringToTimeStepIndex(targetDate),
        }))
      }
    } else {
      onChange((prev) => ({
        ...prev,
        timeStepIndex: newVal,
      }))
    }
  }

  // Fallback Time Playback Timer if uncontrolled
  useEffect(() => {
    if (isControlled || !activeIsPlaying) return
    const intervalMs = Math.max(350, Math.round(1100 / activeSpeed))
    const timer = setInterval(() => {
      onChange((prev) => {
        if (hasActiveDates && activeDates && activeDates.length > 1) {
          const currentCur = timeStepIndexToDateString(prev.timeStepIndex)
          const curIdx = activeDates.indexOf(currentCur)
          const nextIdx = (curIdx + 1) % activeDates.length
          return {
            ...prev,
            timeStepIndex: dateStringToTimeStepIndex(activeDates[nextIdx]),
          }
        }
        return {
          ...prev,
          timeStepIndex: (prev.timeStepIndex + 1) % 90,
        }
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isControlled, activeIsPlaying, activeSpeed, onChange, hasActiveDates, activeDates])

  const handleTogglePlay = () => {
    if (!isReady) return
    if (onTogglePlay) {
      onTogglePlay()
    } else {
      if (isAtEnd && !internalPlaying) {
        if (hasActiveDates && activeDates) {
          onChange((prev) => ({
            ...prev,
            timeStepIndex: dateStringToTimeStepIndex(activeDates[0]),
          }))
        } else {
          onChange((prev) => {
            const d = new Date(Date.UTC(2026, 0, 1 + prev.timeStepIndex))
            const firstDayIdx = dateStringToTimeStepIndex(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`)
            return { ...prev, timeStepIndex: firstDayIdx }
          })
        }
      }
      setInternalPlaying(!internalPlaying)
    }
  }

  const handleSelectSpeed = (newSpeed: number) => {
    if (onSpeedChange) {
      onSpeedChange(newSpeed)
    } else {
      setInternalSpeed(newSpeed)
    }
  }

  const handlePrev = () => {
    if (!isReady) return
    if (onPrevDay) {
      onPrevDay()
    } else {
      if (hasActiveDates && activeDates) {
        const curIdx = activeDates.indexOf(curDateStr)
        const prevIdx = Math.max(0, curIdx - 1)
        onChange((prev) => ({ ...prev, timeStepIndex: dateStringToTimeStepIndex(activeDates[prevIdx]) }))
      } else {
        onChange((prev) => ({ ...prev, timeStepIndex: Math.max(0, prev.timeStepIndex - 1) }))
      }
    }
  }

  const handleNext = () => {
    if (!isReady) return
    if (onNextDay) {
      onNextDay()
    } else {
      if (hasActiveDates && activeDates) {
        const curIdx = activeDates.indexOf(curDateStr)
        const nextIdx = Math.min(activeDates.length - 1, curIdx + 1)
        onChange((prev) => ({ ...prev, timeStepIndex: dateStringToTimeStepIndex(activeDates[nextIdx]) }))
      } else {
        onChange((prev) => ({ ...prev, timeStepIndex: (prev.timeStepIndex + 1) % 90 }))
      }
    }
  }

  // Calculate formatted time date from timeStepIndex (0 - 89) in UTC
  const getDateStr = (index: number) => {
    return formatDisplayDate(index)
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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-3 shrink-0">
        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
          MODEL CONTROLS
        </h3>

        {/* 1. VARIABLE */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
              VARIABLE
            </label>
            {modelLoading && (
              <span className="text-[10px] font-mono text-sky-600 flex items-center gap-1 font-semibold">
                <LoadingSpinner size="xs" color="#0284c7" label="Loading variable data" />
                <span>Loading…</span>
              </span>
            )}
          </div>
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

        {/* 2. DEPTH */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
              DEPTH
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
          <div className="text-[10px] text-slate-400 font-normal">
            Select model depth
          </div>
        </div>

        {/* 3. DATA RANGE */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
              DATA RANGE
            </label>
            <div className="flex items-center gap-2">
              {hasAvailableData && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    disabled={availableYears.length <= 1 || isPreloading || modelLoading}
                    className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-default"
                    title="Select model year"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="text-[10px] font-mono text-slate-400">
                {hasActiveDates ? `${activeTotalFrames} ${activeTotalFrames === 1 ? "day" : "days"} loaded` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Start</span>
              <input
                type="date"
                min={effectiveMinDate}
                max={effectiveMaxDate}
                value={inputStart}
                onChange={(e) => handleStartChange(e.target.value)}
                disabled={!hasAvailableData || isPreloading || modelLoading}
                className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <span className="text-slate-400 font-bold mt-3 shrink-0">→</span>
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">End</span>
              <input
                type="date"
                min={effectiveMinDate}
                max={effectiveMaxDate}
                value={inputEnd}
                onChange={(e) => handleEndChange(e.target.value)}
                disabled={!hasAvailableData || isPreloading || modelLoading}
                className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-normal">
            {hasAvailableData ? `Available data: ${displayAvailableRange}` : "No model date data available"}
          </div>

          {rangeError && (
            <div className="text-[10px] text-rose-500 font-medium leading-tight">
              {rangeError}
            </div>
          )}

          <button
            type="button"
            onClick={handleLoadData}
            disabled={!hasAvailableData || isPreloading || modelLoading || !!rangeError}
            className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 ${
              !hasAvailableData || isPreloading || modelLoading || !!rangeError
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-[#0284c7] hover:bg-[#0369a1] text-white cursor-pointer active:scale-[0.98] shadow-sky-500/20"
            }`}
            title={
              !hasAvailableData
                ? "No model dates available"
                : rangeError
                ? rangeError
                : "Load selected date range frames"
            }
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>LOAD DATA</span>
          </button>
        </div>

        {/* 4. TIME */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                TIME
              </label>
              {(modelLoading || isPreloading) && (
                <span className="text-[10px] font-mono text-sky-600 flex items-center gap-1 font-semibold">
                  <LoadingSpinner size="xs" color="#0284c7" label={isPreloading ? "Loading range data" : "Updating time step"} />
                  {isPreloading && (
                    <span className="hidden sm:inline">
                      {preloadProgress && preloadProgress.total > 0
                        ? `Loading (${preloadProgress.loaded}/${preloadProgress.total})…`
                        : "Loading…"}
                    </span>
                  )}
                </span>
              )}
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-50 border border-sky-200 text-[#0284c7]">
              {getDateStr(state.timeStepIndex)}
            </span>
          </div>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            value={sliderValue}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none mt-1"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>
              {hasActiveDates && activeDates
                ? formatDisplayDate(dateStringToTimeStepIndex(activeDates[0]))
                : effectiveMinDate
                ? formatDisplayDate(dateStringToTimeStepIndex(effectiveMinDate))
                : "01 Jan 2026"}
            </span>
            <span>
              {hasActiveDates && activeDates
                ? formatDisplayDate(dateStringToTimeStepIndex(activeDates[activeDates.length - 1]))
                : effectiveMaxDate
                ? formatDisplayDate(dateStringToTimeStepIndex(effectiveMaxDate))
                : "31 Mar 2026"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-normal">
            Select a date to inspect that model frame
          </div>
        </div>

        {/* 5. PLAYBACK */}
        <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
              PLAYBACK
            </span>
            <span className="text-[11px] font-mono font-bold text-[#0284c7] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
              {activeCurrentFrame} / {activeTotalFrames} days
            </span>
          </div>

          {/* Centered Playback Row: [ ◀ Previous ] [ ▶ PLAY / ❚❚ PAUSE / ↻ REPLAY ] [ Next ▶ ] */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={!isReady}
              onClick={handlePrev}
              className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs ${
                !isReady
                  ? "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 cursor-pointer active:scale-[0.98]"
              }`}
              title="Previous Day"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
              <span>Prev</span>
            </button>

            <button
              type="button"
              disabled={!isReady}
              onClick={handleTogglePlay}
              className={`flex-[1.4] py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98] ${
                !isReady
                  ? "bg-slate-300 text-slate-400 cursor-not-allowed shadow-none"
                  : isAtEnd
                  ? "bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sky-500/25 cursor-pointer ring-2 ring-sky-400/30"
                  : activeIsPlaying
                  ? "bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sky-500/25 cursor-pointer"
                  : "bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sky-500/25 cursor-pointer"
              }`}
              title={
                !isReady
                  ? "Preparing ocean dataset..."
                  : activeIsPlaying
                  ? "Pause Timeline Playback"
                  : isAtEnd
                  ? "Replay from First Frame"
                  : "Start Timeline Playback"
              }
            >
              {activeIsPlaying ? (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>PAUSE</span>
                </>
              ) : isAtEnd ? (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>REPLAY</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  <span>PLAY</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!isReady}
              onClick={handleNext}
              className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs ${
                !isReady
                  ? "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 cursor-pointer active:scale-[0.98]"
              }`}
              title="Next Day"
            >
              <span>Next</span>
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
              </svg>
            </button>
          </div>

          {/* Speed Controls: Segmented [ 1× ] [ 2× ] [ 4× ] */}
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                SPEED
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeSpeed}× playback
              </span>
            </div>
            <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {[1, 2, 4].map((s) => {
                const isSelected = activeSpeed === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSpeed(s)}
                    className={`py-1 text-xs font-mono font-bold rounded-md transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? "bg-[#0284c7] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    }`}
                    title={`Set playback speed to ${s}×`}
                  >
                    {s}×
                  </button>
                )
              })}
            </div>
          </div>

          {/* First-time user guidance */}
          <div className="text-[10px] text-slate-400 text-center leading-tight pt-0.5">
            Plays each available day once • Replay to start again
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
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900 flex items-center gap-1.5">
              <span>Depth Slices</span>
              {modelLoading && state.showDepthSlices && (
                <LoadingSpinner size="xs" color="#0284c7" label="Loading 3D Depth Slices" />
              )}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.show3DVolume}
              onChange={(e) => onChange((prev) => ({ ...prev, show3DVolume: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900 flex items-center gap-1.5">
              <span>3D Volume</span>
              {modelLoading && state.show3DVolume && (
                <LoadingSpinner size="xs" color="#0284c7" label="Loading 3D Volume" />
              )}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.showIsosurfaces}
              onChange={(e) => onChange((prev) => ({ ...prev, showIsosurfaces: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900 flex items-center gap-1.5">
              <span>Isosurfaces</span>
              {modelLoading && state.showIsosurfaces && (
                <LoadingSpinner size="xs" color="#0284c7" label="Loading Isosurfaces" />
              )}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={state.showCurrentVectors}
              onChange={(e) => onChange((prev) => ({ ...prev, showCurrentVectors: e.target.checked }))}
              className="w-4 h-4 rounded text-[#0284c7] border-slate-300 focus:ring-sky-400/30 cursor-pointer"
            />
            <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900 flex items-center gap-1.5">
              <span>Current Vectors</span>
              {modelLoading && state.showCurrentVectors && (
                <LoadingSpinner size="xs" color="#0284c7" label="Loading Current Vectors" />
              )}
            </span>
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
