"use client"

import React from "react"

interface ObservationsIntroBannerProps {
  counts: {
    argo?: number
    glider?: number
    ctd?: number
    bgc?: number
    total?: number
  }
}

export default function ObservationsIntroBanner({ counts }: ObservationsIntroBannerProps) {
  const argoCount = counts.argo ?? 22231
  const gliderCount = counts.glider ?? 2591
  const ctdCount = counts.ctd ?? 619
  const bgcCount = counts.bgc ?? 2257

  return (
    <div className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 select-none shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col xl:flex-row items-start xl:items-center justify-between gap-2.5">
        
        {/* Left: Title & Subtitle */}
        <div className="flex flex-col max-w-xl">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0a2540] flex items-center gap-2">
            <span>In-situ Ocean Observations</span>
          </h1>
          <p className="text-[10.5px] sm:text-[11.5px] text-slate-600 mt-0.5 leading-tight font-normal">
            Explore real ocean measurements collected from profiling floats and other observation platforms across the Indian Ocean and global oceans.
          </p>
        </div>

        {/* Right: 4 Statistic Cards + Artistic Tagline */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-between xl:justify-end">
          
          {/* 1. Argo Floats */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs min-w-[105px] sm:min-w-[115px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Argo Floats</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 leading-none">
                {argoCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 2. Gliders */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs min-w-[105px] sm:min-w-[115px]">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-500 ring-2 ring-cyan-100 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Gliders</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 leading-none">
                {gliderCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 3. CTD Profiles */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs min-w-[105px] sm:min-w-[115px]">
            <span className="text-[11px] text-amber-500 font-bold leading-none shrink-0">▲</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">CTD Profiles</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 leading-none">
                {ctdCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 4. BGC Measurements */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs min-w-[105px] sm:min-w-[115px]">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-100 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">BGC Measurements</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 leading-none">
                {bgcCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Slogan Badge */}
          <div className="hidden 2xl:flex flex-col text-right pl-2 border-l border-slate-200">
            <span className="text-[10px] font-serif italic text-sky-700 font-semibold tracking-wide">
              Real Observations
            </span>
            <span className="text-[9.5px] font-serif italic text-slate-500">
              Deeper Understanding · A Healthier Ocean
            </span>
          </div>

        </div>

      </div>
    </div>
  )
}
