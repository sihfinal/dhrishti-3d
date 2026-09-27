"use client"

import React from "react"

export default function InitialEarthLoader() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none transition-opacity duration-200"
      aria-live="polite"
      aria-label="Loading ocean data"
    >
      <div className="relative flex items-center justify-center w-8 h-8">
        {/* Minimal clean circular loading ring (~32px diameter, elevated above Earth globe) */}
        <span
          className="w-8 h-8 rounded-full border-[2.5px] border-sky-400/25 border-t-[#0284c7] animate-spin drop-shadow-[0_2px_8px_rgba(2,132,199,0.6)]"
          style={{
            borderTopColor: "#0284c7",
          }}
        />
      </div>
    </div>
  )
}
