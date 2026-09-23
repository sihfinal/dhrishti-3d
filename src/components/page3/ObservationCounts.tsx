"use client"

import React from "react"
import { OBSERVATION_COUNTS } from "./page3Config"

interface ObservationCountsProps {
  counts?: Record<string, number>
  visibleTypes?: Record<string, boolean>
  onToggleType?: (type: string) => void
}

export default function ObservationCounts({
  counts = {},
  visibleTypes = { argo: true, glider: true, ctd: true, bgc: true },
  onToggleType,
}: ObservationCountsProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 select-none">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] font-bold tracking-[0.14em] text-slate-800 uppercase">
          OBSERVATION COUNTS
        </h3>
        <span className="text-[10.5px] font-semibold text-[#0284c7] hover:underline cursor-pointer flex items-center gap-0.5">
          <span>Real-time & Archive</span>
          <span className="text-[9px]">⌄</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OBSERVATION_COUNTS.map((item) => {
          const isVisible = visibleTypes[item.id] !== false
          const realCount = counts[item.id] !== undefined ? counts[item.id] : item.count

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleType?.(item.id)}
              className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                isVisible
                  ? "bg-[#f8fafc] border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-xs"
                  : "bg-slate-50/60 border-slate-200/60 opacity-50 hover:opacity-80"
              }`}
              title={isVisible ? `Click to hide ${item.label} markers` : `Click to show ${item.label} markers`}
            >
              {/* Icon Container */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                style={{
                  backgroundColor:
                    item.id === "argo"
                      ? "#ecfdf5"
                      : item.id === "glider"
                      ? "#eff6ff"
                      : item.id === "ctd"
                      ? "#fff7ed"
                      : "#faf5ff",
                }}
              >
                {item.id === "argo" && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[#10b981] inline-block ring-2 ring-emerald-200" />
                )}
                {item.id === "glider" && (
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-[#0284c7] inline-block ring-2 ring-sky-200" />
                )}
                {item.id === "ctd" && (
                  <span className="text-[11px] text-[#f97316] font-bold leading-none">▲</span>
                )}
                {item.id === "bgc" && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[#a855f7] inline-block ring-2 ring-purple-200" />
                )}
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-slate-500 truncate leading-tight">
                  {item.label}
                </p>
                <p className="text-[13px] font-bold text-slate-900 leading-tight mt-0.5 tracking-tight">
                  {realCount.toLocaleString()}
                </p>
              </div>

              {/* Tick Mark Checkbox */}
              <div
                className={`w-4 h-4 rounded-[4px] flex items-center justify-center transition-all shrink-0 border ${
                  isVisible
                    ? "bg-[#0284c7] border-[#0284c7] text-white shadow-2xs"
                    : "bg-white border-slate-300 text-transparent"
                }`}
              >
                <svg className="w-3 h-3 stroke-current stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
