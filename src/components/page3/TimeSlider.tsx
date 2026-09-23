"use client"

import React, { useState, useEffect } from "react"
import { TIME_CONFIG } from "./page3Config"

interface TimeSliderProps {
  currentDateStr: string
  stepIndex: number
  onStepChange: (index: number) => void
}

export default function TimeSlider({
  currentDateStr,
  stepIndex,
  onStepChange,
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)

  useEffect(() => {
    if (!isPlaying) return
    const intervalMs = Math.round(1000 / speed)
    const timer = setInterval(() => {
      onStepChange((stepIndex + 1) % TIME_CONFIG.totalSteps)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isPlaying, speed, stepIndex, onStepChange])

  return (
    <div className="pt-1.5 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-800">
          Time
        </span>
        <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-[#f8fafc] text-[11px] font-bold text-slate-800 font-mono shadow-2xs">
          {currentDateStr}
        </span>
      </div>

      <div className="relative flex flex-col gap-0.5 pt-0.5">
        <input
          type="range"
          min={0}
          max={TIME_CONFIG.totalSteps - 1}
          value={stepIndex}
          onChange={(e) => {
            setIsPlaying(false)
            onStepChange(Number(e.target.value))
          }}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284c7] focus:outline-none"
        />
        <div className="flex justify-between text-[9px] font-medium text-slate-400 px-0.5 mt-0.5">
          <span>{TIME_CONFIG.startDateStr}</span>
          <span>{TIME_CONFIG.endDateStr}</span>
        </div>
      </div>

      {/* Media Playback Controls */}
      <div className="flex items-center justify-center gap-2 mt-1.5 pt-0.5">
        {/* Previous Step */}
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
          title="Previous Step"
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-all cursor-pointer ${
            isPlaying
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-[#0284c7] hover:bg-[#0369a1]"
          }`}
          title={isPlaying ? "Pause Timeline" : "Play Timeline"}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next Step */}
        <button
          type="button"
          onClick={() => onStepChange((stepIndex + 1) % TIME_CONFIG.totalSteps)}
          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
          title="Next Step"
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>

        {/* Playback Speed Pill */}
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-[11px] font-bold text-slate-700 font-mono transition-colors cursor-pointer"
          title="Toggle Playback Speed"
        >
          {speed}x
        </button>
      </div>
    </div>
  )
}
