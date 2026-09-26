"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useOcean } from "@/lib/store"
import { SiteHeader } from "@/components/layout/SiteHeader"
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
      <SiteHeader
        currentRoute="observations"
        onOpenAbout={() => setInfoModal(navModals.about)}
        onLaunchExplorer={(mode) => launchExplorer(mode)}
      />

      {/* ────────────────────────────────────────────────────────────
          2. MAIN 3-COLUMN OBSERVATIONS WORKSPACE
          Left: 25% | Center: 41.7% | Right: 33.3%
      ──────────────────────────────────────────────────────────── */}
      <main className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-2.5 pb-1 flex-1 flex flex-col gap-2">
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
