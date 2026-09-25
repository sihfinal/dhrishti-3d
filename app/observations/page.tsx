"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useOcean } from "@/lib/store"
import {
  ObservationItem,
  ObservationListResponse,
  fetchObservations,
} from "@/lib/observationsApi"

import ObservationsFilterList, { FilterState } from "@/components/observations/ObservationsFilterList"
import ObservationsMapViewer from "@/components/observations/ObservationsMapViewer"
import ObservationDetailsPanel from "@/components/observations/ObservationDetailsPanel"
import ObservationProfileFullModal from "@/components/observations/ObservationProfileFullModal"
import ObservationsFooterCards from "@/components/observations/ObservationsFooterCards"

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
  ctaText?: string
  ctaAction?: () => void
}

export default function ObservationsPage() {
  const router = useRouter()
  const { setViewMode } = useOcean()

  // Real observations data states
  const [observations, setObservations] = useState<ObservationItem[]>([])
  const [countsByType, setCountsByType] = useState<Record<string, number>>({})
  const [totalDatasetCount, setTotalDatasetCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Selected observation state
  const [selectedObs, setSelectedObs] = useState<ObservationItem | null>(null)
  const [isFullProfileOpen, setIsFullProfileOpen] = useState<boolean>(false)

  // Header info modals state
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch real observations on initial load
  const loadObservations = useCallback(async (filterParams?: { type?: string; lat_min?: number; lat_max?: number; lon_min?: number; lon_max?: number }) => {
    setLoading(true)
    setError(null)
    try {
      const res: ObservationListResponse = await fetchObservations({
        limit: 2500,
        type: filterParams?.type && filterParams.type !== "all" ? filterParams.type : undefined,
        lat_min: filterParams?.lat_min,
        lat_max: filterParams?.lat_max,
        lon_min: filterParams?.lon_min,
        lon_max: filterParams?.lon_max,
      })
      setObservations(res.items || [])
      setCountsByType(res.counts_by_type || {})
      setTotalDatasetCount(res.total_in_dataset || res.count || 27698)

      // Set initial selected observation if none selected
      if (res.items && res.items.length > 0 && !selectedObs) {
        // Prefer Argo float if available
        const preferred = res.items.find((it) => it.type === "argo") || res.items[0]
        setSelectedObs(preferred)
      }
      setLoading(false)
    } catch (err: any) {
      console.warn("Failed to fetch real observations:", err)
      setError("In-situ observation service temporarily unavailable")
      setLoading(false)
    }
  }, [selectedObs])

  useEffect(() => {
    loadObservations()
  }, [])

  // Handle Apply Filters from Left panel
  const handleApplyFilters = (filters: FilterState) => {
    let lat_min: number | undefined
    let lat_max: number | undefined
    let lon_min: number | undefined
    let lon_max: number | undefined

    if (filters.region === "arabian_sea") {
      lat_min = 5
      lat_max = 26
      lon_min = 55
      lon_max = 78
    } else if (filters.region === "bay_of_bengal") {
      lat_min = 5
      lat_max = 24
      lon_min = 78
      lon_max = 98
    } else if (filters.region === "equatorial") {
      lat_min = -15
      lat_max = 10
      lon_min = 50
      lon_max = 105
    }

    loadObservations({
      type: filters.obsType !== "all" ? filters.obsType : undefined,
      lat_min,
      lat_max,
      lon_min,
      lon_max,
    })
  }

  // Handle Reset Filters
  const handleResetFilters = () => {
    loadObservations()
  }

  // Prev / Next Observation selector
  const handlePrevObservation = () => {
    if (!observations.length || !selectedObs) return
    const curIdx = observations.findIndex((o) => o.id === selectedObs.id)
    const prevIdx = curIdx > 0 ? curIdx - 1 : observations.length - 1
    setSelectedObs(observations[prevIdx])
  }

  const handleNextObservation = () => {
    if (!observations.length || !selectedObs) return
    const curIdx = observations.findIndex((o) => o.id === selectedObs.id)
    const nextIdx = curIdx < observations.length - 1 ? curIdx + 1 : 0
    setSelectedObs(observations[nextIdx])
  }

  const launchExplorer = (mode: "volume" | "globe" = "volume") => {
    setViewMode(mode)
    router.push("/explore")
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
  }

  const navModals: Record<string, InfoModalData> = {
    dataServices: {
      title: "Scientific Data Services & APIs",
      subtitle: "Enterprise oceanographic data distribution and high-throughput analytical query endpoints.",
      icon: "🌐",
      sections: [
        {
          heading: "RESTful Observation & Profile Services",
          body: "High-performance querying for depth-resolved Argo, Glider, CTD, and BGC profile arrays across the Indian Ocean basin.",
        },
        {
          heading: "Real-time Field Interoperability",
          body: "Direct integration with Copernicus Marine Service (CMEMS) numerical models and NOAA/NCEI World Ocean Database archives.",
        },
      ],
      ctaText: "Launch Interactive Explorer →",
      ctaAction: () => launchExplorer("volume"),
    },
    operationalApps: {
      title: "Operational Applications & Mission Modules",
      subtitle: "Mission-critical ocean intelligence for maritime security, disaster management, and blue economy.",
      icon: "⚡",
      sections: [
        {
          heading: "Maritime Domain Awareness (MDA)",
          body: "Sub-surface acoustic propagation modeling, thermocline gradient tracking, and EEZ environmental intelligence.",
        },
        {
          heading: "Disaster Risk & Cyclone Heat Potential (TCHP)",
          body: "Integrated ocean heat content mapping for rapid cyclone intensification warnings and storm surge forecasting.",
        },
      ],
      ctaText: "Explore Operational Models →",
      ctaAction: () => launchExplorer("volume"),
    },
    resources: {
      title: "Scientific Documentation & Knowledge Base",
      subtitle: "Peer-reviewed methodology, data conventions, and platform architectural specifications.",
      icon: "📚",
      sections: [
        {
          heading: "Ocean Observation Quality Control (QC)",
          body: "Automated real-time quality control flags adhering to international Argo and WOD23 scientific protocols.",
        },
        {
          heading: "3D Rendering Pipeline",
          body: "Hardware-accelerated WebGL volumetric raymarching and Marching Cubes isosurface extraction engines.",
        },
      ],
      ctaText: "Launch Interactive Explorer →",
      ctaAction: () => launchExplorer("volume"),
    },
    about: {
      title: "About SAGAR NETRA 3D — The Ocean Eye",
      subtitle: "Ministry of Earth Sciences · INCOIS · Smart India Hackathon 2026",
      icon: "🇮🇳",
      sections: [
        {
          heading: "Executive Vision",
          body: "An interactive, web-based 3D visualization and analytical workstation built to democratize ocean intelligence for researchers, disaster managers, and the blue economy.",
        },
        {
          heading: "Technology Stack",
          body: "Engineered with Next.js App Router, Three.js / WebGL, Fast NetCDF-4/xarray backend engines, and responsive institutional design.",
        },
      ],
      ctaText: "Experience the Workstation →",
      ctaAction: () => launchExplorer("volume"),
    },
  }

  return (
    <div className="min-h-screen w-full bg-[#f4f8fc] text-slate-900 font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-900">
      
      {/* ────────────────────────────────────────────────────────────
          1. TOP INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-200/80 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
        
        {/* Row 1: Institutional Badges, Tagline, Search, User */}
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
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
                  className="h-10 sm:h-11 w-auto object-contain"
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
                  className="h-10 sm:h-11 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Center: National Tagline + Tricolor Swirl Ribbon */}
            <div className="hidden xl:flex items-center justify-center flex-1 px-4">
              <Image
                src="/landing/header-tagline-swirl.png"
                alt="Oceans for a Safer, Sustainable and Prosperous India"
                width={400}
                height={70}
                priority
                unoptimized
                className="h-[52px] sm:h-[54px] w-auto object-contain -translate-x-24"
              />
            </div>

            {/* Right: Search Pill Input & User Avatar */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="relative hidden md:flex items-center">
                <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-1 w-60 lg:w-64 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search datasets, variables, regions..."
                    className="w-full text-xs text-slate-700 bg-transparent placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="ml-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                    title="Search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </form>

              {/* User Profile Avatar */}
              <button
                type="button"
                onClick={() => setInfoModal(navModals.about)}
                className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer"
                title="Institutional Session & Access"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Row 2: Institutional Navbar (Observations Active) */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
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

                {/* Explorer */}
                <button
                  type="button"
                  onClick={() => launchExplorer("volume")}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                    <path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  <span>Explorer</span>
                </button>

                {/* Observations (Active) */}
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8M17 7h4v4" />
                  </svg>
                  <span>Observations</span>
                  {/* Blue Active Indicator Bar */}
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </button>

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
                <Link
                  href="/resources"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Resources</span>
                </Link>

                {/* About */}
                <Link
                  href="/about"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeWidth={1.8} d="M12 16v-4m0-4h.01" />
                  </svg>
                  <span>About</span>
                </Link>
              </nav>

              {/* Right CTA Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchExplorer("volume")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#0a2540] hover:bg-[#0f3458] text-white text-xs font-semibold rounded-md shadow-sm transition cursor-pointer"
                >
                  <span>Launch Explorer</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────
          2. MAIN 3-COLUMN OBSERVATIONS WORKSPACE
          Left: 25% | Center: 41.7% | Right: 33.3%
      ──────────────────────────────────────────────────────────── */}
      <main className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-2.5 pb-1 flex-1 flex flex-col gap-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-[440px]">
          
          {/* ─── LEFT COLUMN: Filters + Real Observation List (3 cols) ─── */}
          <div className="lg:col-span-3 flex flex-col h-full min-h-[420px]">
            <ObservationsFilterList
              observations={observations}
              selectedObsId={selectedObs?.id || null}
              onSelectObservation={(obs) => setSelectedObs(obs)}
              onApplyFilters={handleApplyFilters}
              onResetFilters={handleResetFilters}
              loading={loading}
              totalDatasetCount={totalDatasetCount}
            />
          </div>

          {/* ─── CENTER COLUMN: Observation Locations Map / Globe (5 cols) ─── */}
          <div className="lg:col-span-5 flex flex-col h-full min-h-[420px]">
            <ObservationsMapViewer
              observations={observations}
              selectedObsId={selectedObs?.id || null}
              onSelectObservation={(obs) => setSelectedObs(obs)}
              onRegionChange={(reg) => {
                handleApplyFilters({
                  searchQuery: "",
                  obsType: "all",
                  dateRange: "all",
                  depthMax: 6000,
                  region: reg,
                  sortBy: "newest",
                })
              }}
            />
          </div>

          {/* ─── RIGHT COLUMN: Observation Details + Vertical Profiles (4 cols) ─── */}
          <div className="lg:col-span-4 flex flex-col h-full min-h-[420px]">
            <ObservationDetailsPanel
              observation={selectedObs}
              onPrevObservation={handlePrevObservation}
              onNextObservation={handleNextObservation}
              onViewFullProfile={() => setIsFullProfileOpen(true)}
              onCompareWithModel={() => launchExplorer("volume")}
            />
          </div>

        </div>

        {/* ─── BOTTOM 4 FEATURE CARDS ─── */}
        <ObservationsFooterCards />
      </main>

      {/* ────────────────────────────────────────────────────────────
          3. INSTITUTIONAL FOOTER
      ──────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between shrink-0 text-[11px] text-slate-500 font-sans">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-slate-600">Data Sources:</span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
            Argo GDAC
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
            IOOS
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
            NOAA
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] inline-block" />
            Copernicus Marine Service (CMEMS)
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
            INCOIS
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200" />
            Official Data Sources Configured
          </span>
          <span className="hidden md:inline">|</span>
          <span className="text-slate-500">Last Updated: 15 Feb 2026, 12:30 UTC</span>
        </div>
      </footer>

      {/* ────────────────────────────────────────────────────────────
          5. FULL DETAILED PROFILE MODAL
      ──────────────────────────────────────────────────────────── */}
      <ObservationProfileFullModal
        observation={selectedObs}
        isOpen={isFullProfileOpen}
        onClose={() => setIsFullProfileOpen(false)}
      />

      {/* ────────────────────────────────────────────────────────────
          6. INSTITUTIONAL INFO MODALS
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setInfoModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{infoModal.icon}</span>
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">{infoModal.title}</h3>
                    <p className="text-xs text-slate-500">{infoModal.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed border-t border-b border-slate-100 py-3">
                {infoModal.sections.map((sec, i) => (
                  <div key={i}>
                    <h4 className="font-semibold text-slate-900 mb-0.5">{sec.heading}</h4>
                    <p>{sec.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {infoModal.ctaText && infoModal.ctaAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoModal(null)
                      infoModal.ctaAction?.()
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    {infoModal.ctaText}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
