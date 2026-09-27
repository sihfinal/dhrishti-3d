"use client"

import React from "react"

interface OceanData3DLoaderProps {
  label?: string
}

export default function OceanData3DLoader({ label = "Loading data…" }: OceanData3DLoaderProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none transition-opacity duration-200"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-slate-200/90 shadow-sm backdrop-blur-sm">
        {/* Minimal clean circular loading ring (~14px diameter, SagarNetra primary blue accent) */}
        <span
          className="w-3.5 h-3.5 rounded-full border-2 border-sky-400/25 border-t-[#0284c7] animate-spin shrink-0"
          style={{ borderTopColor: "#0284c7" }}
        />
        <span className="text-[11px] font-medium font-sans text-slate-700 tracking-wide">
          {label}
        </span>
      </div>
    </div>
  )
}
