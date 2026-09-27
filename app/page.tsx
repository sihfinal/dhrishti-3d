"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { useOcean } from "@/lib/store"

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
  ctaText?: string
  ctaAction?: () => void
}

export default function LandingPage() {
  const router = useRouter()
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  function launchExplorer(mode: "volume" | "globe" = "volume") {
    useOcean.getState().setViewMode(mode)
    router.push(mode === "globe" ? "/explore?view=globe" : "/explore")
  }

  const opAppDetails: Record<string, InfoModalData> = {
    hazard: {
      title: "Hazard Assessment",
      subtitle: "Understand ocean physical conditions, thermal patterns, salinity, and potential marine hazards.",
      icon: "⚠️",
      sections: [
        {
          heading: "Thermal Gradients & Haline Stratification",
          body: "Integrates depth-resolved temperature and salinity distributions from CMEMS physical models to analyze thermocline gradients and ocean physical states across the Indian Ocean basin.",
        },
        {
          heading: "Hydrodynamic Flow & In-situ Float Overlays",
          body: "Evaluates surface and subsurface current velocities combined with in-situ Argo, Glider, and CTD float observations to support environmental situational awareness for maritime safety and coastal management.",
        },
      ],
      ctaText: "Explore Hazard Data in 3D →",
      ctaAction: () => router.push("/explore?var=temperature"),
    },
    sar: {
      title: "Search & Rescue (SAR)",
      subtitle: "Analyze ocean current vectors and hydrodynamic velocity fields to support maritime operational planning.",
      icon: "🚢",
      sections: [
        {
          heading: "Current Velocity & Speed Magnitude",
          body: "Calculates current velocity magnitude via Speed = sqrt(uo² + vo²) from zonal (uo) and meridional (vo) velocity components to visualize ocean circulation pathways across depth strata.",
        },
        {
          heading: "Maritime Situational Support",
          body: "Directly integrates depth-resolved current flow fields with in-situ observation platform locations and Indian EEZ boundaries for search and rescue planning.",
        },
      ],
      ctaText: "Launch Current Vectors in 3D →",
      ctaAction: () => router.push("/explore?var=currents"),
    },
    fishery: {
      title: "Fishery Advisory",
      subtitle: "Explore marine environmental indicators and biophysical ocean conditions.",
      icon: "🐟",
      sections: [
        {
          heading: "Chlorophyll-a & Thermal Fronts",
          body: "Visualizes CMEMS biogeochemical chlorophyll-a concentration alongside sea surface temperature gradients to identify upwelling features and nutrient-rich zones.",
        },
        {
          heading: "Biophysical Marine Indicators",
          body: "Provides researchers and maritime stakeholders with depth-resolved oceanographic indicators (chlorophyll, SST, salinity, and currents) across the Indian Ocean.",
        },
      ],
      ctaText: "Visualize Chlorophyll Layers →",
      ctaAction: () => router.push("/explore?var=chlorophyll"),
    },
    climate: {
      title: "Climate Monitoring",
      subtitle: "Visualize depth-resolved ocean state variability across the model archive.",
      icon: "📊",
      sections: [
        {
          heading: "Indian Ocean Basin Variability",
          body: "Examines spatial and depth-resolved thermal and haline variability across the Arabian Sea, Bay of Bengal, and Equatorial Indian Ocean using available model archive files (Jan–Mar 2026).",
        },
        {
          heading: "In-situ Profile Verification",
          body: "Cross-validates numerical model layers against in-situ Argo, Glider, and CTD soundings down to 1000m depth for scientific analysis and baseline ocean monitoring.",
        },
      ],
      ctaText: "Analyze Ocean Profiles in 3D →",
      ctaAction: () => router.push("/explore?var=temperature"),
    },
  }

  const navModals: Record<string, InfoModalData> = {
    observations: {
      title: "In-situ Ocean Observations",
      subtitle: "In-situ observational platforms across the Indian Ocean basin.",
      icon: "📡",
      sections: [
        {
          heading: "Autonomous Argo Floats (460+ Active)",
          body: "Autonomous profilers descending to 2000m depth every 10 days, delivering CTD and bio-geochemical profiles.",
        },
        {
          heading: "Gliders & Ship-borne CTD Transects",
          body: "High-resolution spatial cross-sections along critical maritime corridors and EEZ boundaries.",
        },
      ],
      ctaText: "Inspect In-situ Platforms →",
      ctaAction: () => launchExplorer("globe"),
    },
    dataServices: {
      title: "Data Services & OGC Interoperability",
      subtitle: "Standardized geospatial ocean data feeds adhering to international ocean standards.",
      icon: "🗄️",
      sections: [
        {
          heading: "NetCDF-4 & CF-1.8 Compliance",
          body: "Fully compliant CF metadata conventions supporting multi-dimensional slicing across latitude, longitude, depth, and time coordinates.",
        },
        {
          heading: "Open Geospatial Consortium (OGC) Standards",
          body: "Direct WMS, WFS, and ERDDAP endpoints ensuring seamless interoperability with INCOIS RSMC and global oceanographic portals.",
        },
      ],
      ctaText: "Open 3D Data Services →",
      ctaAction: () => launchExplorer("volume"),
    },
    resources: {
      title: "Documentation & Resources",
      subtitle: "User guides, scientific methodology, and Hackathon problem statement specifications.",
      icon: "📖",
      sections: [
        {
          heading: "SIH 2026 Problem Statement 26067",
          body: "3D Visualization of Ocean Model Data and in-situ Observations by INCOIS & Ministry of Earth Sciences.",
        },
        {
          heading: "User Manual & Guided Tour",
          body: "Interactive walkthroughs covering volume slicing, isosurfaces, current vector densities, and model-vs-observation comparisons.",
        },
      ],
      ctaText: "Launch Interactive Explorer →",
      ctaAction: () => launchExplorer("volume"),
    },
  }

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-900">
      
      {/* ────────────────────────────────────────────────────────────
          1. TOP INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        
        {/* Row 1: Institutional Badges, Tagline, Search, User */}
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            
            {/* Left: MoES Emblem & INCOIS Logo */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center">
                <Image
                  src="/landing/header-emblem-moes.png"
                  alt="Ministry of Earth Sciences, Government of India"
                  width={220}
                  height={64}
                  priority
                  unoptimized
                  className="h-10 sm:h-11 w-auto object-contain"
                />
              </div>

              {/* Vertical divider */}
              <div className="h-8 w-[1px] bg-slate-200" />

              <div className="flex items-center">
                <Image
                  src="/landing/header-incois.png"
                  alt="INCOIS - Indian National Centre for Ocean Information Services"
                  width={340}
                  height={64}
                  priority
                  unoptimized
                  className="h-10 sm:h-11 w-auto object-contain"
                />
              </div>
            </div>

            {/* Right: National Tagline + Tricolor Swirl Ribbon */}
            <div className="hidden md:flex items-center justify-end flex-1">
              <Image
                src="/landing/header-tagline-swirl.png"
                alt="Oceans for a Safer, Sustainable and Prosperous India"
                width={400}
                height={70}
                priority
                unoptimized
                className="h-10 sm:h-[52px] w-auto object-contain"
              />
            </div>

          </div>
        </div>

        {/* Row 2: Institutional Navbar */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-[38px] sm:h-[40px]">
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5 w-full">
                {/* Home (Active) */}
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span>Home</span>
                  {/* Blue Active Indicator Bar */}
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </button>

                {/* Study Region */}
                <button
                  onClick={() => router.push("/study-region")}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Study Region</span>
                </button>

                {/* Explorer */}
                <button
                  onClick={() => launchExplorer("volume")}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                    <path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  <span>Explorer</span>
                </button>

                {/* Observations */}
                <Link
                  href="/observations"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8M17 7h4v4" />
                  </svg>
                  <span>Observations</span>
                </Link>

                {/* Data Services */}
                <Link
                  href="/data-services"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
                    <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  <span>Data Services</span>
                </Link>

                {/* Operational Applications */}
                <Link
                  href="/operational-applications"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
                  </svg>
                  <span>Operational Applications</span>
                </Link>

                {/* Resources */}
                <Link
                  href="/resources"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Resources</span>
                </Link>
              </nav>

            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────
          2. HERO SECTION (WITH BATHYMETRIC MAP & 4 STATS CARDS)
      ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-white pt-0 sm:pt-0.5 pb-1.5 flex-1">
        {/* Bathymetric Indian Ocean Map Backdrop on Right */}
        <div className="absolute top-0 right-0 bottom-0 w-full lg:w-[68%] xl:w-[65%] pointer-events-none z-0">
          <Image
            src="/landing/hero-map-backdrop.png"
            alt="Indian Ocean Bathymetry and EEZ Demarcations"
            fill
            priority
            unoptimized
            className="object-cover object-right"
          />
        </div>

        <div className="relative z-10 max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-between">
          
          {/* Hero Left Content Column */}
          <div className="max-w-xl xl:max-w-2xl pt-0">
            
            {/* Metadata Badge */}
            <div className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-[#0066cc] uppercase mt-1 sm:mt-1.5 mb-1.5">
              SIH 26067 &nbsp;|&nbsp; INCOIS &nbsp;|&nbsp; MINISTRY OF EARTH SCIENCES
            </div>

            {/* Main Title: SAGAR NETRA 3D — The Ocean Eye */}
            <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-black tracking-tight leading-[1.06]">
              <span className="bg-gradient-to-r from-[#03254c] via-[#0284c7] to-[#00a896] bg-clip-text text-transparent">
                SagarNetra - 3D
              </span>
              <span className="block text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#0284c7] mt-1 tracking-normal">
              </span>
            </h1>

            {/* Full Acronym & Subtitle with Blue Underline Accent */}
            <div className="mt-2.5">
              <p className="text-xs sm:text-sm font-bold text-[#0066cc] tracking-wide mb-1">
                Sagar Numerical &amp; Environmental Three-dimensional Rendering Architecture
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-[#0f2942] tracking-normal">
                Explore &nbsp;•&nbsp; Analyze &nbsp;•&nbsp; Understand &nbsp;•&nbsp; For a Safer Tomorrow
              </h2>
              {/* Short blue horizontal line accent */}
              <div className="w-12 h-1 bg-[#0284c7] rounded-full mt-2" />
            </div>

            {/* Description Copy */}
            <p className="mt-4 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-lg font-normal">
              An interactive 3D visualization platform for ocean model outputs and in-situ observations, enabling deeper insights across space, depth and time for a resilient and sustainable blue economy.
            </p>

            {/* Action Buttons: Launch 3D Explorer & Watch Demo */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {/* Primary CTA: Launch 3D Explorer */}
              <button
                onClick={() => launchExplorer("volume")}
                className="w-48 sm:w-52 h-11 sm:h-12 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white border border-transparent font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
              >
                {/* Crosshair Compass Icon */}
                <svg className="w-4.5 h-4.5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <polygon points="12,7 15,12 12,17 9,12" fill="white" />
                  <line x1="12" y1="3" x2="12" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="18" x2="12" y2="21" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="6" y2="12" strokeWidth="2" strokeLinecap="round" />
                  <line x1="18" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Launch 3D Explorer</span>
              </button>

              {/* Secondary CTA: Watch Demo */}
              <button
                onClick={() => router.push("/watch-demo")}
                className="w-48 sm:w-52 h-11 sm:h-12 rounded-xl bg-white hover:bg-blue-50/70 text-[#0f2942] border border-blue-400/90 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
              >
                {/* Solid Blue Play Circle Icon */}
                <div className="w-4.5 h-4.5 rounded-full bg-[#0066cc] flex items-center justify-center shrink-0">
                  <svg className="w-2 h-2 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 3.5v9l7-4.5-7-4.5z" />
                  </svg>
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

          </div>

          {/* ────────────────────────────────────────────────────────────
              4 FLOATING STATISTICS CARDS (COMPACT & LEFT-ALIGNED)
          ──────────────────────────────────────────────────────────── */}
          <div className="mt-4 sm:mt-4.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-2xl xl:max-w-[720px]">
            
            {/* Card 1: 4+ Data Sources */}
            <div className="rounded-xl bg-white/95 backdrop-blur-sm border border-slate-300 shadow-[0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] transition-all p-2.5 sm:p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <ellipse cx="12" cy="5" rx="8" ry="2.5" strokeWidth="2" />
                  <path strokeWidth="2" d="M4 5v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
                  <path strokeWidth="2" d="M4 10v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-5" />
                  <path strokeWidth="2" d="M4 15v4c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-bold text-[#0b2d54] tracking-tight leading-tight">4+</div>
                <div className="text-xs font-bold text-slate-800 leading-tight">Data Sources</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">CMEMS, Argo, Glider, CTD</div>
              </div>
            </div>

            {/* Card 2: 25K+ Observations */}
            <div className="rounded-xl bg-white/95 backdrop-blur-sm border border-slate-300 shadow-[0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] transition-all p-2.5 sm:p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-bold text-[#0b2d54] tracking-tight leading-tight">25K+</div>
                <div className="text-xs font-bold text-slate-800 leading-tight">Observations</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">Argo, Glider, CTD, BGC</div>
              </div>
            </div>

            {/* Card 3: 4 Key Variables */}
            <div className="rounded-xl bg-white/95 backdrop-blur-sm border border-slate-300 shadow-[0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] transition-all p-2.5 sm:p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-[#7c3aed]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-bold text-[#0b2d54] tracking-tight leading-tight">4</div>
                <div className="text-xs font-bold text-slate-800 leading-tight">Key Variables</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">Temp, Salt, UV, Chl-a</div>
              </div>
            </div>

            {/* Card 4: 90 Days Model Archive */}
            <div className="rounded-xl bg-white/95 backdrop-blur-sm border border-slate-300 shadow-[0_2px_5px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] transition-all p-2.5 sm:p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-[#ea580c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <polyline points="12,7 12,12 15.5,14" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-bold text-[#0b2d54] tracking-tight leading-tight">90 Days</div>
                <div className="text-xs font-bold text-slate-800 leading-tight">Model Archive</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">High-res NetCDF data</div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          3. OPERATIONAL APPLICATIONS SECTION
      ──────────────────────────────────────────────────────────── */}
      <section id="operational-applications" className="relative z-10 w-full bg-gradient-to-b from-[#f0f5fa] via-[#f0f5fa] to-[#f0f5fa]/90 pt-1.3 sm:pt-1.25 pb-0">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6">
            
            {/* Left Title Column */}
            <div className="w-full lg:w-52 shrink-0">
              <h3 className="text-lg sm:text-xl font-black text-[#0a2e5c] leading-tight">
                Operational<br />Applications
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug">
                From data to decisions for a safer, sustainable ocean future.
              </p>
            </div>

            {/* 4 Pastel Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 flex-1 w-full">
              
              {/* Card 1: Hazard Assessment */}
              <div
                onClick={() => setInfoModal(opAppDetails.hazard)}
                className="rounded-xl bg-[#faf5f7] border border-[#fecdd3] p-2.5 sm:p-3 flex flex-col justify-between hover:border-red-400 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold">
                      <span className="text-red-600">Hazard </span>
                      <span className="text-[#0a2e5c]">Assessment</span>
                    </h4>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-1 leading-snug">
                    Understand ocean conditions and potential hazards
                  </p>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <span className="text-[10px] font-bold">→</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Search & Rescue */}
              <div
                onClick={() => setInfoModal(opAppDetails.sar)}
                className="rounded-xl bg-[#f1f7fe] border border-[#bfdbfe] p-2.5 sm:p-3 flex flex-col justify-between hover:border-sky-400 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17h18M4 17l2 4h12l2-4M7 17V9l5-5 5 5v8" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">
                      Search & Rescue
                    </h4>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-1 leading-snug">
                    Analyze ocean currents and support operations
                  </p>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <div className="w-5 h-5 rounded-full bg-sky-100 text-[#0284c7] flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                    <span className="text-[10px] font-bold">→</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Fishery Advisory */}
              <div
                onClick={() => setInfoModal(opAppDetails.fishery)}
                className="rounded-xl bg-[#f2fafa] border border-[#a7f3d0] p-2.5 sm:p-3 flex flex-col justify-between hover:border-emerald-400 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-[#059669]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.5 4.5c-3.3 0-6.2 1.8-7.8 4.5l-2.4-1.2v4.4l2.4-1.2C7.3 13.7 10.2 15.5 13.5 15.5c3.3 0 6.5-2.5 6.5-5.5s-3.2-5.5-6.5-5.5zm-1.5 6a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">
                      Fishery Advisory
                    </h4>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-1 leading-snug">
                    Explore productive marine environments
                  </p>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#059669] flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <span className="text-[10px] font-bold">→</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Climate Monitoring */}
              <div
                onClick={() => setInfoModal(opAppDetails.climate)}
                className="rounded-xl bg-[#f7f7fe] border border-[#e9d5ff] p-2.5 sm:p-3 flex flex-col justify-between hover:border-purple-400 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-[#7c3aed]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">
                      Climate Monitoring
                    </h4>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-1 leading-snug">
                    Visualize long-term ocean variability
                  </p>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <div className="w-5 h-5 rounded-full bg-purple-100 text-[#7c3aed] flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <span className="text-[10px] font-bold">→</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          4. LOWER OCEAN PANORAMA BANNER (COASTAL LIGHTHOUSE & SHIP)
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full relative z-0 bg-[#eef5fa] overflow-hidden -mt-3 sm:-mt-5 xl:-mt-6">
        <div className="max-w-[1536px] mx-auto">
          <Image
            src="/landing/bottom-panorama.png"
            alt="Coastal Lighthouse, Knowledge of the Ocean Quote, and INCOIS Research Ship Banner"
            width={1536}
            height={192}
            priority
            unoptimized
            className="w-full h-auto object-cover block shadow-xs"
          />
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          5. INTERACTIVE DEMO VIDEO MODAL
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {videoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={() => setVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#0066cc] flex items-center justify-center text-white">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4 3.5v9l7-4.5-7-4.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                      Watch SAGAR NETRA 3D in Action
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Interactive Walkthrough · SIH 26067 · INCOIS
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setVideoModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Video Player Container */}
              <div className="w-full aspect-video bg-black relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  src="/landing/demo-video.mp4"
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Video Walkthrough Chapters */}
              <div className="p-3.5 sm:p-4 bg-slate-900/95 border-t border-slate-800">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Demonstrated Capabilities
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1.5 rounded-md">
                    <span className="text-sky-400 font-mono text-[10px]">00:15</span>
                    <span className="truncate">Indian Ocean Region</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1.5 rounded-md">
                    <span className="text-sky-400 font-mono text-[10px]">00:35</span>
                    <span className="truncate">3D Depth Slicing</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1.5 rounded-md">
                    <span className="text-sky-400 font-mono text-[10px]">01:05</span>
                    <span className="truncate">Argo & Observations</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1.5 rounded-md">
                    <span className="text-sky-400 font-mono text-[10px]">01:50</span>
                    <span className="truncate">Operational Apps</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">
                    Duration: ~2 Minutes 38 Seconds
                  </span>
                  <button
                    onClick={() => {
                      setVideoModalOpen(false)
                      launchExplorer("volume")
                    }}
                    className="rounded-lg bg-[#0066cc] hover:bg-[#0052a3] text-white px-3.5 py-1 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Try 3D Explorer Now</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────
          6. SECTION INFORMATION MODAL
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInfoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{infoModal.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0a2e5c]">{infoModal.title}</h3>
                    <p className="text-xs text-slate-500">{infoModal.subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => setInfoModal(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mt-2">
                {infoModal.sections.map((sec, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <h4 className="text-xs font-bold text-[#0b2d54] uppercase tracking-wide">
                      {sec.heading}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {sec.body}
                    </p>
                  </div>
                ))}
              </div>

              {infoModal.ctaText && infoModal.ctaAction && (
                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      const action = infoModal.ctaAction
                      setInfoModal(null)
                      if (action) action()
                    }}
                    className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white px-5 py-2 text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    {infoModal.ctaText}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
