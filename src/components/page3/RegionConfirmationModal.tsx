"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GeographicBounds } from "./globe/RegionSelectionBox"

interface RegionConfirmationModalProps {
  open: boolean
  bounds: GeographicBounds | null
  onConfirm: () => void
  onCancel: () => void
}

export default function RegionConfirmationModal({
  open,
  bounds,
  onConfirm,
  onCancel,
}: RegionConfirmationModalProps) {
  if (!open || !bounds) return null

  const dLat = (bounds.latMax - bounds.latMin).toFixed(2)
  const dLon = (bounds.lonMax - bounds.lonMin).toFixed(2)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs pointer-events-auto select-none">
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={onCancel} />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 border border-slate-200/90 p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] text-slate-800 flex flex-col gap-4 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/80 text-[#0284c7] flex items-center justify-center text-xl font-black shadow-xs shrink-0">
              🌊
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#0284c7] uppercase block mb-0.5">
                GEOGRAPHIC REGION CONFIRMATION
              </span>
              <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Explore Selected Ocean Region?
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 text-xs flex items-center justify-center transition-colors font-bold cursor-pointer shrink-0"
              title="Cancel"
            >
              ✕
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-600 leading-relaxed">
            Explore 3D volumetric ocean dynamics, depth-resolved model parameters, and in-situ observation instruments within this bounding region.
          </p>

          {/* Selected Region Coordinates Card */}
          <div className="rounded-xl bg-[#f8fafc] border border-slate-200/80 p-3.5 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-200/60">
              <span>BOUNDING BOX EXTENT</span>
              <span className="text-[#0284c7] font-semibold">Δ {dLat}° × {dLon}°</span>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-500">Latitude:</span>
              <span className="text-slate-800 font-bold tracking-wide">
                {bounds.latMin > 0 ? `+${bounds.latMin}` : bounds.latMin}°
                <span className="text-[#0284c7] mx-1.5">→</span>
                {bounds.latMax > 0 ? `+${bounds.latMax}` : bounds.latMax}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Longitude:</span>
              <span className="text-slate-800 font-bold tracking-wide">
                {bounds.lonMin > 0 ? `+${bounds.lonMin}` : bounds.lonMin}°
                <span className="text-[#0284c7] mx-1.5">→</span>
                {bounds.lonMax > 0 ? `+${bounds.lonMax}` : bounds.lonMax}°
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="px-5 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-sky-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore 3D Region</span>
              <span className="text-sm">→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
