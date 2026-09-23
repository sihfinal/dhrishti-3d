"use client"

import React from "react"
import { INSTRUMENT_LEGEND } from "./page3Config"

export default function InstrumentLegend() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 select-none">
      <h3 className="text-[11px] font-bold tracking-[0.14em] text-slate-800 uppercase mb-2">
        LEGEND <span className="text-slate-400 font-normal">(OBSERVATIONS)</span>
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
        {INSTRUMENT_LEGEND.map((item) => (
          <div key={item.id} className="flex items-center gap-2 py-0.5">
            {item.id === "argo" && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block shrink-0 shadow-2xs" />
            )}
            {item.id === "glider" && (
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0284c7] inline-block shrink-0 shadow-2xs" />
            )}
            {item.id === "ctd" && (
              <span className="text-[11px] text-[#f97316] font-bold leading-none shrink-0">▲</span>
            )}
            {item.id === "bgc" && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] inline-block shrink-0 shadow-2xs" />
            )}
            <span className="text-[11px] text-slate-700 font-semibold truncate">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Geospatial Boundaries */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-[3px] bg-[#0284c7] inline-block shrink-0 rounded-full" />
          <span className="text-[11px] text-slate-700 font-semibold">
            Indian EEZ Boundary
          </span>
        </div>
        <span className="text-[9.5px] font-mono text-slate-400">Marine Regions / UNCLOS</span>
      </div>
    </div>
  )
}
