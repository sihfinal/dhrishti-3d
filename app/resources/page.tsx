"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
  ctaText?: string
  ctaAction?: () => void
}

export default function ResourcesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
  }
  function launchExplorer(mode: "volume" | "globe" = "volume") {
    router.push(mode === "globe" ? "/explore?view=globe" : "/explore")
  }

  const navModals: Record<string, InfoModalData> = {
    about: {
      title: "About SAGAR NETRA 3D — The Ocean Eye",
      subtitle: "Ministry of Earth Sciences · INCOIS · Smart India Hackathon 2026",
      icon: "🇮🇳",
      sections: [
        { heading: "Executive Vision", body: "An interactive, web-based 3D visualization and analytical workstation built to democratize ocean intelligence." },
        { heading: "Technology Stack", body: "Next.js App Router, Three.js / WebGL, FastAPI/xarray backend, and responsive institutional design." },
      ],
      ctaText: "Experience the Workstation →",
      ctaAction: () => launchExplorer("volume"),
    },
  }

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans flex flex-col selection:bg-sky-100 selection:text-sky-900">

      {/* ── HEADER ── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center">
                <Image src="/landing/header-emblem-moes.png" alt="Ministry of Earth Sciences, Government of India" width={220} height={64} priority unoptimized className="h-10 sm:h-11 w-auto object-contain" />
              </div>
              <div className="h-8 w-[1px] bg-slate-200" />
              <div className="flex items-center">
                <Image src="/landing/header-incois.png" alt="INCOIS" width={340} height={64} priority unoptimized className="h-10 sm:h-11 w-auto object-contain" />
              </div>
            </div>
            <div className="hidden xl:flex items-center justify-center flex-1 px-4">
              <Image src="/landing/header-tagline-swirl.png" alt="Oceans for a Safer, Sustainable and Prosperous India" width={400} height={70} priority unoptimized className="h-[52px] sm:h-[54px] w-auto object-contain -translate-x-24" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <form onSubmit={handleSearch} className="relative hidden md:flex items-center">
                <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-1 w-60 lg:w-64 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
                  <svg className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search datasets, variables, regions..." className="w-full text-xs text-slate-700 bg-transparent placeholder-slate-400 focus:outline-none" />
                  <button type="submit" className="ml-1 text-slate-400 hover:text-sky-600 transition cursor-pointer" title="Search">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </div>
              </form>
              <button onClick={() => setInfoModal(navModals.about)} className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer" title="About">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </button>
            </div>
          </div>
        </div>
        {/* Row 2 Nav */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
                <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                  <span>Home</span>
                </button>
                <button onClick={() => router.push("/study-region")} className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>Study Region</span>
                </button>
                <button onClick={() => launchExplorer("volume")} className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="1.8" /><path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                  <span>Explorer</span>
                </button>
                <Link href="/observations" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8M17 7h4v4" /></svg>
                  <span>Observations</span>
                </Link>
                <Link href="/data-services" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} /><path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
                  <span>Data Services</span>
                </Link>
                <Link href="/operational-applications" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" /></svg>
                  <span>Operational Applications</span>
                </Link>
                {/* Resources ACTIVE */}
                <Link href="/resources" className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span>Resources</span>
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </Link>                {/* About */}
                <Link
                  href="/about"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeWidth={1.8} d="M12 16v-4m0-4h.01" />
                  </svg>
                  <span>About</span>
                </Link>
              </nav>
              <div className="shrink-0 pl-4">
                <button onClick={() => launchExplorer("volume")} className="rounded-full bg-[#0a2e5c] hover:bg-[#072142] text-white px-4 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_4px_rgba(10,46,92,0.18)] hover:shadow-md transition-all cursor-pointer group">
                  <span>Launch Explorer</span>
                  <span className="text-xs transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative w-full overflow-hidden bg-gradient-to-r from-[#e0f2fe] via-[#dbeafe] to-[#bae6fd] select-none py-8 sm:py-10 border-b border-sky-100 shadow-xs shrink-0">
        {/* Ocean background wave backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-right opacity-60 mix-blend-multiply pointer-events-none"
          style={{ backgroundImage: "url('/landing/study-region-bg-perfect.jpg')", backgroundPosition: "right center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#e0f2fe] via-[#e0f2fe]/90 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0a2540] tracking-tight drop-shadow-xs">Resources</h1>
            <p className="text-base sm:text-lg font-semibold text-[#0284c7] mt-1">Learn&nbsp;&bull;&nbsp;Explore&nbsp;&bull;&nbsp;Use&nbsp;&bull;&nbsp;Contribute</p>
            <p className="text-xs sm:text-[13px] text-slate-700 mt-2 leading-relaxed max-w-xl font-normal">Access documentation, tutorials, datasets, tools and additional resources to make the most of SAGAR NETRA 3D.</p>
          </div>
          <div className="hidden lg:flex flex-col items-end text-right self-center shrink-0 gap-1">
            <div className="relative w-72 h-16 rounded-xl overflow-hidden shadow-xs border border-sky-200/60">
              <Image
                src="/landing/resources-hero-banner.png"
                alt="Knowledge for a Healthier Ocean - Ocean Waves"
                fill
                unoptimized
                className="object-cover object-right"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#e0f2fe]/40 to-[#e0f2fe] flex flex-col items-end justify-center pr-3">
                <span className="text-lg font-extrabold text-[#0a2540] italic leading-tight drop-shadow-xs">Knowledge</span>
                <span className="text-xs font-bold text-[#0284c7] italic drop-shadow-xs">for a Healthier Ocean</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 FEATURE CARDS ── */}
      <section className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3.5 hover:border-sky-300 hover:shadow-sm transition group">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600 group-hover:bg-sky-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#0a2540] leading-tight">Documentation</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">User guides, technical docs, API references.</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-sky-100 flex items-center justify-center shrink-0 transition text-slate-400 group-hover:text-sky-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div onClick={() => router.push("/watch-demo")} className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3.5 hover:border-sky-300 hover:shadow-sm transition group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600 group-hover:bg-emerald-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#0a2540] leading-tight">Tutorials &amp; Training</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Step-by-step guides and video tutorials.</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition text-slate-400 group-hover:text-emerald-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div onClick={() => router.push("/data-services")} className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3.5 hover:border-sky-300 hover:shadow-sm transition group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0 text-cyan-600 group-hover:bg-cyan-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} /><path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#0a2540] leading-tight">Datasets</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Model outputs, in-situ data and sample files.</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-cyan-100 flex items-center justify-center shrink-0 transition text-slate-400 group-hover:text-cyan-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3.5 hover:border-sky-300 hover:shadow-sm transition group">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600 group-hover:bg-amber-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[#0a2540] leading-tight">Tools &amp; Utilities</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Sample scripts and visualization utilities.</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center shrink-0 transition text-slate-400 group-hover:text-amber-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN GRID ROW 1 ── */}
      <main className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Documentation */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                <h2 className="text-sm font-bold text-[#0a2540]">Documentation</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">5 items</span>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Everything you need to understand and use SAGAR NETRA 3D.</p>
            <div className="flex-1 divide-y divide-slate-100">
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">User Manual</p><p className="text-[10px] text-slate-500 leading-tight">Complete guide to using the platform</p></div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">Coming Soon</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">Technical Documentation</p><p className="text-[10px] text-slate-500 leading-tight">System architecture and methodology</p></div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">Coming Soon</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">API Documentation</p><p className="text-[10px] text-slate-500 leading-tight">WMS, WCS, OPeNDAP and REST API details</p></div>
                </div>
                <Link href="/data-services" className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition shrink-0">View →</Link>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">Data User Guide</p><p className="text-[10px] text-slate-500 leading-tight">Information on datasets and variables</p></div>
                </div>
                <Link href="/data-services" className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition shrink-0">View →</Link>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">Frequently Asked Questions</p><p className="text-[10px] text-slate-500 leading-tight">Common questions and solutions</p></div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">Coming Soon</span>
              </div>
            </div>
          </div>

          {/* Tutorials */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <h2 className="text-sm font-bold text-[#0a2540]">Tutorials &amp; Training</h2>
              </div>
              <Link href="/watch-demo" className="text-[11px] text-sky-600 font-semibold hover:underline">View All →</Link>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Learn with step-by-step guides and examples.</p>
            <div className="flex-1 divide-y divide-slate-100">
              {([
                { label: "Getting Started with SAGAR NETRA 3D", sub: "Platform overview and basic navigation", col: "from-sky-600/60", href: "/watch-demo", text: "▶" },
                { label: "Exploring 3D Ocean Data", sub: "Visualize model outputs and in-situ observations", col: "from-emerald-600/60", href: "/explore", text: "3D" },
                { label: "Analyzing a Study Region", sub: "Select region, variables and time", col: "from-cyan-600/60", href: "/study-region", text: "📍" },
                { label: "Comparing Model with Observations", sub: "Analyze differences and validate data", col: "from-sky-500/60", href: "/observations", text: "📡" },
                { label: "Using Data Services (WMS/WCS/OPeNDAP)", sub: "Access data programmatically", col: "from-amber-600/60", href: "/data-services", text: "API" },
              ] as {label:string;sub:string;col:string;href:string;text:string}[]).map((t) => (
                <div key={t.label} onClick={() => router.push(t.href)} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/70 transition cursor-pointer">
                  <div className="w-14 h-10 rounded-lg bg-[#0a2540] flex items-center justify-center text-white text-[10px] font-bold shrink-0 relative overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${t.col} to-[#0a2540]`} />
                    <span className="relative z-10">{t.text}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-1">{t.label}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Datasets */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} /><path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg></div>
                <h2 className="text-sm font-bold text-[#0a2540]">Datasets &amp; Sample Data</h2>
              </div>
              <Link href="/data-services" className="text-[11px] text-sky-600 font-semibold hover:underline">View All →</Link>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Explore available datasets and sample files.</p>
            <div className="flex-1 divide-y divide-slate-100">
              {([
                { label: "Global Ocean Physics (CMEMS)", sub: "Temperature, Salinity, Currents, Sea Level", abbr: "GP", grad: "from-blue-600 via-sky-500 to-cyan-400", href: "/data-services" },
                { label: "Global Ocean Biogeochemistry (CMEMS)", sub: "Chlorophyll, Oxygen, Nutrients, pH", abbr: "BGC", grad: "from-emerald-600 via-teal-500 to-cyan-400", href: "/data-services" },
                { label: "INCOIS Regional Model (Indian Ocean)", sub: "Temperature, Currents, Sea Level", abbr: "IN", grad: "from-sky-700 via-blue-600 to-indigo-500", href: "/data-services" },
                { label: "Argo Float Profiles (Sample)", sub: "Temperature, Salinity, Pressure", abbr: "AR", grad: "from-violet-600 via-purple-500 to-sky-500", href: "/observations" },
                { label: "Glider Observations (Sample)", sub: "Temperature, Salinity, Chlorophyll", abbr: "GL", grad: "from-teal-600 via-emerald-500 to-cyan-400", href: "/observations" },
              ] as {label:string;sub:string;abbr:string;grad:string;href:string}[]).map((d) => (
                <div key={d.label} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/70 transition">
                  <div className={`w-9 h-9 rounded-lg shrink-0 bg-gradient-to-br ${d.grad} flex items-center justify-center text-white text-[10px] font-bold`}>{d.abbr}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{d.label}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{d.sub}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 font-mono mt-1 inline-block">NetCDF</span>
                  </div>
                  <Link href={d.href} className="text-slate-400 hover:text-sky-600 transition shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links + Need Help */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
                <h2 className="text-sm font-bold text-[#0a2540]">Quick Links</h2>
              </div>
              <div className="divide-y divide-slate-100">
                <Link href="/data-services" className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition group"><span className="text-xs font-medium text-slate-700 group-hover:text-sky-700">Data Services</span><svg className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></Link>
                <Link href="/data-services" className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition group"><span className="text-xs font-medium text-slate-700 group-hover:text-sky-700">API Documentation</span><svg className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></Link>
                <div className="px-4 py-2.5 flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-400">GitHub Repository</span><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-400">Coming Soon</span></div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-400">Example Notebooks</span><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-400">Coming Soon</span></div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer group"><span className="text-xs font-medium text-slate-700 group-hover:text-sky-700">Data Policy</span><svg className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer group"><span className="text-xs font-medium text-slate-700 group-hover:text-sky-700">Terms of Use</span><svg className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></div>
              </div>
            </div>
            <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
                <h3 className="text-sm font-bold text-[#0a2540]">Need Help?</h3>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">For technical support, data access queries or general information.</p>
              <button type="button" className="w-full py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                <span>Contact Us</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">

          {/* Publications */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
              <h2 className="text-sm font-bold text-[#0a2540]">Publications &amp; References</h2>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Key reports, research papers and references.</p>
            <div className="flex-1 divide-y divide-slate-100">
              {[
                { label: "SIH 2026 Problem Statement 26067", sub: "INCOIS · 2026" },
                { label: "Indian State of the Ocean Report", sub: "MoES · 2023" },
                { label: "Global Ocean Observing System (GOOS)", sub: "GOOS · 2022" },
              ].map((pub) => (
                <div key={pub.label} className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-slate-50/70 transition">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5"><svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                  <div><p className="text-xs font-semibold text-slate-800 leading-tight">{pub.label}</p><p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{pub.sub}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* External Resources */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg></div>
              <h2 className="text-sm font-bold text-[#0a2540]">External Resources</h2>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Useful links to partner organizations and data portals.</p>
            <div className="flex-1 divide-y divide-slate-100">
              {[
                { label: "Copernicus Marine Service (CMEMS)", sub: "marine.copernicus.eu", url: "https://marine.copernicus.eu" },
                { label: "NOAA Ocean Data", sub: "www.noaa.gov", url: "https://www.noaa.gov" },
                { label: "World Ocean Database (WOD)", sub: "www.ncei.noaa.gov", url: "https://www.ncei.noaa.gov" },
                { label: "Argo GDAC", sub: "argo.ucsd.edu", url: "https://argo.ucsd.edu" },
                { label: "INCOIS", sub: "www.incois.gov.in", url: "https://www.incois.gov.in" },
              ].map((r) => (
                <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition group">
                  <div><p className="text-xs font-semibold text-slate-800 group-hover:text-sky-700 leading-tight">{r.label}</p><p className="text-[10px] text-slate-500 leading-tight mt-0.5">{r.sub}</p></div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Tools & Utilities */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg></div>
              <h2 className="text-sm font-bold text-[#0a2540]">Tools &amp; Utilities</h2>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Download tools and example scripts.</p>
            <div className="flex-1 divide-y divide-slate-100">
              {[
                { label: "Python Example Scripts", sub: "Data access and visualization" },
                { label: "MATLAB Examples", sub: "Sample codes for model data" },
                { label: "QGIS Templates", sub: "Ocean data visualization templates" },
                { label: "Docker Configuration", sub: "Run the platform locally" },
              ].map((t) => (
                <div key={t.label} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    </div>
                    <div><p className="text-xs font-semibold text-slate-800 leading-tight">{t.label}</p><p className="text-[10px] text-slate-500 leading-tight">{t.sub}</p></div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">Coming Soon</span>
                </div>
              ))}
            </div>
          </div>

          {/* Community & Feedback */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
              <h2 className="text-sm font-bold text-[#0a2540]">Community &amp; Feedback</h2>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500">Share your feedback and contribute to make SAGAR NETRA 3D better.</p>
            <div className="flex-1 divide-y divide-slate-100">
              <div className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer">
                <div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div><span className="text-xs font-semibold text-slate-800">Report an Issue</span></div>
                <p className="text-[10px] text-slate-400 text-right">Found a bug or have a suggestion?</p>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer">
                <div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div><span className="text-xs font-semibold text-slate-800">Request a Feature</span></div>
                <p className="text-[10px] text-slate-400 text-right">Suggest new functionality</p>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer">
                <div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-md bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0 text-violet-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div><span className="text-xs font-semibold text-slate-800">Join the Discussion</span></div>
                <p className="text-[10px] text-slate-400 text-right">Be part of our community</p>
              </div>
              <div onClick={() => window.open("https://www.youtube.com/watch?v=HRV6rZuUDnc", "_blank")} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition cursor-pointer">
                <div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><span className="text-xs font-semibold text-slate-800">Watch Demo</span></div>
                <Link href="https://www.youtube.com/watch?v=HRV6rZuUDnc" target="_blank" className="text-[10px] text-sky-600 hover:underline">View →</Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t border-slate-200/80 bg-white mt-auto">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-600">Data Sources:</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />Copernicus Marine Service (CMEMS)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-600 inline-block" />INCOIS</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />NOAA</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />NCEI WOD</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />IFREMER</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200" />Resources Updated: 15 Feb 2026</span>
            <span className="hidden md:inline">|</span>
            <span className="text-slate-500">Last Updated: 15 Feb 2026, 12:30 UTC</span>
          </div>
        </div>
      </footer>

      {/* ── INFO MODAL ── */}
      <AnimatePresence>
        {infoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setInfoModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative z-10 max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3"><span className="text-2xl">{infoModal.icon}</span><div><h3 className="text-base font-bold text-[#0a2540]">{infoModal.title}</h3><p className="text-xs text-slate-500">{infoModal.subtitle}</p></div></div>
                <button type="button" onClick={() => setInfoModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer">✕</button>
              </div>
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed border-t border-b border-slate-100 py-3">
                {infoModal.sections.map((sec, i) => (<div key={i}><h4 className="font-semibold text-slate-900 mb-0.5">{sec.heading}</h4><p>{sec.body}</p></div>))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setInfoModal(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">Close</button>
                {infoModal.ctaText && infoModal.ctaAction && (<button type="button" onClick={() => { setInfoModal(null); infoModal.ctaAction?.() }} className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-sm transition cursor-pointer">{infoModal.ctaText}</button>)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
