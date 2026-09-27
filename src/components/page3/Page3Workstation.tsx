"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useOcean } from "@/lib/store"
import {
  DATA_LAYERS,
  DataLayerItem,
  TIME_CONFIG,
  DEPTH_CONFIG,
} from "./page3Config"
import DataLayerSelector from "./DataLayerSelector"
import ObservationCounts from "./ObservationCounts"
import ColorbarCard from "./ColorbarCard"
import DescriptionCard from "./DescriptionCard"
import HowToUseCard from "./HowToUseCard"
import InstrumentLegend from "./InstrumentLegend"
import DepthSlider from "./DepthSlider"
import TimeSlider from "./TimeSlider"
import Page3CenterViewport from "./Page3CenterViewport"
import { GeographicBounds } from "./globe/RegionSelectionBox"
import Stage2Workstation from "./stage2/Stage2Workstation"
import { fetchObservations, ObservationItem } from "@/lib/observationsApi"
import { fetchModelField, ModelFieldResponse } from "@/lib/modelApi"

interface Page3WorkstationProps {
  onReturnToStudyRegion?: () => void
  onOpenManual?: () => void
}

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
}

export default function Page3Workstation({
  onReturnToStudyRegion,
  onOpenManual,
}: Page3WorkstationProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useOcean((s) => s.theme)
  const setTheme = useOcean((s) => s.setTheme)

  // Stage Switcher: Stage 1 (Global Overview) | Stage 2 (Region Selected 3D Model View)
  const [stage, setStage] = useState<1 | 2>(1)
  const [selectedRegion, setSelectedRegion] = useState<GeographicBounds | null>({
    latMin: -18.0,
    latMax: -5.0,
    lonMin: 65.0,
    lonMax: 85.0,
  })

  // Navigation Modals
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)

  // Real In-Situ Observations State
  const [observations, setObservations] = useState<ObservationItem[]>([])
  const [obsCounts, setObsCounts] = useState<Record<string, number>>({
    argo: 22231,
    glider: 2591,
    ctd: 619,
    bgc: 2257,
  })
  const [obsVisibility, setObsVisibility] = useState<Record<string, boolean>>({
    argo: true,
    glider: true,
    ctd: true,
    bgc: true,
  })
  const [obsLoading, setObsLoading] = useState<boolean>(true)
  const [obsLoadingTypes, setObsLoadingTypes] = useState<Record<string, boolean>>({
    argo: true,
    glider: true,
    ctd: true,
    bgc: true,
  })
  const [obsError, setObsError] = useState<string | null>(null)
  const [selectedObservation, setSelectedObservation] = useState<ObservationItem | null>(null)

  // Real Scientific Model Layers State (Defaults to Temperature)
  const [activeLayer, setActiveLayer] = useState<DataLayerItem | null>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const varParam = urlParams.get("var")?.toLowerCase()
      if (varParam === "none" || varParam === "base") return null
      if (varParam) {
        const found = DATA_LAYERS.find(
          (l) =>
            l.id === varParam ||
            (varParam === "temp" && l.id === "temperature") ||
            (varParam === "sal" && l.id === "salinity") ||
            (varParam === "chl" && l.id === "chlorophyll") ||
            (varParam === "velocity" && l.id === "currents")
        )
        if (found) return found
      }
    }
    return DATA_LAYERS[0]
  })

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    temperature: true,
    salinity: true,
    currents: true,
    chlorophyll: true,
  })
  const [depth, setDepth] = useState<number>(DEPTH_CONFIG.initial)
  const [selectedDate, setSelectedDate] = useState<string>("2026-02-15")
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(TIME_CONFIG.initialStepIndex)
  const [vectorDensity, setVectorDensity] = useState<"low" | "medium" | "high">("medium")
  const [showEEZ, setShowEEZ] = useState<boolean>(true)

  // Loading States Architecture
  const [modelLoading, setModelLoading] = useState<boolean>(true)
  const [loadingVariableId, setLoadingVariableId] = useState<string | null>(null)
  const [isInitialModelLoad, setIsInitialModelLoad] = useState<boolean>(true)
  const isInitialModelLoadRef = useRef<boolean>(true)
  const [isDepthUpdating, setIsDepthUpdating] = useState<boolean>(false)
  const [isTimeUpdating, setIsTimeUpdating] = useState<boolean>(false)
  const [modelError, setModelError] = useState<string | null>(null)

  // Fetched Model Data Slices
  const [scalarFieldData, setScalarFieldData] = useState<ModelFieldResponse | null>(null)
  const [uFieldData, setUFieldData] = useState<ModelFieldResponse | null>(null)
  const [vFieldData, setVFieldData] = useState<ModelFieldResponse | null>(null)

  // Race condition & in-flight request management
  const modelAbortRef = useRef<AbortController | null>(null)
  const modelReqIdRef = useRef<number>(0)
  const obsAbortRef = useRef<AbortController | null>(null)
  const prevDepthRef = useRef<number>(DEPTH_CONFIG.initial)
  const prevDateRef = useRef<string>("2026-02-15")
  const prevLayerIdRef = useRef<string | null>("temperature")

  // Auto-select layer from search params (?var=temperature | salinity | currents | chlorophyll | thetao | so | uo | vo | chl)
  useEffect(() => {
    if (!searchParams) return
    const varParam = searchParams.get("var")
    if (varParam) {
      const normalized = varParam.toLowerCase()
      let targetId: "temperature" | "salinity" | "currents" | "chlorophyll" | null = null
      if (normalized === "temperature" || normalized === "thetao" || normalized === "temp") targetId = "temperature"
      else if (normalized === "salinity" || normalized === "so" || normalized === "sal") targetId = "salinity"
      else if (normalized === "currents" || normalized === "velocity" || normalized === "uo" || normalized === "vo" || normalized === "current") targetId = "currents"
      else if (normalized === "chlorophyll" || normalized === "chl" || normalized === "bgc") targetId = "chlorophyll"
      else if (normalized === "none" || normalized === "base") targetId = null

      if (targetId) {
        const foundLayer = DATA_LAYERS.find((l) => l.id === targetId)
        if (foundLayer && foundLayer.id !== activeLayer?.id) {
          setModelLoading(true)
          setLoadingVariableId(foundLayer.id)
          setActiveLayer(foundLayer)
        }
      } else if (normalized === "none" || normalized === "base") {
        setActiveLayer(null)
      }
    }
  }, [searchParams])

  // Fetch real observation index from backend once on mount
  useEffect(() => {
    const abortController = new AbortController()
    obsAbortRef.current = abortController
    setObsLoading(true)
    setObsLoadingTypes({ argo: true, glider: true, ctd: true, bgc: true })
    setObsError(null)

    fetchObservations({ limit: 2500, signal: abortController.signal })
      .then((res) => {
        if (abortController.signal.aborted) return
        setObservations(res.items || [])
        if (res.counts_by_type && Object.keys(res.counts_by_type).length > 0) {
          setObsCounts(res.counts_by_type)
        }
        setObsLoading(false)
        setObsLoadingTypes({})
        setObsError(null)
      })
      .catch((err) => {
        if (abortController.signal.aborted || (err as any)?.name === "AbortError") return
        console.warn("Backend observation fetch notice:", err)
        setObsLoading(false)
        setObsLoadingTypes({})
        setObsError("Backend connection pending")
      })

    return () => {
      abortController.abort()
    }
  }, [])

  // Fetch real model field slice whenever activeLayer, depth, or selectedDate changes
  useEffect(() => {
    if (!activeLayer) {
      if (modelAbortRef.current) {
        modelAbortRef.current.abort()
      }
      setModelLoading(false)
      setLoadingVariableId(null)
      setIsInitialModelLoad(false)
      setIsDepthUpdating(false)
      setIsTimeUpdating(false)
      setScalarFieldData(null)
      setUFieldData(null)
      setVFieldData(null)
      setModelError(null)
      return
    }

    const layerChanged = prevLayerIdRef.current !== activeLayer.id
    const depthChanged = prevDepthRef.current !== depth
    const dateChanged = prevDateRef.current !== selectedDate

    prevLayerIdRef.current = activeLayer.id
    prevDepthRef.current = depth
    prevDateRef.current = selectedDate

    // Abort previous in-flight request to handle race conditions
    if (modelAbortRef.current) {
      modelAbortRef.current.abort()
    }
    const abortController = new AbortController()
    modelAbortRef.current = abortController
    const reqId = ++modelReqIdRef.current

    const isFirstLoad = isInitialModelLoadRef.current
    setModelLoading(true)
    setLoadingVariableId(isFirstLoad ? null : activeLayer.id)
    setIsDepthUpdating(depthChanged && !layerChanged && !isFirstLoad)
    setIsTimeUpdating(dateChanged && !layerChanged && !isFirstLoad)
    setModelError(null)

    if (activeLayer.id === "currents") {
      // Fetch both u_velocity and v_velocity
      Promise.all([
        fetchModelField({ variable: "u_velocity", time: selectedDate, depth, stride: 4, signal: abortController.signal }),
        fetchModelField({ variable: "v_velocity", time: selectedDate, depth, stride: 4, signal: abortController.signal }),
      ])
        .then(([uRes, vRes]) => {
          if (reqId !== modelReqIdRef.current || abortController.signal.aborted) return
          setUFieldData(uRes)
          setVFieldData(vRes)
          setScalarFieldData(null)
          setModelLoading(false)
          setLoadingVariableId(null)
          setIsInitialModelLoad(false)
          setIsDepthUpdating(false)
          setIsTimeUpdating(false)
          setModelError(null)
        })
        .catch((err) => {
          if (reqId !== modelReqIdRef.current || abortController.signal.aborted || (err as any)?.name === "AbortError") return
          console.warn("Currents model fetch error:", err)
          setModelLoading(false)
          setLoadingVariableId(null)
          setIsInitialModelLoad(false)
          setIsDepthUpdating(false)
          setIsTimeUpdating(false)
          setModelError("Currents model data unavailable")
        })
    } else {
      // Fetch scalar variable: temperature, salinity, or chlorophyll
      const varName = activeLayer.id === "temperature" ? "temperature" : activeLayer.id === "salinity" ? "salinity" : "chlorophyll"
      fetchModelField({ variable: varName, time: selectedDate, depth, stride: 4, signal: abortController.signal })
        .then((res) => {
          if (reqId !== modelReqIdRef.current || abortController.signal.aborted) return
          setScalarFieldData(res)
          setUFieldData(null)
          setVFieldData(null)
          setModelLoading(false)
          setLoadingVariableId(null)
          setIsInitialModelLoad(false)
          setIsDepthUpdating(false)
          setIsTimeUpdating(false)
          setModelError(null)
        })
        .catch((err) => {
          if (reqId !== modelReqIdRef.current || abortController.signal.aborted || (err as any)?.name === "AbortError") return
          console.warn(`${activeLayer.label} model fetch error:`, err)
          setModelLoading(false)
          setLoadingVariableId(null)
          setIsInitialModelLoad(false)
          setIsDepthUpdating(false)
          setIsTimeUpdating(false)
          setModelError(`${activeLayer.label} data unavailable`)
        })
    }

    return () => {
      abortController.abort()
    }
  }, [activeLayer, depth, selectedDate])

  const handleSelectLayer = useCallback((layer: DataLayerItem | null) => {
    isInitialModelLoadRef.current = false
    setIsInitialModelLoad(false)
    if (layer) {
      setModelLoading(true)
      setLoadingVariableId(layer.id)
      setModelError(null)
    } else {
      if (modelAbortRef.current) {
        modelAbortRef.current.abort()
      }
      setModelLoading(false)
      setLoadingVariableId(null)
      setIsDepthUpdating(false)
      setIsTimeUpdating(false)
      setScalarFieldData(null)
      setUFieldData(null)
      setVFieldData(null)
      setModelError(null)
    }
    setActiveLayer(layer)
  }, [])

  // Convert timeline index (0..89) to date string (2026-01-01 to 2026-03-31)
  const handleDateIndexChange = useCallback((idx: number) => {
    isInitialModelLoadRef.current = false
    setIsInitialModelLoad(false)
    setSelectedDateIndex(idx)
    const start = new Date(2026, 0, 1)
    start.setDate(start.getDate() + idx)
    const yyyy = start.getFullYear()
    const mm = String(start.getMonth() + 1).padStart(2, "0")
    const dd = String(start.getDate()).padStart(2, "0")
    setSelectedDate(`${yyyy}-${mm}-${dd}`)
  }, [])

  // Calculate human date string from step index
  const getCurrentDateStr = () => {
    const baseDate = new Date(Date.UTC(2026, 0, 1))
    baseDate.setUTCDate(baseDate.getUTCDate() + selectedDateIndex)
    const day = baseDate.getUTCDate().toString().padStart(2, "0")
    const month = baseDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    const year = baseDate.getUTCFullYear()
    return `${day} ${month} ${year}`
  }

  // Toggle observation marker type visibility
  const handleToggleObsType = (typeId: string) => {
    setObsVisibility((prev) => ({
      ...prev,
      [typeId]: prev[typeId] === false ? true : false,
    }))
  }

  // Toggle model layer visibility
  const handleToggleLayerVisibility = (layerId: string) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layerId]: prev[layerId] === false ? true : false,
    }))
  }

  // Handle region confirmation from modal
  const handleConfirmRegionExplore = (bounds: GeographicBounds) => {
    setSelectedRegion(bounds)
    setStage(2)
  }

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
      title: "Data Services & OGC Interoperability",
      subtitle: "Standardized geospatial ocean data feeds adhering to international ocean standards.",
      icon: "🗄️",
      sections: [
        {
          heading: "NetCDF-4 & CF-1.8 Compliance",
          body: "Fully compliant CF metadata conventions supporting multi-dimensional slicing across latitude, longitude, depth, and time coordinates.",
        },
        {
          heading: "Copernicus & WOD Integration",
          body: "Direct integration with CMEMS physics/biogeochemistry and NOAA NCEI World Ocean Database.",
        },
      ],
    },
    operationalApps: {
      title: "Operational Applications",
      subtitle: "Maritime decision support systems powered by real-time ocean intelligence.",
      icon: "⚙️",
      sections: [
        {
          heading: "Hazard Assessment & Cyclone Tracking",
          body: "Early coastal inundation risks and storm surge tracking across the Indian coastline.",
        },
        {
          heading: "Search & Rescue & Potential Fishing Zones",
          body: "Drift trajectory modeling and chlorophyll/thermal front analysis for marine operations.",
        },
      ],
    },
    resources: {
      title: "Documentation & Resources",
      subtitle: "User guides, scientific methodology, and Hackathon problem statement specifications.",
      icon: "📖",
      sections: [
        {
          heading: "SIH 2026 Problem Statement 26067",
          body: "3D Visualization of Ocean Model Data and in-situ Observations by INCOIS & Ministry of Earth Sciences.",
        },
        {
          heading: "User Manual & Guided Tour",
          body: "Interactive walkthroughs covering volume slicing, isosurfaces, current vector densities, and model-vs-observation comparisons.",
        },
      ],
    },
  }

  // If Stage 2 is active, render Stage2Workstation
  if (stage === 2 && selectedRegion) {
    return (
      <Stage2Workstation
        selectedRegion={selectedRegion}
        onBackToGlobal={() => setStage(1)}
        onOpenManual={onOpenManual}
      />
    )
  }

  return (
    <div className="relative w-full min-h-screen flex flex-col justify-between overflow-x-hidden select-none bg-[#f0f6fc] text-slate-900 font-sans">
      
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
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-default"
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
          2. APPROVED 3-COLUMN WORKSPACE: 24% LEFT | 52% CENTER | 24% RIGHT
      ──────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 w-full flex flex-col lg:flex-row gap-3 p-3 pb-6 overflow-y-auto lg:overflow-visible bg-[#f0f6fc]">
        {/* ─── LEFT 24% PANEL: Observation Counts & Controls ─── */}
        <aside className="w-full lg:w-[24%] flex flex-col gap-3 pr-0 lg:pr-1">
          <ObservationCounts
            counts={obsCounts}
            visibleTypes={obsVisibility}
            loadingTypes={obsLoadingTypes}
            obsLoading={obsLoading}
            obsError={obsError}
            onToggleType={handleToggleObsType}
          />

          <DataLayerSelector
            activeLayerId={activeLayer ? activeLayer.id : null}
            loadingLayerId={loadingVariableId}
            onSelectLayer={handleSelectLayer}
            layerVisibility={layerVisibility}
            onToggleVisibility={handleToggleLayerVisibility}
            showEEZ={showEEZ}
            onToggleEEZ={() => setShowEEZ((prev) => !prev)}
          />

          {/* Analysis Controls Card (Enclosing Depth & Time Sliders) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3 select-none flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[10.5px] font-bold tracking-[0.14em] text-slate-800 uppercase">
                  ANALYSIS CONTROLS
                </h3>
              </div>
              <DepthSlider
                depth={depth}
                onChangeDepth={setDepth}
                isUpdating={isDepthUpdating && modelLoading}
              />
            </div>
            <TimeSlider
              currentDateStr={getCurrentDateStr()}
              stepIndex={selectedDateIndex}
              onStepChange={handleDateIndexChange}
              isUpdating={isTimeUpdating && modelLoading}
            />
          </div>
        </aside>

        {/* ─── CENTER 52% VIEWPORT: 3D Earth Globe ─── */}
        <section className="w-full lg:w-[52%] flex flex-col min-h-[420px]">
          <Page3CenterViewport
            selectedRegion={selectedRegion}
            onConfirmRegionExplore={handleConfirmRegionExplore}
            onRegionChange={setSelectedRegion}
            observations={observations}
            visibleTypes={obsVisibility}
            obsLoading={obsLoading}
            obsError={obsError}
            selectedObservation={selectedObservation}
            onSelectObservation={setSelectedObservation}
            activeLayerId={activeLayer ? activeLayer.id : undefined}
            activeLayerLabel={activeLayer?.label}
            layerVisibility={layerVisibility}
            scalarFieldData={scalarFieldData}
            uFieldData={uFieldData}
            vFieldData={vFieldData}
            modelLoading={modelLoading}
            modelError={modelError}
            isInitialModelLoad={isInitialModelLoad}
            loadingVariableId={loadingVariableId}
            isDepthUpdating={isDepthUpdating}
            isTimeUpdating={isTimeUpdating}
            depth={depth}
            currentDateStr={getCurrentDateStr()}
            vectorDensity={vectorDensity}
            showEEZ={showEEZ}
          />
        </section>

        {/* ─── RIGHT 24% PANEL: Context, Colorbar, Description & Legend ─── */}
        <aside className="w-full lg:w-[24%] flex flex-col gap-3 pl-0 lg:pl-1">
          <DescriptionCard
            onResetRegion={() =>
              setSelectedRegion({
                latMin: -18.0,
                latMax: -5.0,
                lonMin: 65.0,
                lonMax: 85.0,
              })
            }
          />

          <ColorbarCard
            activeLayer={activeLayer}
            minVal={scalarFieldData?.min_value ?? (activeLayer?.id === "currents" ? 0 : null)}
            maxVal={scalarFieldData?.max_value ?? (activeLayer?.id === "currents" ? 1.5 : null)}
            unit={scalarFieldData?.unit || (activeLayer?.id === "currents" ? "m/s" : activeLayer?.unit)}
            depth={depth}
            currentDateStr={getCurrentDateStr()}
            isLoading={modelLoading && !isInitialModelLoad}
          />

          <HowToUseCard />

          <InstrumentLegend />
        </aside>
      </main>

      {/* ─── Navigation Info Modal ─── */}
      {infoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-sky-50 border border-sky-100">
                  {infoModal.icon}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{infoModal.title}</h3>
                  <p className="text-xs text-slate-500">{infoModal.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {infoModal.sections.map((sec, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">{sec.heading}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{sec.body}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

