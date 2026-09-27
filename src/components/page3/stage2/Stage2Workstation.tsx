"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useOcean } from "@/lib/store"
import { GeographicBounds } from "../globe/RegionSelectionBox"
import ModelControlPanel, { ModelControlState } from "./ModelControlPanel"
import Region3DViewport from "./Region3DViewport"
import RegionInformationPanel from "./RegionInformationPanel"
import ObservationDetailModal from "../ObservationDetailModal"
import Manual from "@/ui/Manual"
import { fetchObservations, ObservationItem } from "@/lib/observationsApi"
import {
  fetchModelFieldStack,
  fetchModelTimes,
  timeStepIndexToDateString,
  dateStringToTimeStepIndex,
  getMonthDates,
  ModelFieldResponse,
} from "@/lib/modelApi"

interface Stage2WorkstationProps {
  selectedRegion: GeographicBounds | null
  onBackToGlobal: () => void
  onOpenManual?: () => void
}

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
}

// 7 Representative valid model depth levels spanning the water column
const TARGET_DEPTH_LEVELS = [0, 25, 50, 100, 250, 500, 1000]

export default function Stage2Workstation({
  selectedRegion,
  onBackToGlobal,
  onOpenManual,
}: Stage2WorkstationProps) {
  const theme = useOcean((s) => s.theme)
  const setTheme = useOcean((s) => s.setTheme)

  const [modelState, setModelState] = useState<ModelControlState>({
    variable: "temperature",
    depth: 250,
    timeStepIndex: 45, // ~15 Feb 2026
    showDepthSlices: true,
    show3DVolume: false,
    showIsosurfaces: false,
    showCurrentVectors: true,
    vectorDensity: 60,
    verticalExaggeration: 7,
    colorScale: "turbo",
  })

  // Navigation Modals
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)

  // Real Regional Observations State
  const [observations, setObservations] = useState<ObservationItem[]>([])
  const [regionalCounts, setRegionalCounts] = useState<Record<string, number>>({
    argo: 0,
    glider: 0,
    ctd: 0,
    bgc: 0,
  })
  const [obsLoading, setObsLoading] = useState<boolean>(true)
  const [obsError, setObsError] = useState<string | null>(null)
  const [selectedObs, setSelectedObs] = useState<ObservationItem | null>(null)

  // ─── Monthly Dataset & 3D Depth-Resolved Model Fields State ───
  const [depthStack, setDepthStack] = useState<ModelFieldResponse[]>([])
  const [uDepthStack, setUDepthStack] = useState<ModelFieldResponse[]>([])
  const [vDepthStack, setVDepthStack] = useState<ModelFieldResponse[]>([])
  const [modelLoading, setModelLoading] = useState<boolean>(false)
  const [modelError, setModelError] = useState<string | null>(null)

  // Preloading & Playback State Machine
  const [monthlyDataReady, setMonthlyDataReady] = useState<boolean>(false)
  const [isPreloading, setIsPreloading] = useState<boolean>(false)
  const [preloadProgress, setPreloadProgress] = useState<{
    loaded: number
    total: number
    currentDate: string
  } | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [speed, setSpeed] = useState<number>(1)
  const [retryCount, setRetryCount] = useState<number>(0)

  const [is3DMaximized, setIs3DMaximized] = useState<boolean>(false)
  const [manualOpen, setManualOpen] = useState<boolean>(false)

  // In-memory Multi-Month Cache: key -> { frames: Map<dateStr, PreloadedFrameData>, dates: string[] }
  type PreloadedFrameData = {
    depthStack: ModelFieldResponse[]
    uDepthStack?: ModelFieldResponse[]
    vDepthStack?: ModelFieldResponse[]
  }
  const monthlyCacheRef = useRef<Map<string, { frames: Map<string, PreloadedFrameData>; dates: string[] }>>(new Map())
  const activeFramesMapRef = useRef<Map<string, PreloadedFrameData>>(new Map())
  const activeDatesRef = useRef<string[]>([])
  const playbackIndexRef = useRef<number>(0)

  // Race-condition guards and abort controllers
  const monthPreloadAbortRef = useRef<AbortController | null>(null)
  const monthPreloadReqIdRef = useRef<number>(0)
  const obsAbortRef = useRef<AbortController | null>(null)

  // Convert timeline index (0..89) to date string (2026-01-01 to 2026-03-31) in UTC
  const getDateStr = useCallback((idx: number) => {
    return timeStepIndexToDateString(idx)
  }, [])

  const timeStepIndexRef = useRef(modelState.timeStepIndex)
  timeStepIndexRef.current = modelState.timeStepIndex

  // Active month prefix derived strictly from UTC timeStepIndex (e.g. "2026-02")
  const currentDateStr = timeStepIndexToDateString(modelState.timeStepIndex)
  const activeMonthKey = currentDateStr.slice(0, 7)

  // 1. Fetch real in-situ observations filtered strictly by the selected ROI
  useEffect(() => {
    let isMounted = true
    if (!selectedRegion) {
      setObsLoading(false)
      return
    }

    if (obsAbortRef.current) {
      obsAbortRef.current.abort()
    }
    const abortController = new AbortController()
    obsAbortRef.current = abortController

    const latMin = Math.min(selectedRegion.latMin, selectedRegion.latMax)
    const latMax = Math.max(selectedRegion.latMin, selectedRegion.latMax)
    const lonMin = Math.min(selectedRegion.lonMin, selectedRegion.lonMax)
    const lonMax = Math.max(selectedRegion.lonMin, selectedRegion.lonMax)

    setObsLoading(true)
    setObsError(null)

    fetchObservations({
      lat_min: latMin,
      lat_max: latMax,
      lon_min: lonMin,
      lon_max: lonMax,
      limit: 2500,
      signal: abortController.signal,
    })
      .then((res) => {
        if (!isMounted) return
        const items = res.items || []
        setObservations(items)

        // Compute actual counts for the regional subset
        const counts: Record<string, number> = { argo: 0, glider: 0, ctd: 0, bgc: 0 }
        for (const item of items) {
          if (counts[item.type] !== undefined) {
            counts[item.type]++
          }
        }
        setRegionalCounts(counts)
        setObsLoading(false)
        setObsError(null)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        if (!isMounted) return
        console.warn("Regional observation fetch error:", err)
        setObsLoading(false)
        setObsError("Could not retrieve regional observations")
      })

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [selectedRegion])

  // 2. Preload complete 1-month dataset whenever Region, Variable, or Month changes
  useEffect(() => {
    let isMounted = true
    if (!selectedRegion) {
      setIsPreloading(false)
      setMonthlyDataReady(false)
      return
    }

    // Stop active playback immediately when loading new data
    setIsPlaying(false)

    if (monthPreloadAbortRef.current) {
      monthPreloadAbortRef.current.abort()
    }
    const abortController = new AbortController()
    monthPreloadAbortRef.current = abortController
    const currentReqId = ++monthPreloadReqIdRef.current

    const latMin = Math.min(selectedRegion.latMin, selectedRegion.latMax)
    const latMax = Math.max(selectedRegion.latMin, selectedRegion.latMax)
    const lonMin = Math.min(selectedRegion.lonMin, selectedRegion.lonMax)
    const lonMax = Math.max(selectedRegion.lonMin, selectedRegion.lonMax)
    const span = Math.max(latMax - latMin, lonMax - lonMin)
    const stride = span > 20 ? 3 : span > 10 ? 2 : 1

    const varName =
      modelState.variable === "salinity"
        ? "salinity"
        : modelState.variable === "chlorophyll"
        ? "chlorophyll"
        : modelState.variable === "currents"
        ? "currents"
        : "temperature"
    const isCurrents = varName === "currents"

    const cacheKey = `${latMin.toFixed(2)}_${latMax.toFixed(2)}_${lonMin.toFixed(2)}_${lonMax.toFixed(2)}_${stride}_${varName}_${activeMonthKey}`

    // ── Fast path: Entire month is already loaded in memory ──
    if (monthlyCacheRef.current.has(cacheKey)) {
      const cached = monthlyCacheRef.current.get(cacheKey)!
      activeFramesMapRef.current = cached.frames
      activeDatesRef.current = cached.dates

      const reqDateStr = timeStepIndexToDateString(timeStepIndexRef.current)
      const targetDate = cached.dates.includes(reqDateStr) ? reqDateStr : cached.dates[0]
      playbackIndexRef.current = cached.dates.indexOf(targetDate)
      const frame = cached.frames.get(targetDate)
      if (frame) {
        setDepthStack(frame.depthStack)
        setUDepthStack(frame.uDepthStack || [])
        setVDepthStack(frame.vDepthStack || [])
        const frameIdx = dateStringToTimeStepIndex(targetDate)
        if (frameIdx !== timeStepIndexRef.current) {
          setModelState((prev) => ({ ...prev, timeStepIndex: frameIdx }))
        }
      }

      setIsPreloading(false)
      setPreloadProgress(null)
      setModelLoading(false)
      setModelError(null)
      setMonthlyDataReady(true)
      return
    }

    // ── Slow path: Clear stale data and preload the complete required 1-month dataset ──
    setDepthStack([])
    setUDepthStack([])
    setVDepthStack([])
    setIsPreloading(true)
    setMonthlyDataReady(false)
    setModelLoading(true)
    setModelError(null)
    setPreloadProgress(null)

    async function loadMonth() {
      try {
        const allTimes = await fetchModelTimes(abortController.signal)
        if (!isMounted || currentReqId !== monthPreloadReqIdRef.current) return

        let targetDates = allTimes.filter((t) => t.startsWith(activeMonthKey))
        if (targetDates.length === 0) {
          const [y, m] = activeMonthKey.split("-").map(Number)
          targetDates = getMonthDates(y, m)
        }
        targetDates.sort()

        const framesMap = new Map<string, PreloadedFrameData>()

        for (let i = 0; i < targetDates.length; i++) {
          if (!isMounted || currentReqId !== monthPreloadReqIdRef.current) return
          const dStr = targetDates[i]

          setPreloadProgress({
            loaded: i + 1,
            total: targetDates.length,
            currentDate: dStr,
          })

          if (isCurrents) {
            const { uSlices, vSlices } = await fetchModelFieldStack({
              variable: "currents",
              time: dStr,
              depths: TARGET_DEPTH_LEVELS,
              lat_min: latMin,
              lat_max: latMax,
              lon_min: lonMin,
              lon_max: lonMax,
              stride,
              signal: abortController.signal,
            })
            framesMap.set(dStr, {
              depthStack: [],
              uDepthStack: uSlices || [],
              vDepthStack: vSlices || [],
            })
          } else {
            const { slices } = await fetchModelFieldStack({
              variable: varName,
              time: dStr,
              depths: TARGET_DEPTH_LEVELS,
              lat_min: latMin,
              lat_max: latMax,
              lon_min: lonMin,
              lon_max: lonMax,
              stride,
              signal: abortController.signal,
            })
            framesMap.set(dStr, {
              depthStack: slices || [],
              uDepthStack: [],
              vDepthStack: [],
            })
          }

          // Render the target or first loaded frame in the background immediately
          const reqDateStr = timeStepIndexToDateString(timeStepIndexRef.current)
          if (dStr === reqDateStr || (i === 0 && !framesMap.has(reqDateStr))) {
            const initialFrame = framesMap.get(dStr)!
            setDepthStack(initialFrame.depthStack)
            setUDepthStack(initialFrame.uDepthStack || [])
            setVDepthStack(initialFrame.vDepthStack || [])
          }
        }

        if (!isMounted || currentReqId !== monthPreloadReqIdRef.current) return

        // Verify dataset availability and cache
        monthlyCacheRef.current.set(cacheKey, { frames: framesMap, dates: targetDates })
        activeFramesMapRef.current = framesMap
        activeDatesRef.current = targetDates

        const finalReqDate = timeStepIndexToDateString(timeStepIndexRef.current)
        const finalActiveDate = targetDates.includes(finalReqDate) ? finalReqDate : targetDates[0]
        playbackIndexRef.current = targetDates.indexOf(finalActiveDate)
        const activeFrame = framesMap.get(finalActiveDate)
        if (activeFrame) {
          setDepthStack(activeFrame.depthStack)
          setUDepthStack(activeFrame.uDepthStack || [])
          setVDepthStack(activeFrame.vDepthStack || [])
          const finalIdx = dateStringToTimeStepIndex(finalActiveDate)
          if (finalIdx !== timeStepIndexRef.current) {
            setModelState((prev) => ({ ...prev, timeStepIndex: finalIdx }))
          }
        }

        setIsPreloading(false)
        setPreloadProgress(null)
        setModelLoading(false)
        setModelError(null)
        setMonthlyDataReady(true)
      } catch (err: any) {
        if (err?.name === "AbortError") return
        if (!isMounted || currentReqId !== monthPreloadReqIdRef.current) return
        console.error("Monthly dataset preload error:", err)
        setIsPreloading(false)
        setPreloadProgress(null)
        setModelLoading(false)
        setMonthlyDataReady(false)
        setModelError("Unable to load ocean data")
      }
    }

    loadMonth()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [selectedRegion, modelState.variable, activeMonthKey, retryCount])

  // Playback timer: cycles through preloaded month frames strictly one frame at a time in chronological order
  useEffect(() => {
    if (!isPlaying || !monthlyDataReady) return
    const dates = activeDatesRef.current
    if (!dates || dates.length <= 1) return

    // Single source of truth: align playback pointer with current selected date in preloaded list
    const curDateStr = timeStepIndexToDateString(modelState.timeStepIndex)
    let startIndex = dates.indexOf(curDateStr)
    if (startIndex === -1) {
      let minDiff = Infinity
      startIndex = 0
      const curTime = new Date(curDateStr).getTime()
      for (let i = 0; i < dates.length; i++) {
        const diff = Math.abs(new Date(dates[i]).getTime() - curTime)
        if (diff < minDiff) {
          minDiff = diff
          startIndex = i
        }
      }
    }
    playbackIndexRef.current = startIndex

    const intervalMs = Math.max(350, Math.round(1000 / speed))
    const timer = setInterval(() => {
      const datesList = activeDatesRef.current
      if (!datesList || datesList.length <= 1) return

      // Advance strictly one frame at a time: current frame → next available frame
      const nextIdx = (playbackIndexRef.current + 1) % datesList.length
      playbackIndexRef.current = nextIdx
      const nextDate = datesList[nextIdx]

      const frame = activeFramesMapRef.current.get(nextDate)
      if (frame) {
        setDepthStack(frame.depthStack)
        setUDepthStack(frame.uDepthStack || [])
        setVDepthStack(frame.vDepthStack || [])
        setModelState((prev) => ({
          ...prev,
          timeStepIndex: dateStringToTimeStepIndex(nextDate),
        }))
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isPlaying, monthlyDataReady, speed])

  // Scrubbing/Timeline manual slider updates within loaded month
  useEffect(() => {
    if (isPlaying || isPreloading || !monthlyDataReady) return
    const curDateStr = timeStepIndexToDateString(modelState.timeStepIndex)
    const dates = activeDatesRef.current
    if (dates && dates.length > 0) {
      const idx = dates.indexOf(curDateStr)
      if (idx !== -1) {
        playbackIndexRef.current = idx
      }
    }
    const frame = activeFramesMapRef.current.get(curDateStr)
    if (frame) {
      setDepthStack(frame.depthStack)
      setUDepthStack(frame.uDepthStack || [])
      setVDepthStack(frame.vDepthStack || [])
    }
  }, [modelState.timeStepIndex, isPlaying, isPreloading, monthlyDataReady])

  const handlePrevDay = useCallback(() => {
    if (isPreloading || !monthlyDataReady) return
    const dates = activeDatesRef.current
    if (!dates || dates.length === 0) return
    const curDateStr = timeStepIndexToDateString(modelState.timeStepIndex)
    let curIdx = dates.indexOf(curDateStr)
    if (curIdx === -1) curIdx = playbackIndexRef.current
    const prevIdx = (curIdx - 1 + dates.length) % dates.length
    playbackIndexRef.current = prevIdx
    const prevDate = dates[prevIdx]
    const frame = activeFramesMapRef.current.get(prevDate)
    if (frame) {
      setDepthStack(frame.depthStack)
      setUDepthStack(frame.uDepthStack || [])
      setVDepthStack(frame.vDepthStack || [])
      setModelState((prev) => ({
        ...prev,
        timeStepIndex: dateStringToTimeStepIndex(prevDate),
      }))
    }
  }, [isPreloading, monthlyDataReady, modelState.timeStepIndex])

  const handleNextDay = useCallback(() => {
    if (isPreloading || !monthlyDataReady) return
    const dates = activeDatesRef.current
    if (!dates || dates.length === 0) return
    const curDateStr = timeStepIndexToDateString(modelState.timeStepIndex)
    let curIdx = dates.indexOf(curDateStr)
    if (curIdx === -1) curIdx = playbackIndexRef.current
    const nextIdx = (curIdx + 1) % dates.length
    playbackIndexRef.current = nextIdx
    const nextDate = dates[nextIdx]
    const frame = activeFramesMapRef.current.get(nextDate)
    if (frame) {
      setDepthStack(frame.depthStack)
      setUDepthStack(frame.uDepthStack || [])
      setVDepthStack(frame.vDepthStack || [])
      setModelState((prev) => ({
        ...prev,
        timeStepIndex: dateStringToTimeStepIndex(nextDate),
      }))
    }
  }, [isPreloading, monthlyDataReady, modelState.timeStepIndex])

  // Get single primary slice matching the selected depth for the right panel metadata
  const activePrimarySlice = depthStack.find((s) => s.depth && Math.abs(s.depth - modelState.depth) < 100) || depthStack[0] || null
  const activeUSlice = uDepthStack.find((s) => s.depth && Math.abs(s.depth - modelState.depth) < 100) || uDepthStack[0] || null
  const activeVSlice = vDepthStack.find((s) => s.depth && Math.abs(s.depth - modelState.depth) < 100) || vDepthStack[0] || null

  const navModals: Record<string, InfoModalData> = {
    observations: {
      title: "In-situ Ocean Observations",
      subtitle: "Real-time and archived observational platforms across the Indian Ocean basin.",
      icon: "📡",
      sections: [
        {
          heading: "Autonomous Argo Floats (22,000+ Profiles)",
          body: "Autonomous profilers descending to 2000m depth every 10 days, delivering CTD and bio-geochemical profiles.",
        },
        {
          heading: "Gliders, CTD & BGC Platforms",
          body: "High-resolution spatial cross-sections along critical maritime corridors and EEZ boundaries.",
        },
      ],
    },
    dataServices: {
      title: "Scientific Data Services & APIs",
      subtitle: "Enterprise oceanographic data distribution and high-throughput analytical query endpoints.",
      icon: "🌐",
      sections: [
        {
          heading: "Copernicus Marine Service Integration",
          body: "Native ingestion of 3D physical ocean variables (thetao, so, uo, vo) and bio-geochemical indicators (chl).",
        },
        {
          heading: "WOD & In-situ Archival Feeds",
          body: "Unified query layer connecting NOAA/NCEI World Ocean Database repositories with INCOIS repositories.",
        },
      ],
    },
    operationalApps: {
      title: "Operational Oceanographic Applications",
      subtitle: "Mission-critical decision support tools for maritime safety and disaster risk reduction.",
      icon: "⚙️",
      sections: [
        {
          heading: "Maritime Security & Search and Rescue (SAR)",
          body: "High-resolution 3D drift and current velocity analysis for emergency rescue operations.",
        },
        {
          heading: "Cyclone Heat Potential & Marine Heatwaves",
          body: "Sub-surface thermal structure tracking to predict cyclone intensification dynamics.",
        },
      ],
    },
    resources: {
      title: "Technical Resources & Documentation",
      subtitle: "Comprehensive scientific documentation, user manuals, and system architectural specifications.",
      icon: "📚",
      sections: [
        {
          heading: "Standard Operating Procedures (SOP)",
          body: "Guidelines for observational data validation, quality control flags, and numerical model interpolation.",
        },
        {
          heading: "Sagar Netra Architecture Guide",
          body: "Complete documentation for WebGL 3D volumetric rendering, shaders, and binary field cache protocols.",
        },
      ],
    },
  }

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between overflow-hidden select-none bg-[#f0f6fc] text-slate-900 font-sans">
      
      {/* ─── Observation Detail Modal / Inspector ─── */}
      <ObservationDetailModal
        observation={selectedObs}
        onClose={() => setSelectedObs(null)}
      />

      {/* ─── User Manual Modal Dialog ─── */}
      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />

      {/* ─── Header Info Modal ─── */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setInfoModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{infoModal.icon}</span>
              <div>
                <h3 className="text-base font-bold text-slate-900">{infoModal.title}</h3>
                <p className="text-xs text-slate-500">{infoModal.subtitle}</p>
              </div>
            </div>
            <div className="space-y-4 my-4 border-t border-b border-slate-100 py-4 max-h-[60vh] overflow-y-auto">
              {infoModal.sections.map((sec, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                  <h4 className="text-xs font-bold text-[#0284c7] mb-1">{sec.heading}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{sec.body}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          1. TOP INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
        
        {/* Row 1: Institutional Badges, Tagline, Search, User */}
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            
            {/* Left: MoES Emblem & INCOIS Logo */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <Link href="/" className="flex items-center cursor-pointer">
                <Image
                  src="/landing/header-emblem-moes.png"
                  alt="Ministry of Earth Sciences, Government of India"
                  width={220}
                  height={64}
                  priority
                  unoptimized
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto max-w-[120px] sm:max-w-none object-contain"
                />
              </Link>

              {/* Vertical divider */}
              <div className="h-8 w-[1px] bg-slate-200" />

              <Link href="/" className="flex items-center cursor-pointer">
                <Image
                  src="/landing/header-incois.png"
                  alt="INCOIS - Indian National Centre for Ocean Information Services"
                  width={340}
                  height={64}
                  priority
                  unoptimized
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto max-w-[120px] sm:max-w-none object-contain"
                />
              </Link>
            </div>

            {/* Right: National Tagline + Tricolor Swirl Ribbon */}
            <div className="hidden md:flex items-center justify-end flex-1 min-w-0">
              <Image
                src="/landing/header-tagline-swirl.png"
                alt="Oceans for a Safer, Sustainable and Prosperous India"
                width={400}
                height={70}
                priority
                unoptimized
                className="h-[48px] sm:h-[52px] w-auto object-contain"
              />
            </div>

          </div>
        </div>

        {/* Row 2: Institutional Navbar with EXPLORER ACTIVE */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <div className="flex items-center h-[38px] sm:h-[40px]">
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5 w-full">
                {/* Home */}
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span>Home</span>
                </Link>

                {/* Study Region */}
                <Link
                  href="/study-region"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Study Region</span>
                </Link>

                {/* Explorer (ACTIVE) */}
                <button
                  type="button"
                  onClick={onBackToGlobal}
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                    <path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  <span>Explorer</span>
                  {/* Blue Active Indicator Bar */}
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </button>

                {/* Observations */}
                <Link
                  href="/observations"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8M17 7h4v4" />
                  </svg>
                  <span>Observations</span>
                </Link>

                {/* Data Services */}
                <Link
                  href="/data-services"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
                    <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  <span>Data Services</span>
                </Link>

                {/* Operational Applications */}
                <Link
                  href="/operational-applications"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                  </svg>
                  <span>Operational Applications</span>
                </Link>

                {/* Resources */}
                <button
                  type="button"
                  onClick={() => setInfoModal(navModals.resources)}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Resources</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────
          2. BREADCRUMB ROW
      ──────────────────────────────────────────────────────────── */}
      <div className="w-full bg-transparent px-4 sm:px-6 lg:px-8 py-1.5 shrink-0">
        <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-1.5 text-xs">
            <Link href="/" className="hover:text-[#0284c7] transition flex items-center gap-1 text-slate-600">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </Link>
            <span className="text-slate-400">›</span>
            <button onClick={onBackToGlobal} className="hover:text-[#0284c7] transition text-slate-600">
              Explorer
            </button>
            <span className="text-slate-400">›</span>
            <button onClick={onBackToGlobal} className="hover:text-[#0284c7] transition text-slate-600">
              Indian Ocean
            </button>
            <span className="text-slate-400">›</span>
            <span className="text-[#0284c7] font-semibold">3D Depth View</span>
          </div>

          <button
            onClick={onBackToGlobal}
            className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition shadow-xs cursor-pointer"
          >
            <span>←</span>
            <span>Back to Global View</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          3. MAIN 3-COLUMN WORKSPACE: 21% LEFT | 54% CENTER | 25% RIGHT
      ──────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 w-full w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-2 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-3">
        
        {/* ─── LEFT COLUMN: Model Controls & Visualization Options ─── */}
        {!is3DMaximized && (
          <section className="w-full lg:w-[22%] h-full flex flex-col shrink-0 overflow-y-auto pr-0 lg:pr-1 no-scrollbar">
            <ModelControlPanel
              state={modelState}
              onChange={setModelState}
              modelLoading={modelLoading}
              isReady={monthlyDataReady}
              isPreloading={isPreloading}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              speed={speed}
              onSpeedChange={setSpeed}
              preloadProgress={preloadProgress}
            />
          </section>
        )}

        {/* ─── CENTER COLUMN: Selected Region — 3D Depth-Resolved View ─── */}
        <section className={`w-full ${is3DMaximized ? "lg:w-full" : "lg:w-[53%]"} h-full flex flex-col overflow-hidden`}>
          <Region3DViewport
            selectedRegion={selectedRegion}
            modelState={modelState}
            depthStack={depthStack}
            uDepthStack={uDepthStack}
            vDepthStack={vDepthStack}
            modelLoading={modelLoading}
            modelError={modelError}
            observations={observations}
            obsLoading={obsLoading}
            obsError={obsError}
            selectedObsId={selectedObs?.id}
            onSelectObservation={setSelectedObs}
            isMaximized={is3DMaximized}
            onToggleMaximize={() => setIs3DMaximized((prev) => !prev)}
            isPreloading={isPreloading}
            monthlyDataReady={monthlyDataReady}
            preloadProgress={preloadProgress}
            onRetry={() => setRetryCount((c) => c + 1)}
          />
        </section>

        {/* ─── RIGHT COLUMN: Region Info, Model Data, Instruments & How To Use ─── */}
        {!is3DMaximized && (
          <section className="w-full lg:w-[25%] h-full flex flex-col shrink-0 overflow-y-auto pl-0 lg:pl-1 no-scrollbar">
            <RegionInformationPanel
              selectedRegion={selectedRegion}
              modelState={modelState}
              regionalCounts={regionalCounts}
              totalObservations={observations.length}
              scalarFieldData={activePrimarySlice}
              uFieldData={activeUSlice}
              vFieldData={activeVSlice}
              modelLoading={modelLoading || isPreloading}
              obsLoading={obsLoading}
            />
          </section>
        )}
      </main>

      {/* ────────────────────────────────────────────────────────────
          4. WORKSTATION INSTITUTIONAL FOOTER
      ──────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between shrink-0 text-[11px] text-slate-500 font-sans">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Data Sources:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 hover:text-slate-800 transition">
              <span className="text-[#0284c7] font-bold">●</span> Copernicus Marine Service (CMEMS)
            </span>
            <span className="flex items-center gap-1 hover:text-slate-800 transition">
              <span className="text-sky-500 font-bold">●</span> IFREMER
            </span>
            <span className="flex items-center gap-1 hover:text-slate-800 transition">
              <span className="text-blue-500 font-bold">●</span> NOAA
            </span>
            <span className="flex items-center gap-1 hover:text-slate-800 transition">
              <span className="text-indigo-500 font-bold">●</span> NCEI WOD
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Official Data Sources Configured</span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">
            Last Updated: 15 Feb 2026, 12:30 UTC
          </span>
        </div>
      </footer>
    </div>
  )
}
