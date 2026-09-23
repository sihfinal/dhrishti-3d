"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ObservationItem,
  fetchObservationProfile,
  ObservationProfileResponse,
} from "@/lib/observationsApi"
import ObservationProfileChart from "./ObservationProfileChart"
import ModelObsComparisonView from "./ModelObsComparisonView"

interface ObservationDetailModalProps {
  observation: ObservationItem | null
  onClose: () => void
}

const TYPE_METADATA: Record<string, { label: string; color: string; icon: string }> = {
  argo: { label: "Argo Profiling Float", color: "#10b981", icon: "●" },
  glider: { label: "Autonomous Underwater Glider", color: "#06b6d4", icon: "■" },
  ctd: { label: "Shipboard CTD Rosette Cast", color: "#f97316", icon: "▲" },
  bgc: { label: "Biogeochemical Argo Float", color: "#a855f7", icon: "◆" },
}

export default function ObservationDetailModal({
  observation,
  onClose,
}: ObservationDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "compare">("profile")
  const [profileData, setProfileData] = useState<ObservationProfileResponse | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Reset tab and fetch depth profile when observation changes
  useEffect(() => {
    let isMounted = true
    setActiveTab("profile")
    if (!observation?.id) {
      setProfileData(null)
      setLoadingProfile(false)
      setProfileError(null)
      return
    }

    setLoadingProfile(true)
    setProfileError(null)

    fetchObservationProfile(observation.id)
      .then((res) => {
        if (!isMounted) return
        setProfileData(res)
        setLoadingProfile(false)
        setProfileError(null)
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn("Observation profile fetch error:", err)
        setLoadingProfile(false)
        setProfileError("Observation profile unavailable")
      })

    return () => {
      isMounted = false
    }
  }, [observation?.id])

  if (!observation) return null

  const meta = TYPE_METADATA[observation.type] || {
    label: observation.type.toUpperCase(),
    color: "#38bdf8",
    icon: "●",
  }

  const formatCoord = (val: number, isLat: boolean) => {
    if (isLat) {
      return val >= 0 ? `${val.toFixed(2)}°N` : `${Math.abs(val).toFixed(2)}°S`
    }
    return val >= 0 ? `${val.toFixed(2)}°E` : `${Math.abs(val).toFixed(2)}°W`
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs pointer-events-auto select-none">
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white/95 border border-slate-200/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] text-slate-800 flex flex-col gap-3.5 backdrop-blur-xl no-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-xs shrink-0"
                style={{
                  backgroundColor:
                    observation.type === "argo"
                      ? "#ecfdf5"
                      : observation.type === "glider"
                      ? "#eff6ff"
                      : observation.type === "ctd"
                      ? "#fff7ed"
                      : "#faf5ff",
                  color: meta.color,
                }}
              >
                {meta.icon}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#0284c7] uppercase">
                  IN-SITU OBSERVATION ANALYSIS
                </span>
                <span className="text-[13.5px] font-bold text-slate-900 tracking-tight">
                  {meta.label}{" "}
                  <span className="font-mono text-slate-500 font-normal">
                    #{observation.platform_id || observation.id}
                  </span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 text-xs flex items-center justify-center transition-colors font-bold cursor-pointer"
              title="Close Details"
            >
              ✕
            </button>
          </div>

          {/* Primary View Switcher: In-Situ Sounding | Compare with Model */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "profile"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📊 In-Situ Sounding Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "compare"
                  ? "bg-[#0284c7] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🔄 Compare with Model
            </button>
          </div>

          {activeTab === "profile" ? (
            <>
              {/* Details Grid */}
              <div className="rounded-xl bg-[#f8fafc] border border-slate-200/80 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Platform / Cast ID:</span>
                  <span className="text-slate-900 font-bold tracking-wide">
                    #{observation.platform_id || observation.id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Coordinates:</span>
                  <span className="text-[#0284c7] font-bold">
                    {formatCoord(observation.latitude, true)},{" "}
                    {formatCoord(observation.longitude, false)}
                  </span>
                </div>

                {observation.timestamp && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Observation Date:</span>
                    <span className="text-slate-800 font-medium">
                      {observation.timestamp}
                    </span>
                  </div>
                )}

                {observation.max_depth !== undefined && observation.max_depth > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Max Sounding Depth:</span>
                    <span className="text-emerald-600 font-bold">
                      {observation.max_depth} m
                    </span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-400 text-[10px] block mb-1">
                    AVAILABLE MEASUREMENTS:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {observation.variables && observation.variables.length > 0 ? (
                      observation.variables.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-700 font-semibold capitalize shadow-2xs"
                        >
                          {v}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-[10px]">
                        Temperature, Salinity
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scientific Depth Profile Section */}
              {loadingProfile ? (
                <div className="rounded-xl bg-[#f8fafc] border border-slate-200/80 p-6 flex flex-col items-center justify-center gap-2 text-[#0284c7]">
                  <span className="w-6 h-6 rounded-full border-2 border-[#0284c7] border-t-transparent animate-spin" />
                  <span className="text-xs font-mono font-semibold">
                    Loading depth profile…
                  </span>
                </div>
              ) : profileError ? (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-center text-rose-600 text-xs font-mono">
                  {profileError}
                </div>
              ) : profileData && profileData.data && profileData.data.length > 0 ? (
                <ObservationProfileChart
                  data={profileData.data}
                  availableVariables={profileData.variables || observation.variables}
                />
              ) : (
                <div className="rounded-xl bg-[#f8fafc] border border-slate-200/80 p-4 text-center text-slate-500 text-xs font-mono">
                  No depth-resolved measurements available for this profile.
                </div>
              )}

              {/* Action: Compare with Model Button */}
              <button
                type="button"
                onClick={() => setActiveTab("compare")}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0284c7] font-semibold text-xs border border-sky-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>🔄</span>
                <span>Compare this In-Situ Sounding with Numerical Model</span>
              </button>
            </>
          ) : (
            /* ─── Model vs Observation Scientific Comparison Mode ─── */
            <ModelObsComparisonView observation={observation} />
          )}

          {/* Source Attribution & Close Action */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10.5px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>Source:</span>
              <span className="text-slate-700 font-semibold truncate max-w-[220px]">
                {observation.source || "NOAA / NCEI WOD"}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
