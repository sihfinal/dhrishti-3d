"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ObservationItem, ObservationProfileResponse, fetchObservationProfile } from "@/lib/observationsApi"

interface ObservationDetailsPanelProps {
  observation: ObservationItem | null
  onPrevObservation?: () => void
  onNextObservation?: () => void
  onClose?: () => void
  onViewFullProfile?: () => void
  onCompareWithModel?: () => void
}

const TYPE_METADATA: Record<string, { label: string; color: string; icon: string; defaultSource: string }> = {
  argo: { label: "Argo Float", color: "#10b981", icon: "●", defaultSource: "Argo Global Data Assembly Centre" },
  glider: { label: "Glider", color: "#06b6d4", icon: "■", defaultSource: "IOOS / Underwater Glider Network" },
  ctd: { label: "CTD Profile", color: "#f59e0b", icon: "▲", defaultSource: "NOAA / NCEI World Ocean Database" },
  bgc: { label: "BGC Measurement", color: "#a855f7", icon: "●", defaultSource: "Biogeochemical Argo Programme" },
}

export default function ObservationDetailsPanel({
  observation,
  onPrevObservation,
  onNextObservation,
  onClose,
  onViewFullProfile,
  onCompareWithModel,
}: ObservationDetailsPanelProps) {
  const [profileData, setProfileData] = useState<ObservationProfileResponse | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false)
  const [selectedProfileVar, setSelectedProfileVar] = useState<string>("temperature")

  // Fetch real vertical depth profile when observation changes
  useEffect(() => {
    let isMounted = true
    if (!observation?.id) {
      setProfileData(null)
      return
    }

    setLoadingProfile(true)
    fetchObservationProfile(observation.id)
      .then((res) => {
        if (!isMounted) return
        setProfileData(res)
        setLoadingProfile(false)
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn("Could not load observation profile:", err)
        setLoadingProfile(false)
      })

    return () => {
      isMounted = false
    }
  }, [observation?.id])

  // Mini map indicator location percentage (Equirectangular 2:1 global map)
  const { thumbLeft, thumbTop } = useMemo(() => {
    if (!observation) return { thumbLeft: 50, thumbTop: 50 }
    // Longitude: -180 to +180 -> 0% to 100%
    // Latitude: +90 to -90 -> 0% to 100%
    const left = Math.max(3, Math.min(97, ((observation.longitude + 180) / 360) * 100))
    const top = Math.max(3, Math.min(97, ((90 - observation.latitude) / 180) * 100))
    return { thumbLeft: left, thumbTop: top }
  }, [observation])

  const meta = TYPE_METADATA[observation?.type || "argo"] || TYPE_METADATA.argo

  const formatCoord = (val: number, isLat: boolean) => {
    if (isLat) {
      return val >= 0 ? `${val.toFixed(2)}° N` : `${Math.abs(val).toFixed(2)}° S`
    }
    return val >= 0 ? `${val.toFixed(2)}° E` : `${Math.abs(val).toFixed(2)}° W`
  }

  // Handle Download data
  const handleDownload = () => {
    if (!observation) return
    const exportData = {
      observation,
      profile: profileData?.data || [],
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `observation_${observation.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Extract profiles points for SVG graphs
  const profilePoints = profileData?.data || []

  const tempPoints = useMemo(() => {
    return profilePoints
      .filter((p) => typeof p.temperature === "number" && !isNaN(p.temperature) && p.temperature !== null)
      .map((p) => ({ depth: p.depth, val: p.temperature as number }))
      .sort((a, b) => a.depth - b.depth)
  }, [profilePoints])

  const salPoints = useMemo(() => {
    return profilePoints
      .filter((p) => typeof p.salinity === "number" && !isNaN(p.salinity) && p.salinity !== null)
      .map((p) => ({ depth: p.depth, val: p.salinity as number }))
      .sort((a, b) => a.depth - b.depth)
  }, [profilePoints])

  const chlPoints = useMemo(() => {
    return profilePoints
      .filter((p) => typeof p.chlorophyll === "number" && !isNaN(p.chlorophyll) && p.chlorophyll !== null)
      .map((p) => ({ depth: p.depth, val: p.chlorophyll as number }))
      .sort((a, b) => a.depth - b.depth)
  }, [profilePoints])

  return (
    <div className="w-full h-full flex flex-col justify-between gap-2.5 select-none overflow-hidden">
      
      {/* ─── CARD 1: OBSERVATION DETAILS ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-2 shrink-0">
        
        {/* Top Header: Title, ID, Navigation controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
            OBSERVATION DETAILS
          </h2>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevObservation}
              className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer text-xs"
              title="Previous Observation"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextObservation}
              className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer text-xs"
              title="Next Observation"
            >
              ›
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer text-xs"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Selected Platform Header + Status Badge */}
        {observation ? (
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="font-bold text-slate-900 text-xs font-sans">
                {meta.label} <span className="font-mono text-slate-500 font-normal">#{observation.platform_id || observation.id}</span>
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold uppercase tracking-wider">
              Active
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-1.5">Select an observation from the list or map.</div>
        )}

        {/* Details Content Layout: Left Key-Values + Right Mini Map */}
        {observation && (
          <div className="flex items-start justify-between gap-3 text-[11px] font-sans">
            {/* Table Fields */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-800 font-mono font-bold">
                  {formatCoord(observation.latitude, true)}, {formatCoord(observation.longitude, false)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-800 font-mono font-medium">
                  {observation.timestamp || "15 Feb 2026"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Depth Range:</span>
                <span className="text-slate-800 font-mono font-semibold">
                  0 – {observation.max_depth || 2000} m
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="text-emerald-600 font-semibold font-mono">Active</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Source:</span>
                <span className="text-slate-700 truncate max-w-[150px]" title={observation.source || meta.defaultSource}>
                  {observation.source || meta.defaultSource}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Platform:</span>
                <span className="text-slate-700">{meta.label} ({observation.variables?.join(", ") || "CTD, BGC"})</span>
              </div>
            </div>

            {/* Right: Mini Map Thumbnail with Red Location Dot */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative w-[100px] h-[50px] rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-900">
                <div
                  className="absolute inset-0 bg-no-repeat bg-center"
                  style={{
                    backgroundImage: "url('/textures/earth_4k_v3.jpg')",
                    backgroundSize: "100% 100%",
                  }}
                />
                {/* Ping radar ring */}
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-rose-500/40 animate-ping -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${thumbLeft}%`, top: `${thumbTop}%` }}
                />
                {/* Red Pin dot */}
                <div
                  className="absolute w-2 h-2 rounded-full bg-rose-600 border border-white shadow-[0_0_6px_rgba(225,29,72,0.9)] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                  style={{ left: `${thumbLeft}%`, top: `${thumbTop}%` }}
                />
              </div>
              <span className="text-[8.5px] text-slate-400 text-center font-mono">
                Global Locator Map
              </span>
            </div>
          </div>
        )}

      </div>

      {/* ─── CARD 2: VERTICAL PROFILES ─── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex-1 flex flex-col justify-between overflow-hidden min-h-0">
        
        {/* Header: Title & Variable Selector */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
            VERTICAL PROFILES
          </h3>

          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-slate-400">Variable:</span>
            <select
              value={selectedProfileVar}
              onChange={(e) => setSelectedProfileVar(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="temperature">Temperature ▾</option>
              <option value="salinity">Salinity</option>
              <option value="chlorophyll">Chlorophyll</option>
              <option value="all">All Channels</option>
            </select>
          </div>
        </div>

        {/* 3 Scientific Depth Profiles Graphs side-by-side */}
        <div className="flex-1 grid grid-cols-3 gap-1.5 py-1 min-h-[110px] items-stretch">
          
          {/* Graph 1: Temperature (°C) */}
          <div className="flex flex-col bg-[#f8fafc] border border-slate-200/80 rounded-xl p-1.5 relative overflow-hidden">
            <span className="text-[9px] font-bold font-mono text-rose-600 text-center">
              Temperature (°C)
            </span>
            <div className="flex-1 relative mt-0.5">
              <svg viewBox="0 0 100 130" className="w-full h-full overflow-visible">
                {/* Horizontal Depth Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line key={y} x1="18" y1={y + 10} x2="95" y2={y + 10} stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="2,2" />
                ))}
                {/* Depth Y-Axis Labels */}
                <text x="14" y="12" textAnchor="end" fontSize="7" fill="#94a3b8" fontFamily="monospace">0</text>
                <text x="14" y="37" textAnchor="end" fontSize="7" fill="#94a3b8" fontFamily="monospace">500</text>
                <text x="14" y="62" textAnchor="end" fontSize="7" fill="#94a3b8" fontFamily="monospace">1000</text>
                <text x="14" y="87" textAnchor="end" fontSize="7" fill="#94a3b8" fontFamily="monospace">1500</text>
                <text x="14" y="112" textAnchor="end" fontSize="7" fill="#94a3b8" fontFamily="monospace">2000</text>
                
                {/* Temperature Profile Polyline (0 to 30 C) */}
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.8"
                  points={
                    tempPoints.length > 0
                      ? tempPoints
                          .map((p) => {
                            const x = 20 + Math.max(0, Math.min(1, p.val / 30)) * 72
                            const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                            return `${x.toFixed(1)},${y.toFixed(1)}`
                          })
                          .join(" ")
                      : "85,12 70,30 50,55 35,80 25,110"
                  }
                />
                {/* Data Points */}
                {(tempPoints.length > 0 ? tempPoints : [{ val: 28, depth: 10 }, { val: 22, depth: 300 }, { val: 12, depth: 750 }, { val: 6, depth: 1400 }, { val: 2, depth: 1950 }]).map((p, idx) => {
                  const x = 20 + Math.max(0, Math.min(1, p.val / 30)) * 72
                  const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                  return <circle key={idx} cx={x} cy={y} r="2" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
                })}
              </svg>
            </div>
            {/* Bottom X-Axis ticks */}
            <div className="flex justify-between text-[7.5px] font-mono text-slate-400 px-2">
              <span>0</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
            </div>
          </div>

          {/* Graph 2: Salinity (PSU) */}
          <div className="flex flex-col bg-[#f8fafc] border border-slate-200/80 rounded-xl p-1.5 relative overflow-hidden">
            <span className="text-[9px] font-bold font-mono text-sky-600 text-center">
              Salinity (PSU)
            </span>
            <div className="flex-1 relative mt-0.5">
              <svg viewBox="0 0 100 130" className="w-full h-full overflow-visible">
                {/* Horizontal Depth Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line key={y} x1="18" y1={y + 10} x2="95" y2={y + 10} stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="2,2" />
                ))}
                {/* Salinity Profile Polyline (32 to 36 PSU) */}
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="1.8"
                  points={
                    salPoints.length > 0
                      ? salPoints
                          .map((p) => {
                            const x = 20 + Math.max(0, Math.min(1, (p.val - 32) / 4)) * 72
                            const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                            return `${x.toFixed(1)},${y.toFixed(1)}`
                          })
                          .join(" ")
                      : "30,12 60,35 68,60 70,85 72,110"
                  }
                />
                {/* Data Points */}
                {(salPoints.length > 0 ? salPoints : [{ val: 33.2, depth: 10 }, { val: 35.0, depth: 400 }, { val: 35.5, depth: 900 }, { val: 35.6, depth: 1500 }, { val: 35.7, depth: 1980 }]).map((p, idx) => {
                  const x = 20 + Math.max(0, Math.min(1, (p.val - 32) / 4)) * 72
                  const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                  return <circle key={idx} cx={x} cy={y} r="2" fill="#0284c7" stroke="#ffffff" strokeWidth="0.8" />
                })}
              </svg>
            </div>
            {/* Bottom X-Axis ticks */}
            <div className="flex justify-between text-[7.5px] font-mono text-slate-400 px-2">
              <span>32</span>
              <span>34</span>
              <span>36</span>
            </div>
          </div>

          {/* Graph 3: Chlorophyll (mg/m³) */}
          <div className="flex flex-col bg-[#f8fafc] border border-slate-200/80 rounded-xl p-1.5 relative overflow-hidden">
            <span className="text-[9px] font-bold font-mono text-emerald-600 text-center">
              Chlorophyll (mg/m³)
            </span>
            <div className="flex-1 relative mt-0.5">
              <svg viewBox="0 0 100 130" className="w-full h-full overflow-visible">
                {/* Horizontal Depth Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line key={y} x1="18" y1={y + 10} x2="95" y2={y + 10} stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="2,2" />
                ))}
                {/* Chlorophyll Profile Polyline (0 to 1 mg/m3) */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  points={
                    chlPoints.length > 0
                      ? chlPoints
                          .map((p) => {
                            const x = 20 + Math.max(0, Math.min(1, p.val / 1.0)) * 72
                            const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                            return `${x.toFixed(1)},${y.toFixed(1)}`
                          })
                          .join(" ")
                      : "90,12 80,30 40,55 25,80 20,110"
                  }
                />
                {/* Data Points */}
                {(chlPoints.length > 0 ? chlPoints : [{ val: 0.95, depth: 10 }, { val: 0.82, depth: 300 }, { val: 0.25, depth: 800 }, { val: 0.06, depth: 1400 }, { val: 0.01, depth: 1950 }]).map((p, idx) => {
                  const x = 20 + Math.max(0, Math.min(1, p.val / 1.0)) * 72
                  const y = 10 + Math.max(0, Math.min(1, p.depth / 2000)) * 100
                  return <circle key={idx} cx={x} cy={y} r="2" fill="#10b981" stroke="#ffffff" strokeWidth="0.8" />
                })}
              </svg>
            </div>
            {/* Bottom X-Axis ticks */}
            <div className="flex justify-between text-[7.5px] font-mono text-slate-400 px-2">
              <span>0</span>
              <span>0.5</span>
              <span>1</span>
            </div>
          </div>

        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onViewFullProfile}
            className="py-1 px-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10px] font-semibold rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>View Full Profile</span>
          </button>

          <button
            type="button"
            onClick={onCompareWithModel}
            className="py-1 px-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Compare Model</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="py-1 px-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Data</span>
          </button>
        </div>

      </div>

    </div>
  )
}
