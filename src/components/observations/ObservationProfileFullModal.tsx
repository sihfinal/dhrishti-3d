"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ObservationItem, ObservationProfileResponse, fetchObservationProfile } from "@/lib/observationsApi"
import ObservationProfileChart from "../page3/ObservationProfileChart"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

interface ObservationProfileFullModalProps {
  observation: ObservationItem | null
  isOpen: boolean
  onClose: () => void
}

export default function ObservationProfileFullModal({
  observation,
  isOpen,
  onClose,
}: ObservationProfileFullModalProps) {
  const [profileData, setProfileData] = useState<ObservationProfileResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!isOpen || !observation?.id) {
      setProfileData(null)
      return
    }

    setLoading(true)
    setError(null)
    fetchObservationProfile(observation.id)
      .then((res) => {
        if (!isMounted) return
        setProfileData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn("Could not load full profile:", err)
        setError("Observation sounding data unavailable")
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, observation?.id])

  if (!isOpen || !observation) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative z-10 max-w-2xl w-full bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-slate-800"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0284c7]">
                IN-SITU OBSERVATION VERTICAL PROFILE
              </span>
              <h2 className="text-base font-bold text-slate-900">
                {observation.type.toUpperCase()} Cast #{observation.platform_id || observation.id}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-sky-600 font-mono text-xs">
              <LoadingSpinner size="lg" color="#0284c7" label="Fetching sounding profile" />
              <span>Fetching full resolution sounding profile…</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-mono text-center">
              {error}
            </div>
          ) : profileData && profileData.data && profileData.data.length > 0 ? (
            <ObservationProfileChart
              data={profileData.data}
              availableVariables={profileData.variables || observation.variables}
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-xs font-mono">
              No depth-resolved profile data available for this platform.
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-mono">
            <span>Location: {observation.latitude.toFixed(2)}°N, {observation.longitude.toFixed(2)}°E</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition font-sans"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
