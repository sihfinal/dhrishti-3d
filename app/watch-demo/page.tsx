"use client"

import { useState, useRef, useEffect } from "react"
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

interface Chapter {
  id: number
  timeStr: string
  seconds: number
  title: string
  subtitle: string
}

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    timeStr: "00:00",
    seconds: 0,
    title: "Introduction",
    subtitle: "Overview of SAGAR NETRA 3D",
  },
  {
    id: 2,
    timeStr: "00:15",
    seconds: 15,
    title: "Study Region",
    subtitle: "Exploring the Indian Ocean",
  },
  {
    id: 3,
    timeStr: "00:35",
    seconds: 35,
    title: "3D Visualization",
    subtitle: "Temperature, Salinity, Currents, Chlorophyll",
  },
  {
    id: 4,
    timeStr: "01:05",
    seconds: 65,
    title: "In-situ Observations",
    subtitle: "Argo, Glider, CTD, BGC",
  },
  {
    id: 5,
    timeStr: "01:30",
    seconds: 90,
    title: "Model vs Observation",
    subtitle: "Example comparison and analysis",
  },
  {
    id: 6,
    timeStr: "01:50",
    seconds: 110,
    title: "Operational Applications",
    subtitle: "Hazard, Fisheries, Search & Rescue",
  },
  {
    id: 7,
    timeStr: "02:15",
    seconds: 135,
    title: "Data Sources & Interoperability",
    subtitle: "CMEMS, WOD and more",
  },
  {
    id: 8,
    timeStr: "02:35",
    seconds: 155,
    title: "Conclusion",
    subtitle: "Explore. Analyze. Understand.",
  },
]

