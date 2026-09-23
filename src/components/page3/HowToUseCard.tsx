"use client"

import React from "react"

const STEPS = [
  {
    num: 1,
    title: "Select a data layer",
    desc: "Choose a variable from the left panel.",
  },
  {
    num: 2,
    title: "Click & drag on globe",
    desc: "Rotate, zoom and pan to explore the region.",
  },
  {
    num: 3,
    title: "Explore 3D model and observations",
    desc: "Visualize model data and in-situ observations.",
  },
  {
    num: 4,
    title: "Click any instrument for details",
    desc: "View profiles and additional information.",
  },
]

export default function HowToUseCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 select-none">
      <h3 className="text-[11px] font-bold tracking-[0.14em] text-slate-800 uppercase mb-2.5">
        HOW TO USE
      </h3>
      <div className="space-y-2">
        {STEPS.map((step) => (
          <div key={step.num} className="flex items-start gap-2.5">
            <span className="w-4 h-4 rounded-full bg-[#0284c7] text-white font-bold text-[9.5px] flex items-center justify-center shrink-0 mt-0.5">
              {step.num}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                {step.title}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
