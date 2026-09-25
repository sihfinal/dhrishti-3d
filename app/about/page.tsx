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

export default function AboutPage() {
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
        { heading: "Executive Vision", body: "An interactive, web-based 3D visualization and analytical workstation built to democratize ocean intelligence for researchers, disaster managers, and the blue economy." },
        { heading: "Technology Stack", body: "Engineered with Next.js App Router, Three.js / WebGL, Fast NetCDF-4/xarray backend engines, and responsive institutional design." },
      ],
      ctaText: "Experience the Workstation →",
      ctaAction: () => launchExplorer("volume"),
    },
  }

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans flex flex-col selection:bg-sky-100 selection:text-sky-900">

      {/* ── 1. INSTITUTIONAL HEADER ── */}
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
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
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
                <Link href="/resources" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span>Resources</span>
                </Link>
                {/* About — ACTIVE */}
                <Link href="/about" className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><path strokeLinecap="round" strokeWidth={1.8} d="M12 16v-4m0-4h.01" /></svg>
                  <span>About</span>
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
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

      {/* ── 2. HERO SECTION ── */}
      <section className="relative w-full overflow-hidden bg-[#071d36] text-white select-none py-8 sm:py-10 shadow-sm shrink-0">
        <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity pointer-events-none" style={{ backgroundImage: "url('/landing/study-region-bg-perfect.jpg')", backgroundPosition: "center 40%" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030e1c] via-[#071d36]/90 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex flex-col max-w-3xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                About SAGAR NETRA 3D — The Ocean Eye
              </h1>
              <p className="text-xs sm:text-sm font-bold text-sky-300 mt-1">
                Sagar Numerical &amp; Environmental Three-dimensional Rendering Architecture
              </p>
              <p className="text-base sm:text-lg font-semibold text-sky-200 mt-1">
                Visualizing the Ocean. Empowering Decisions.
              </p>
              <p className="text-xs sm:text-[13px] text-slate-200/90 mt-2.5 leading-relaxed font-normal">
                SAGAR NETRA 3D is a web-based interactive platform developed to visualize and analyze numerical ocean model outputs and in-situ observations for the Indian Ocean region. It integrates diverse data sources into a unified 3D visualization environment to support research, operational applications, and evidence-based decision making.
              </p>
            </div>

            <div className="hidden lg:flex flex-col items-end text-right shrink-0 max-w-xs">
              <span className="text-base font-semibold text-sky-300 italic">
                Our Ocean • Our Responsibility • A Shared Future
              </span>
              <div className="mt-2 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-[11px] text-slate-200 leading-relaxed text-right shadow-sm">
                &ldquo;Better ocean information for a safer, sustainable and prosperous India.&rdquo;
              </div>
            </div>
          </div>

          {/* Hero 4 Feature Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/10">
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 text-sky-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Explore Data</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">Model + Observations</p>
              </div>
            </div>

            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Enable Research</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">Science for Society</p>
              </div>
            </div>

            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 text-cyan-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Support Decision Making</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">Safer Coasts, Resilient Oceans</p>
              </div>
            </div>

            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 text-indigo-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Build a Sustainable Future</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">Data for Generations</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. MAIN WORKSPACE ── */}
      <main className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 flex flex-col gap-4">

        {/* ── ROW 1: Mission / Vision / Impact / Ocean Quote ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Mission */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-2.5 hover:border-sky-300 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><circle cx="12" cy="12" r="6" strokeWidth={1.8} /><circle cx="12" cy="12" r="2" strokeWidth={1.8} /></svg>
              </div>
              <h3 className="text-sm font-bold text-[#0a2540]">Our Mission</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              To provide easy access to integrated ocean information and visualization tools that support research, operational services, and societal applications for a safer and more sustainable ocean.
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-2.5 hover:border-sky-300 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0 text-cyan-600">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-[#0a2540]">Our Vision</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              To be a global leader in ocean information services, enabling informed decisions for the sustainable use of ocean resources.
            </p>
          </div>

          {/* Impact */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-2.5 hover:border-sky-300 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-[#0a2540]">Our Impact</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Supporting disaster preparedness, marine resource management, climate resilience, and a healthier ocean through open and accessible ocean information.
            </p>
          </div>

          {/* Ocean Quote Card */}
          <div className="relative rounded-2xl overflow-hidden border border-sky-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-gradient-to-br from-sky-100 via-sky-50 to-cyan-100 p-4 flex flex-col justify-center items-center text-center">
            <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('/landing/ocean-quote-banner.jpg')" }} />
            <span className="relative z-10 text-base sm:text-lg font-extrabold text-[#0a2540] italic leading-tight drop-shadow-xs">
              &ldquo;Science for a Smarter, Safer Blue Tomorrow&rdquo;
            </span>
          </div>

        </div>

        {/* ── ROW 2: About INCOIS & About SAGAR NETRA 3D — The Ocean Eye Project ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left: About INCOIS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-4 hover:border-sky-300 transition">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m4 10V11m-4 0h4" /></svg>
                </div>
                <h2 className="text-base font-bold text-[#0a2540]">About INCOIS</h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  The Indian National Centre for Ocean Information Services (INCOIS) is an autonomous body under the Ministry of Earth Sciences, Government of India. INCOIS provides ocean information and advisory services, develops advanced ocean technologies, and supports various national programs for the sustainable use of ocean resources.
                </p>
                <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden relative shrink-0 border border-slate-200 shadow-xs">
                  <Image src="/landing/incois-building-ref.jpg" alt="INCOIS Headquarters, Hyderabad" fill unoptimized className="object-cover" />
                </div>
              </div>

              <div className="pt-1">
                <a href="https://www.incois.gov.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#0284c7] text-xs font-semibold transition cursor-pointer">
                  <span>Visit INCOIS</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </a>
              </div>
            </div>

            {/* Bottom Fact Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center select-none">
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <span className="block text-sm font-bold text-[#0a2540]">2001</span>
                <span className="text-[10px] text-slate-500 font-medium">Established</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <span className="block text-sm font-bold text-[#0a2540]">Hyderabad</span>
                <span className="text-[10px] text-slate-500 font-medium">Headquarters</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <span className="block text-sm font-bold text-[#0a2540]">Applications</span>
                <span className="text-[10px] text-slate-500 font-medium">for Multiple Sectors</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <span className="block text-sm font-bold text-[#0a2540]">Global Partnerships</span>
                <span className="text-[10px] text-slate-500 font-medium">and Collaborations</span>
              </div>
            </div>
          </div>

          {/* Right: About SAGAR NETRA 3D Project */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-4 hover:border-sky-300 transition">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h2 className="text-base font-bold text-[#0a2540]">About SAGAR NETRA 3D — The Ocean Eye</h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  <strong>SAGAR NETRA 3D</strong> (<em>Sagar Numerical &amp; Environmental Three-dimensional Rendering Architecture</em>) is developed as part of Smart India Hackathon (SIH) 2026 Problem Statement 26067, in collaboration with INCOIS (MoES). The platform integrates numerical ocean model outputs and in-situ observations into an interactive 3D web-based visualization platform.
                </p>
                <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden relative shrink-0 border border-slate-200 shadow-xs">
                  <Image src="/landing/indian-ocean-inset.jpg" alt="Indian Ocean Region - Our Shared Heritage" fill unoptimized className="object-cover" />
                </div>
              </div>

              {/* Problem Statement Card */}
              <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-300 flex items-center justify-center shrink-0 text-sky-700 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold text-[#0a2540]">Problem Statement</h4>
                  <p className="text-[11px] text-slate-700 leading-snug mt-0.5">
                    SIH 26067 &mdash; Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations.
                  </p>
                </div>
              </div>
            </div>

            {/* Tags Bar */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 select-none">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">Indian Ocean Region</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">3D Visualization</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Model + Observations</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Open Standards</span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Real-world Applications</span>
            </div>
          </div>

        </div>

        {/* ── ROW 3: Key Features / Our Team / Acknowledgements ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Key Features (5 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col gap-3 hover:border-sky-300 transition">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-[#0a2540]">Key Features</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
                  3D Visualization
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Interactive exploration of temperature, salinity, currents, chlorophyll and more.
                </p>
              </div>

              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Multi-source Integration
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Numerical models + in-situ observations (Argo, Glider, CTD, BGC).
                </p>
              </div>

              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
                  User-friendly Interface
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Intuitive workstation tools for exploration and depth slice analysis.
                </p>
              </div>

              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                  Open Data Access
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  WMS, WCS, OPeNDAP, REST APIs.
                </p>
              </div>

              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                  Operational Applications
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Hazard, SAR, Fishery, Climate support.
                </p>
              </div>

              <div className="flex flex-col gap-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                  Support for Research &amp; Policy
                </span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Reliable, accessible and standard-compliant data.
                </p>
              </div>
            </div>
          </div>

          {/* Our Team (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-3 hover:border-sky-300 transition">
            <div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h3 className="text-sm font-bold text-[#0a2540]">Our Team</h3>
              </div>
              <p className="text-[10px] text-slate-500">A team of passionate students working towards a data-driven, safer and more sustainable ocean.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center select-none">
              {[
                { name: "Team Member 1", role: "Team Lead", sub: "(Full Stack)" },
                { name: "Team Member 2", role: "Visualization", sub: "(Frontend)" },
                { name: "Team Member 3", role: "Data Processing", sub: "(Backend)" },
                { name: "Team Member 4", role: "Scientific Integration", sub: "(Model & Obs)" },
                { name: "Team Member 5", role: "UI/UX &", sub: "Documentation" },
                { name: "Team Member 6", role: "Testing &", sub: "Deployment" },
              ].map((m, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-2 border border-slate-100 flex flex-col items-center gap-1.5 hover:bg-sky-50/50 transition">
                  <div className="w-10 h-10 rounded-full bg-sky-100/70 border border-sky-200 text-sky-700 flex items-center justify-center text-xs font-bold shadow-xs">
                    👤
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[#0a2540] leading-tight">{m.name}</span>
                    <span className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">{m.role}</span>
                    <span className="text-[8px] text-slate-400 leading-tight">{m.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acknowledgements (3 cols) */}
          <div className="lg:col-span-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-3 hover:border-sky-300 transition">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                </div>
                <h3 className="text-sm font-bold text-[#0a2540]">Acknowledgements</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                We sincerely thank INCOIS, Ministry of Earth Sciences, and all data providers for their support and valuable resources.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-around gap-2 select-none">
              <Image src="/landing/header-emblem-moes.png" alt="MoES Logo" width={140} height={40} unoptimized className="h-8 w-auto object-contain" />
              <div className="h-6 w-[1px] bg-slate-200" />
              <Image src="/landing/header-incois.png" alt="INCOIS Logo" width={160} height={40} unoptimized className="h-8 w-auto object-contain" />
            </div>
          </div>

        </div>
      </main>

      {/* ── 4. INSTITUTIONAL FOOTER ── */}
      <footer className="w-full border-t border-slate-200/80 bg-white mt-auto">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-600">Data Sources:</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />Copernicus Marine Service (CMEMS)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />NOAA</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />NCEI WOD</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />Argo GDAC</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />IFREMER</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200" />
              Built for a Safer, Healthier and More Sustainable Ocean.
            </span>
            <span className="hidden md:inline">|</span>
            <span className="text-slate-500">Last Updated: 15 Feb 2026, 12:30 UTC</span>
          </div>
        </div>
      </footer>

      {/* ── 5. INFO MODAL ── */}
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
