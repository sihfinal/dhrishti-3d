"use client"

import React, { useState, useMemo } from "react"
import { ObservationItem } from "@/lib/observationsApi"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

export interface FilterState {
  searchQuery: string
  obsType: string
  dateRange: string
  depthMax: number
  region: string
  sortBy: "newest" | "oldest" | "depth_desc" | "depth_asc"
}

interface ObservationsFilterListProps {
  observations: ObservationItem[]
  selectedObsId: string | null
  onSelectObservation: (obs: ObservationItem) => void
  onApplyFilters: (filters: FilterState) => void
  onResetFilters: () => void
  loading: boolean
  totalDatasetCount: number
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; shape: "circle" | "square" | "triangle" | "hexagon"; color: string; bg: string }
> = {
  argo: { label: "Argo Float", icon: "●", shape: "circle", color: "#10b981", bg: "#ecfdf5" },
  glider: { label: "Glider", icon: "■", shape: "square", color: "#06b6d4", bg: "#eff6ff" },
  ctd: { label: "CTD Profile", icon: "▲", shape: "triangle", color: "#f59e0b", bg: "#fff7ed" },
  bgc: { label: "BGC Measurement", icon: "●", shape: "hexagon", color: "#a855f7", bg: "#faf5ff" },
}

export default function ObservationsFilterList({
  observations,
  selectedObsId,
  onSelectObservation,
  onApplyFilters,
  onResetFilters,
  loading,
  totalDatasetCount,
}: ObservationsFilterListProps) {
  // Local filter controls state
  const [searchInput, setSearchInput] = useState("")
  const [obsType, setObsType] = useState("all")
  const [dateRange, setDateRange] = useState("all")
  const [depthMax, setDepthMax] = useState(6000)
  const [region, setRegion] = useState("indian_ocean")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "depth_desc" | "depth_asc">("newest")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Handle Apply
  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCurrentPage(1)
    onApplyFilters({
      searchQuery: searchInput,
      obsType,
      dateRange,
      depthMax,
      region,
      sortBy,
    })
  }

  // Handle Reset
  const handleReset = () => {
    setSearchInput("")
    setObsType("all")
    setDateRange("all")
    setDepthMax(6000)
    setRegion("indian_ocean")
    setSortBy("newest")
    setCurrentPage(1)
    onResetFilters()
  }

  // Client-side filtering & sorting on the observations dataset
  const filteredItems = useMemo(() => {
    let list = [...observations]

    // Search query
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase().trim()
      list = list.filter(
        (it) =>
          it.id.toLowerCase().includes(q) ||
          it.platform_id?.toLowerCase().includes(q) ||
          it.type.toLowerCase().includes(q) ||
          it.source?.toLowerCase().includes(q) ||
          `${it.latitude} ${it.longitude}`.includes(q)
      )
    }

    // Type filter
    if (obsType !== "all") {
      list = list.filter((it) => it.type === obsType)
    }

    // Depth filter
    list = list.filter((it) => (it.max_depth ?? 2000) <= depthMax)

    // Sort
    list.sort((a, b) => {
      if (sortBy === "depth_desc") return (b.max_depth ?? 2000) - (a.max_depth ?? 2000)
      if (sortBy === "depth_asc") return (a.max_depth ?? 2000) - (b.max_depth ?? 2000)
      if (sortBy === "oldest") return (a.timestamp || "").localeCompare(b.timestamp || "")
      // default newest
      return (b.timestamp || "").localeCompare(a.timestamp || "")
    })

    return list
  }, [observations, searchInput, obsType, depthMax, sortBy])

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, currentPage, itemsPerPage])

  const formatCoord = (val: number, isLat: boolean) => {
    if (isLat) {
      return val >= 0 ? `${val.toFixed(2)}° N` : `${Math.abs(val).toFixed(2)}° S`
    }
    return val >= 0 ? `${val.toFixed(2)}° E` : `${Math.abs(val).toFixed(2)}° W`
  }

  return (
    <div className="w-full h-full flex flex-col gap-2.5 select-none">
      
      {/* ─── CARD 1: FILTER OBSERVATIONS ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-2 shrink-0">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase flex items-center justify-between">
          <span>FILTER OBSERVATIONS</span>
        </h2>

        {/* Search Input */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            placeholder="Search by ID, location, or platform..."
            className="w-full bg-slate-50/80 border border-slate-200 rounded-lg px-2.5 py-1 pr-7 text-[11.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all font-sans"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Observation Type + Date Range Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Observation Type */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9.5px] font-medium text-slate-500">Observation Type</label>
            <select
              value={obsType}
              onChange={(e) => setObsType(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-sans cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="argo">Argo Floats</option>
              <option value="glider">Gliders</option>
              <option value="ctd">CTD Profiles</option>
              <option value="bgc">BGC Measurements</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9.5px] font-medium text-slate-500">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-sans cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="2026">2026 (Recent)</option>
              <option value="2025">2025</option>
              <option value="archive">Historical Archive</option>
            </select>
          </div>
        </div>

        {/* Depth Range Slider */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9.5px] text-slate-500">
            <span className="font-medium">Depth Range (m)</span>
            <span className="font-mono font-semibold text-slate-700">0 – {depthMax} m</span>
          </div>
          <input
            type="range"
            min="200"
            max="6000"
            step="100"
            value={depthMax}
            onChange={(e) => setDepthMax(Number(e.target.value))}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
          />
          <div className="flex justify-between text-[8.5px] font-mono text-slate-400">
            <span>0 m</span>
            <span>6000 m</span>
          </div>
        </div>

        {/* Region Selector */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9.5px] font-medium text-slate-500">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-sans cursor-pointer"
          >
            <option value="indian_ocean">Indian Ocean</option>
            <option value="arabian_sea">Arabian Sea</option>
            <option value="bay_of_bengal">Bay of Bengal</option>
            <option value="equatorial">Equatorial Indian Ocean</option>
            <option value="global">Global Oceans</option>
          </select>
        </div>

        {/* Apply & Reset Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => handleApply()}
            className="w-full py-1 px-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11px] font-semibold rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Apply Filters</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg shadow-2xs transition cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ─── CARD 2: OBSERVATIONS LIST ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex-1 flex flex-col min-h-0 justify-between">
        
        {/* Header with count and Sort by */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0 gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="text-[10.5px] font-bold tracking-wider text-slate-800 uppercase whitespace-nowrap">
              OBSERVATIONS LIST
            </h3>
            <span className="text-[10px] font-mono font-semibold text-slate-500 shrink-0">
              ({(totalDatasetCount || filteredItems.length).toLocaleString()})
            </span>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 text-[9.5px] shrink-0">
            <span className="text-slate-400 hidden xl:inline">Sort:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md pl-1 pr-3.5 py-0.5 text-[9.5px] text-slate-700 font-semibold focus:outline-none cursor-pointer appearance-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="depth_desc">Depth (High-Low)</option>
                <option value="depth_asc">Depth (Low-High)</option>
              </select>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[7.5px] text-slate-500 font-mono">
                ▾
              </span>
            </div>
          </div>
        </div>

        {/* Observation Items List */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-1 py-1.5 min-h-0">
          {loading ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-sky-600">
              <LoadingSpinner size="md" color="#0284c7" label="Fetching observations" />
              <span className="text-xs font-mono">Fetching observations…</span>
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-3">
              <span>No observations match filters.</span>
              <button
                type="button"
                onClick={handleReset}
                className="mt-1 text-sky-600 font-semibold hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            paginatedItems.map((obs) => {
              const meta = TYPE_CONFIG[obs.type] || TYPE_CONFIG.argo
              const isSelected = selectedObsId === obs.id
              const displayId = obs.platform_id ? `#${obs.platform_id}` : `#${obs.id.slice(0, 8)}`
              const dateText = obs.timestamp || "15 Feb 2026"
              const depthText = `0 – ${obs.max_depth || 2000} m`

              return (
                <div
                  key={obs.id}
                  onClick={() => onSelectObservation(obs)}
                  className={`flex items-center justify-between p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-sky-50/90 border-sky-400 ring-2 ring-sky-200/80 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  {/* Left: Icon & Label/Coordinates */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Platform Type Icon */}
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: meta.bg }}
                    >
                      {meta.shape === "circle" && (
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: meta.color }} />
                      )}
                      {meta.shape === "square" && (
                        <span className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ backgroundColor: meta.color }} />
                      )}
                      {meta.shape === "triangle" && (
                        <span className="text-[10px] font-bold leading-none inline-block" style={{ color: meta.color }}>
                          ▲
                        </span>
                      )}
                      {meta.shape === "hexagon" && (
                        <span className="w-2.5 h-2.5 rounded-full ring-2 ring-purple-300 inline-block" style={{ backgroundColor: meta.color }} />
                      )}
                    </div>

                    {/* Platform Title & Coordinates */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-slate-500">
                          {displayId}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-mono text-slate-500">
                        {formatCoord(obs.latitude, true)}, {formatCoord(obs.longitude, false)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Date & Depth Range */}
                  <div className="flex flex-col items-end shrink-0 pl-1.5">
                    <span className="text-[9.5px] font-mono font-medium text-slate-600">
                      {dateText}
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-400">
                      {depthText}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-center gap-1 pt-1.5 border-t border-slate-100 shrink-0 text-xs font-mono">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
          >
            ‹
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pNum = i + 1
            const isActive = currentPage === pNum
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => setCurrentPage(pNum)}
                className={`w-5.5 h-5.5 rounded-md flex items-center justify-center font-bold text-[11px] cursor-pointer ${
                  isActive
                    ? "bg-[#0284c7] text-white shadow-2xs"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {pNum}
              </button>
            )
          })}

          {totalPages > 5 && (
            <>
              <span className="text-slate-400 px-0.5 text-[10px]">…</span>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className={`w-auto min-w-[22px] px-1 h-5.5 rounded-md flex items-center justify-center font-bold text-[11px] cursor-pointer ${
                  currentPage === totalPages
                    ? "bg-[#0284c7] text-white shadow-2xs"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-xs"
          >
            ›
          </button>
        </div>

      </div>

    </div>
  )
}
