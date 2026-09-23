"use client"

import React from "react"
import Image from "next/image"

interface DescriptionCardProps {
  onResetRegion?: () => void
}

export default function DescriptionCard({ onResetRegion }: DescriptionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 select-none">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold tracking-[0.14em] text-slate-800 uppercase">
          GLOBAL OCEAN VIEW
        </h3>
      </div>

      {/* Indian Ocean Region Summary Bar */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-[#f8fafc] border border-slate-200/80 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-sky-300 shadow-xs">
            <Image
              src="/landing/study-region-globe.png"
              alt="Indian Ocean Globe"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              Indian Ocean
            </h4>
            <p className="text-[10px] text-slate-500 font-mono leading-tight mt-0.5">
              35° S – 30° N &nbsp;|&nbsp; 40° E – 100° E
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetRegion}
          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
          title="Reset to Full Indian Ocean Extent"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Exploratory Guidance */}
      <p className="text-[11px] text-slate-600 leading-relaxed">
        Explore model outputs and in-situ observations in the Indian Ocean region. Select a variable from the left panel to visualize.
      </p>
    </div>
  )
}
