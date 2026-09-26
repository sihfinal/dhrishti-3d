"use client"

import React from "react"
import { DEPTH_CONFIG } from "./page3Config"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

interface DepthSliderProps {
  depth: number
  onChangeDepth: (val: number) => void
  isUpdating?: boolean
}

export default function DepthSlider({ depth, onChangeDepth, isUpdating = false }: DepthSliderProps) {
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-800">
          Depth <span className="text-slate-500 font-normal">(Model Layer)</span>
        </span>
        <div className="flex items-center gap-1.5">
          {isUpdating && <LoadingSpinner size="xs" color="#0284c7" label="Updating depth data" />}
          <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-[#f8fafc] text-[11px] font-bold text-slate-800 font-mono shadow-2xs">
            {depth} {DEPTH_CONFIG.unit}
          </span>
        </div>
      </div>

      <div className="relative flex flex-col gap-0.5 pt-0.5">
        <input
          type="range"
          min={DEPTH_CONFIG.min}
          max={DEPTH_CONFIG.max}
          step={25}
          value={depth}
          onChange={(e) => onChangeDepth(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none"
        />
        <div className="flex justify-between text-[9px] font-medium text-slate-400 px-0.5 mt-0.5">
          <span>0 m</span>
          <span>2000 m</span>
        </div>
      </div>
    </div>
  )
}
