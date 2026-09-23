"use client"

import React from "react"

export default function ObservationsFooterCards() {
  const cards = [
    {
      title: "Multiple Platforms",
      desc: "Argo, Glider, CTD, BGC and more observation systems",
      icon: (
        <svg className="w-5 h-5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: "Global & Regional Coverage",
      desc: "Access observations across the Indian Ocean and global oceans",
      icon: (
        <svg className="w-5 h-5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
          <path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ),
    },
    {
      title: "Quality Controlled Data",
      desc: "Reliable and standardized datasets from trusted sources",
      icon: (
        <svg className="w-5 h-5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Support Research & Policy",
      desc: "Used for ocean research, forecasting and decision making",
      icon: (
        <svg className="w-5 h-5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 select-none pt-0 shrink-0">
      {cards.map((c, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-2.5"
        >
          <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
            {c.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="text-[11px] font-bold text-slate-800 tracking-tight leading-tight">
              {c.title}
            </h4>
            <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5 truncate">
              {c.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