export default function WatchDemoPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(158) // 2m 38s default if metadata pending
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeChapterId, setActiveChapterId] = useState(1)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    useOcean.getState().setViewMode("volume")
    router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  function launchExplorer(mode: "volume" | "globe" = "volume") {
    useOcean.getState().setViewMode(mode)
    router.push(mode === "globe" ? "/explore?view=globe" : "/explore")
  }

  // Format seconds to mm:ss
  function formatTime(secs: number): string {
    if (isNaN(secs) || secs < 0) return "0:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  // Toggle Play / Pause
  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Seek video
  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Seek to specific chapter
  function seekToChapter(chapter: Chapter) {
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.seconds
      setCurrentTime(chapter.seconds)
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  // Toggle Mute
  function toggleMute() {
    if (!videoRef.current) return
    const nextMuted = !isMuted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  // Volume Change
  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      const muted = val === 0
      videoRef.current.muted = muted
      setIsMuted(muted)
    }
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!videoContainerRef.current) return
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Sync video time updates and active chapter
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onTimeUpdate() {
      if (!video) return
      const current = video.currentTime
      setCurrentTime(current)

      // Find corresponding chapter
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        if (current >= CHAPTERS[i].seconds - 0.5) {
          setActiveChapterId(CHAPTERS[i].id)
          break
        }
      }
    }

    function onLoadedMetadata() {
      if (!video) return
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration)
      }
    }

    function onPlay() {
      setIsPlaying(true)
    }

    function onPause() {
      setIsPlaying(false)
    }

    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }

    video.addEventListener("timeupdate", onTimeUpdate)
    video.addEventListener("loadedmetadata", onLoadedMetadata)
    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    document.addEventListener("fullscreenchange", onFullscreenChange)

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate)
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
    }
  }, [])

  const navModals: Record<string, InfoModalData> = {
    observations: {
      title: "In-situ Ocean Observations",
      subtitle: "Real-time and archived observational platforms across the Indian Ocean basin.",
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
    about: {
      title: "About SAGAR NETRA 3D — The Ocean Eye",
      subtitle: "Ministry of Earth Sciences · INCOIS · Smart India Hackathon 2026",
      icon: "🇮🇳",
      sections: [
        {
          heading: "Executive Vision",
          body: "An interactive, web-based 3D visualization and analytical workstation built to democratize ocean intelligence for researchers, disaster managers, and the blue economy.",
        },
        {
          heading: "Technology Stack",
          body: "Engineered with Next.js App Router, Three.js / WebGL, Fast NetCDF-4/xarray backend engines, and responsive institutional design.",
        },
      ],
      ctaText: "Experience the Workstation →",
      ctaAction: () => launchExplorer("volume"),
    },
  }

  return (
    <div className="min-h-screen w-full bg-[#fbfdff] text-slate-900 font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-900">
      
      {/* ────────────────────────────────────────────────────────────
          1. COMMON INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        
        {/* Row 1: Institutional Badges, Tagline, Search, User */}
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            
            {/* Left: MoES Emblem & INCOIS Logo */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
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

              <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
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

            {/* Center: National Tagline + Tricolor Swirl Ribbon */}
            <div className="hidden xl:flex items-center justify-center flex-1 px-4">
              <Image
                src="/landing/header-tagline-swirl.png"
                alt="Oceans for a Safer, Sustainable and Prosperous India"
                width={400}
                height={70}
                priority
                unoptimized
                className="h-[52px] sm:h-[54px] w-auto object-contain -translate-x-24"
              />
            </div>

            {/* Right: Search Pill Input & User Avatar */}
            <div className="flex items-center gap-3 shrink-0">
              <form onSubmit={handleSearch} className="relative hidden md:flex items-center">
                <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-1 w-60 lg:w-64 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search datasets, variables, regions..."
                    className="w-full text-xs text-slate-700 bg-transparent placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="ml-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                    title="Search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </form>

              {/* User Avatar Circle */}
              <button
                onClick={() => setInfoModal(navModals.about)}
                className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer"
                title="User Profile & Ministry Session"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Row 2: Institutional Navbar (Home is NOT active) */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
                {/* Home */}
                <button
                  onClick={() => router.push("/")}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span>Home</span>
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
                    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
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

                {/* About */}
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

              {/* Right: Launch Explorer Pill Button */}
              <div className="shrink-0 pl-4">
                <button
                  onClick={() => launchExplorer("volume")}
                  className="rounded-full bg-[#0a2e5c] hover:bg-[#072142] text-white px-4 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_4px_rgba(10,46,92,0.18)] hover:shadow-md transition-all cursor-pointer group"
                >
                  <span>Launch Explorer</span>
                  <span className="text-xs transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────
          2. TOP INTRODUCTION HERO SECTION & BREADCRUMB
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-b from-[#eaf4fc]/70 via-[#f4f9fd]/60 to-[#fbfdff] pt-3 pb-4">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1 text-[#0284c7] hover:underline cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="font-medium">Home</span>
            </button>
            <span className="text-slate-400">›</span>
            <span className="font-semibold text-slate-700">Watch Demo</span>
          </div>

          {/* Intro Row: Big Play Icon + Headings + Ocean Script Message */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            
            <div className="flex items-start sm:items-center gap-4">
              {/* Large Circular Play Icon */}
              <div
                onClick={togglePlay}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-[#0284c7] flex items-center justify-center shrink-0 bg-white shadow-[0_4px_12px_rgba(2,132,199,0.18)] cursor-pointer hover:scale-105 active:scale-95 transition-transform group"
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#0284c7] translate-x-0.5 group-hover:text-[#0369a1] transition-colors" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 3.5v9l7-4.5-7-4.5z" />
                </svg>
              </div>

              {/* Title & Subtitles */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#0f2942] tracking-tight">
                  Watch SAGAR NETRA 3D in Action
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-[#0284c7] mt-0.5">
                  A step-by-step walkthrough of India's ocean data visualization platform
                </p>
                <p className="text-[11px] sm:text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Explore how SAGAR NETRA 3D integrates numerical model outputs and in-situ observations to provide an interactive 3D view of the Indian Ocean.
                </p>
              </div>
            </div>

            {/* Ocean-Themed Handwritten Script Accent */}
            <div className="hidden lg:flex flex-col items-end text-right select-none pl-4">
              <div
                className="text-[#0284c7] font-serif italic text-base sm:text-lg leading-snug tracking-wide rotate-[-3deg] opacity-90 drop-shadow-xs"
                style={{
                  fontFamily: "'Dancing Script', 'Caveat', 'Segoe Script', cursive, serif",
                }}
              >
                <div>Explore the Ocean</div>
                <div>Visualize the Data</div>
                <div className="text-[#0369a1] font-semibold">Empower Decisions</div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          3. MAIN VIDEO AREA & VIDEO CHAPTERS PANEL (TWO-COLUMN)
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full py-4">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* Left Column (Video Player ~68% width on desktop) */}
            <div className="lg:col-span-8 flex flex-col">
              <div
                ref={videoContainerRef}
                className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-800 flex flex-col justify-between group select-none"
              >
                {/* Video element */}
                <video
                  ref={videoRef}
                  src="/landing/demo-video.mp4"
                  poster="/landing/demo-video-poster.png"
                  playsInline
                  onClick={togglePlay}
                  className="w-full h-full object-cover cursor-pointer"
                />

                {/* Top Left Badge Overlay (matches reference visual) */}
                <div className="absolute top-3 left-3 pointer-events-none z-10 flex items-center gap-2">
                  <div className="bg-[#0b1e36]/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700/60 shadow-md">
                    <span className="text-[11px] font-bold text-white tracking-wide">SAGAR NETRA 3D</span>
                    <span className="text-[9px] text-sky-300 block -mt-0.5">Ocean Observation & Model Explorer</span>
                  </div>
                </div>

                {/* Big Center Play Icon (shown when paused) */}
                {!isPlaying && (
                  <div
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-black/20 backdrop-blur-[1px] transition-all hover:bg-black/30"
                  >
                    <div className="w-16 h-16 rounded-full bg-black/75 hover:bg-[#0066cc] border-2 border-white/80 text-white flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 active:scale-95">
                      <svg className="w-8 h-8 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 3.5v9l7-4.5-7-4.5z" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Bottom Left Watermark Badge */}
                <div className="absolute bottom-12 left-3 pointer-events-none z-10 hidden sm:block">
                  <div className="bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] text-slate-300 border border-white/10">
                    <span className="font-semibold text-white">SAGAR NETRA 3D</span>
                    <span className="text-slate-400 ml-1">Interactive 3D Ocean Data Visualization Platform</span>
                  </div>
                </div>

                {/* Custom Video Controls Bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-2.5 sm:p-3 flex flex-col gap-1.5 z-20 transition-opacity duration-300">
                  
                  {/* Progress Seek Bar */}
                  <div className="relative flex items-center w-full group/seek">
                    <input
                      type="range"
                      min={0}
                      max={duration || 158}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284c7] hover:h-2 transition-all"
                      style={{
                        background: `linear-gradient(to right, #0284c7 ${(currentTime / (duration || 158)) * 100}%, rgba(100, 116, 139, 0.5) ${(currentTime / (duration || 158)) * 100}%)`,
                      }}
                    />
                  </div>

                  {/* Buttons Row */}
                  <div className="flex items-center justify-between text-white text-xs pt-1">
                    
                    {/* Left: Play/Pause, Volume, Time */}
                    <div className="flex items-center gap-3">
                      {/* Play/Pause Button */}
                      <button
                        onClick={togglePlay}
                        className="hover:text-sky-400 transition cursor-pointer"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Volume / Mute */}
                      <div className="flex items-center gap-1.5 group/vol">
                        <button
                          onClick={toggleMute}
                          className="hover:text-sky-400 transition cursor-pointer"
                          title={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted || volume === 0 ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-12 sm:w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
                        />
                      </div>

                      {/* Time Readout: e.g. 0:00 / 2:38 */}
                      <span className="text-[11px] font-mono text-slate-300">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Right: CC, Settings, PiP, Fullscreen */}
                    <div className="flex items-center gap-3">
                      {/* CC */}
                      <button className="hover:text-sky-400 transition cursor-pointer text-[10px] font-bold border border-slate-400 rounded px-1 py-0.2" title="Closed Captions">
                        CC
                      </button>

                      {/* Settings */}
                      <button className="hover:text-sky-400 transition cursor-pointer" title="Settings">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        </svg>
                      </button>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="hover:text-sky-400 transition cursor-pointer"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    </div>

                  </div>

                </div>
              </div>
            </div>

            {/* Right Column: VIDEO CHAPTERS PANEL (~32% width on desktop, matches video height) */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="h-full bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-3 sm:p-3.5 flex flex-col justify-between overflow-hidden">
                
                {/* Panel Header */}
                <div className="flex-1 flex flex-col justify-between">
                  <h3 className="text-sm sm:text-[15px] font-bold text-[#0a2e5c] tracking-tight mb-1.5">
                    Video Chapters
                  </h3>

                  {/* Chapters List */}
                  <div className="space-y-0.5 sm:space-y-1">
                    {CHAPTERS.map((ch) => {
                      const isActive = activeChapterId === ch.id
                      return (
                        <div
                          key={ch.id}
                          onClick={() => seekToChapter(ch)}
                          className={`flex items-center gap-2.5 py-1 px-2 rounded-lg transition-all cursor-pointer group ${
                            isActive
                              ? "bg-sky-50/90 border border-sky-200 shadow-xs"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          {/* Circular Play Icon */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? "bg-[#0066cc] text-white" : "bg-sky-100 text-[#0066cc] group-hover:bg-[#0066cc] group-hover:text-white"
                          }`}>
                            <svg className="w-2 h-2 translate-x-0.25" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M4 3.5v9l7-4.5-7-4.5z" />
                            </svg>
                          </div>

                          {/* Chapter Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[#0066cc] font-mono leading-none">
                                {ch.timeStr}
                              </span>
                              <h4 className={`text-[11.5px] font-bold truncate leading-snug ${isActive ? "text-[#0a2e5c]" : "text-slate-800 group-hover:text-[#0066cc]"}`}>
                                {ch.title}
                              </h4>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                              {ch.subtitle}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          4. ABOUT THIS DEMO & DURATION CARD SECTION
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full py-2">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Left Card: About This Demo (~76% width) */}
            <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-[#0284c7]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0a2e5c]">
                  About This Demo
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 mt-1 leading-relaxed">
                  This 2-minute demo gives you a complete overview of SAGAR NETRA 3D — from exploring ocean model data and in-situ observations to visualizing 3D ocean structures and supporting real-world applications. See how the platform can help researchers, policymakers, and the public make informed decisions for a safer and more sustainable ocean.
                </p>
              </div>
            </div>

            {/* Right Card: Duration Card (~24% width) */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-[#0284c7]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <polyline points="12,7 12,12 15.5,14" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Duration
                  </div>
                  <div className="text-sm font-bold text-[#0a2e5c]">
                    2 Minutes 38 Seconds
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={toggleFullscreen}
                  className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Watch in Full Screen for Best Experience</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          5. KEY FEATURES DEMONSTRATED SECTION (8 CARDS)
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full py-4">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <h2 className="text-base sm:text-lg font-bold text-[#0a2e5c] tracking-tight mb-3">
            Key Features Demonstrated
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Card 1: 3D Ocean Visualization */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0066cc] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4 9.236V15a1 1 0 00.553.894l4 2A1 1 0 0010 17V11.236a1 1 0 00-.553-.894l-4-2A1 1 0 004 9.236z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">3D Ocean Visualization</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Explore temperature, salinity, currents and chlorophyll in 3D
                </p>
              </div>
            </div>

            {/* Card 2: In-situ Observations */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0d9488] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">In-situ Observations</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Argo floats, gliders, CTD and BGC data integration
                </p>
              </div>
            </div>

            {/* Card 3: Model vs Observation */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0284c7] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Model vs Observation</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Compare profiles and analyze differences
                </p>
              </div>
            </div>

            {/* Card 4: Operational Applications */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-[#4f46e5] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Operational Applications</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Hazard assessment, fisheries, search & rescue, climate monitoring
                </p>
              </div>
            </div>

            {/* Card 5: Interactive Controls */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0284c7] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Interactive Controls</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Select region, variable, depth and time
                </p>
              </div>
            </div>

            {/* Card 6: Multiple Data Sources */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0066cc] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={2} />
                  <path strokeWidth={2} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path strokeWidth={2} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Multiple Data Sources</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  CMEMS, WOD, IFREMER, NOAA and more
                </p>
              </div>
            </div>

            {/* Card 7: Real-world Impact */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Real-world Impact</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Support research, policy and disaster preparedness
                </p>
              </div>
            </div>

            {/* Card 8: Easy to Use */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0284c7] flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#0a2e5c]">Easy to Use</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Intuitive web interface for all users
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          6. ABOUT SAGAR NETRA 3D SECTION (SPLIT LAYOUT)
      ──────────────────────────────────────────────────────────── */}
      <section className="w-full py-4">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            
            {/* Left Column: Platform Overview (~55%) */}
            <div className="lg:col-span-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-[#0284c7]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                  <path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0a2e5c]">
                  About SAGAR NETRA 3D — The Ocean Eye
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  SAGAR NETRA 3D is a web-based interactive platform developed to visualize and analyze ocean model outputs and in-situ observations for the Indian Ocean region. It integrates data from global and regional sources, follows international standards (OGC, CF Conventions), and provides an easy-to-use interface for exploration, research and decision support.
                </p>
                <div className="mt-3">
                  <button
                    onClick={() => setInfoModal(navModals.about)}
                    className="rounded-lg border border-sky-600 text-sky-600 hover:bg-sky-50 font-semibold px-4 py-1.5 text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Learn More</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: 4 Stat Cards Grid (~45%) */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-3">
              
              {/* Stat 1: 4+ Data Sources */}
              <div className="bg-[#f5f9fc] rounded-xl border border-slate-200/80 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-100 text-[#0284c7] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="8" ry="2.5" strokeWidth={2} />
                    <path strokeWidth={2} d="M4 5v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
                    <path strokeWidth={2} d="M4 10v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-[#0a2e5c] leading-none">4+</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">Data Sources</div>
                  <div className="text-[10px] text-slate-500 truncate">(CMEMS, WOD, NOAA, IFREMER)</div>
                </div>
              </div>

              {/* Stat 2: 4 Observation Types */}
              <div className="bg-[#f5f9fc] rounded-xl border border-slate-200/80 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-[#0d9488] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-[#0a2e5c] leading-none">4</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">Observation Types</div>
                  <div className="text-[10px] text-slate-500 truncate">(Argo, Glider, CTD, BGC)</div>
                </div>
              </div>

              {/* Stat 3: 3D Interactive Visualization */}
              <div className="bg-[#f5f9fc] rounded-xl border border-slate-200/80 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#0066cc] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-[#0a2e5c] leading-none">3D</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">Interactive Visualization</div>
                  <div className="text-[10px] text-slate-500 truncate">(depth-resolved)</div>
                </div>
              </div>

              {/* Stat 4: Broader Impact */}
              <div className="bg-[#f5f9fc] rounded-xl border border-slate-200/80 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-[#4f46e5] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 leading-none">Broader Impact</div>
                  <div className="text-[11px] text-slate-600 mt-1 font-medium">Research • Policy • Society</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          7. FINAL OCEAN CTA SECTION (CORAL REEF PANORAMA)
      ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden min-h-[170px] sm:min-h-[190px] flex items-center justify-center text-center mt-2 border-t border-b border-sky-200/50">
        
        {/* Ocean Coral Reef Backdrop */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <Image
            src="/landing/demo-bottom-coral-hd.png"
            alt="One Ocean Every Dimension Coral Reef Backdrop"
            fill
            priority
            unoptimized
            className="object-cover object-center"
          />
          {/* Subtle light gradient overlay to guarantee text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-sky-900/10 via-white/20 to-white/30" />
        </div>

        {/* Content Box */}
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 flex flex-col items-center">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0a2540] tracking-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
            One Ocean. Every Dimension.
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">
            Explore data. Generate insights. Build a safer, more sustainable future.
          </p>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3.5">
            {/* Primary: Launch Explorer */}
            <button
              onClick={() => launchExplorer("volume")}
              className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span>Launch Explorer</span>
              <span className="text-xs">→</span>
            </button>

            {/* Secondary: Back to Home */}
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-white/95 hover:bg-white text-[#0a2e5c] border border-slate-300 px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5 text-[#0a2e5c]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Back to Home</span>
            </button>
          </div>
        </div>

      </section>

      {/* ────────────────────────────────────────────────────────────
          8. INSTITUTIONAL FOOTER
      ──────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-200 py-3.5">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            
            {/* Left: Data Sources Logos / Labels */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="font-bold text-slate-800">Data Sources:</span>

              {/* CMEMS */}
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <div className="w-4 h-4 rounded-full bg-sky-100 flex items-center justify-center text-[#0284c7]">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Copernicus Marine Service (CMEMS)</span>
              </div>

              {/* IFREMER */}
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[#0066cc]">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <line x1="12" y1="3" x2="12" y2="21" strokeWidth={2} />
                    <line x1="3" y1="12" x2="21" y2="12" strokeWidth={2} />
                  </svg>
                </div>
                <span>IFREMER</span>
              </div>

              {/* NOAA */}
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <div className="w-4 h-4 rounded-full bg-cyan-100 flex items-center justify-center text-[#0891b2]">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
                  </svg>
                </div>
                <span>NOAA</span>
              </div>

              {/* NCEI WOD */}
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[#4f46e5]">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="8" ry="2.5" strokeWidth={2} />
                    <path strokeWidth={2} d="M4 5v10c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
                  </svg>
                </div>
                <span>NCEI WOD</span>
              </div>
            </div>

            {/* Right: Status and Last Updated */}
            <div className="flex items-center gap-5">
              {/* Green configured pill */}
              <div className="flex items-center gap-1.5 text-[#059669] font-medium text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span>Official Data Sources Configured</span>
              </div>

              {/* Last Updated */}
              <div className="text-[11px] sm:text-xs text-slate-500">
                Last Updated: 15 Feb 2026, 12:30 UTC
              </div>
            </div>

          </div>
        </div>
      </footer>

      {/* ────────────────────────────────────────────────────────────
          9. MODAL POPUP DIALOG (FOR NAV ITEMS & LEARN MORE)
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
