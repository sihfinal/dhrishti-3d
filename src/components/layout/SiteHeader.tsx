"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useOcean } from "@/lib/store"

export type NavRouteId =
  | "home"
  | "study-region"
  | "explorer"
  | "observations"
  | "data-services"
  | "operational-applications"
  | "resources"
  | "about"
  | "watch-demo"

interface SiteHeaderProps {
  currentRoute?: NavRouteId
  onSearch?: (query: string) => void
  onOpenAbout?: () => void
  onLaunchExplorer?: (mode?: "volume" | "globe") => void
}

export function SiteHeader({
  currentRoute: customRoute,
  onSearch,
  onOpenAbout,
  onLaunchExplorer,
}: SiteHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Determine active route automatically if not passed explicitly
  const activeRoute: NavRouteId =
    customRoute ||
    (pathname === "/"
      ? "home"
      : pathname.startsWith("/study-region")
      ? "study-region"
      : pathname.startsWith("/explore")
      ? "explorer"
      : pathname.startsWith("/observations")
      ? "observations"
      : pathname.startsWith("/data-services")
      ? "data-services"
      : pathname.startsWith("/operational-applications")
      ? "operational-applications"
      : pathname.startsWith("/resources")
      ? "resources"
      : pathname.startsWith("/about")
      ? "about"
      : pathname.startsWith("/watch-demo")
      ? "watch-demo"
      : "home")

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    setMobileMenuOpen(false)

    if (onSearch) {
      onSearch(trimmed)
    } else {
      useOcean.getState().setViewMode("volume")
      router.push(`/explore?q=${encodeURIComponent(trimmed)}`)
    }
  }

  function handleLaunch(mode: "volume" | "globe" = "volume") {
    setMobileMenuOpen(false)
    if (onLaunchExplorer) {
      onLaunchExplorer(mode)
    } else {
      useOcean.getState().setViewMode(mode)
      router.push(mode === "globe" ? "/explore?view=globe" : "/explore")
    }
  }

  function handleProfileClick() {
    setMobileMenuOpen(false)
    if (onOpenAbout) {
      onOpenAbout()
    } else {
      router.push("/about")
    }
  }

  const navItems = [
    {
      id: "home" as NavRouteId,
      label: "Home",
      href: "/",
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
      isAction: activeRoute === "home",
      onClick: () => {
        setMobileMenuOpen(false)
        if (pathname === "/") {
          window.scrollTo({ top: 0, behavior: "smooth" })
        } else {
          router.push("/")
        }
      },
    },
    {
      id: "study-region" as NavRouteId,
      label: "Study Region",
      href: "/study-region",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      isAction: false,
      onClick: () => {
        setMobileMenuOpen(false)
        router.push("/study-region")
      },
    },
    {
      id: "explorer" as NavRouteId,
      label: "Explorer",
      href: "/explore",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
          <path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ),
      isAction: true,
      onClick: () => handleLaunch("volume"),
    },
    {
      id: "observations" as NavRouteId,
      label: "Observations",
      href: "/observations",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8M17 7h4v4" />
        </svg>
      ),
      isAction: false,
      onClick: () => {
        setMobileMenuOpen(false)
        router.push("/observations")
      },
    },
    {
      id: "data-services" as NavRouteId,
      label: "Data Services",
      href: "/data-services",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
          <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
      isAction: false,
      onClick: () => {
        setMobileMenuOpen(false)
        router.push("/data-services")
      },
    },
    {
      id: "operational-applications" as NavRouteId,
      label: "Operational Applications",
      href: "/operational-applications",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
          <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.8} />
          <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
          <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.8} />
        </svg>
      ),
      isAction: false,
      onClick: () => {
        setMobileMenuOpen(false)
        router.push("/operational-applications")
      },
    },
    {
      id: "resources" as NavRouteId,
      label: "Resources",
      href: "/resources",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      isAction: false,
      onClick: () => {
        setMobileMenuOpen(false)
        router.push("/resources")
      },
    },
  ]

  return (
    <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
      
      {/* ─── Row 1: Institutional Badges, Tagline, Search, User, Hamburger ─── */}
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex items-center justify-between h-[58px] sm:h-[64px] lg:h-[66px] gap-2 sm:gap-4">
          
          {/* Left: MoES Emblem & INCOIS Logo */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
            <Link href="/" className="flex items-center shrink-0 cursor-pointer">
              <Image
                src="/landing/header-emblem-moes.png"
                alt="Ministry of Earth Sciences, Government of India"
                width={220}
                height={64}
                priority
                unoptimized
                className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto max-w-[110px] xs:max-w-[130px] sm:max-w-none object-contain"
              />
            </Link>

            {/* Vertical divider */}
            <div className="h-6 sm:h-8 w-[1px] bg-slate-200 shrink-0" />

            <Link href="/" className="flex items-center shrink-0 cursor-pointer">
              <Image
                src="/landing/header-incois.png"
                alt="INCOIS - Indian National Centre for Ocean Information Services"
                width={340}
                height={64}
                priority
                unoptimized
                className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto max-w-[125px] xs:max-w-[160px] sm:max-w-none object-contain"
              />
            </Link>
          </div>

          {/* Center: National Tagline + Tricolor Swirl Ribbon (Visible on 2XL / Ultra-wide) */}
          <div className="hidden 2xl:flex items-center justify-center flex-1 px-4 min-w-0">
            <Image
              src="/landing/header-tagline-swirl.png"
              alt="Oceans for a Safer, Sustainable and Prosperous India"
              width={400}
              height={70}
              priority
              unoptimized
              className="h-11 sm:h-[50px] w-auto object-contain"
            />
          </div>

          {/* Right: Search Pill Input & User Avatar & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Desktop Search Bar (md+) */}
            <form onSubmit={handleSearchSubmit} className="relative hidden md:flex items-center">
              <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-1 w-48 lg:w-60 xl:w-64 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-sky-500/40 focus-within:border-sky-500 transition-all">
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
                  placeholder="Search datasets, variables..."
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
              type="button"
              onClick={handleProfileClick}
              className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer shrink-0"
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

            {/* Mobile / Tablet Menu Hamburger Button (Hidden on lg+) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

          </div>

        </div>
      </div>

      {/* ─── Row 2: Desktop Institutional Navbar (lg+) ─── */}
      <div className="hidden lg:block w-full bg-white border-t border-slate-100">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
            
            {/* Navigation Links */}
            <nav className="flex items-center gap-4 xl:gap-6 py-0.5 overflow-x-auto no-scrollbar">
              {navItems.map((item) => {
                const isActive = activeRoute === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`relative flex items-center gap-1.5 text-xs xl:text-[13px] font-medium shrink-0 py-1.5 transition cursor-pointer ${
                      isActive ? "text-[#0284c7] font-semibold" : "text-slate-700 hover:text-[#0284c7]"
                    }`}
                  >
                    <span className={isActive ? "text-[#0284c7]" : "text-slate-500"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                    )}
                  </button>
                )
              })}
            </nav>

          </div>
        </div>
      </div>

      {/* ─── Mobile / Tablet Navigation Drawer ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden w-full bg-white border-t border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3">
              
              {/* Mobile Search Input */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 w-full">
                  <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search datasets, variables, regions..."
                    className="w-full text-xs text-slate-700 bg-transparent placeholder-slate-400 focus:outline-none"
                  />
                  <button type="submit" className="ml-1 text-sky-600 font-semibold text-xs">
                    Search
                  </button>
                </div>
              </form>

              {/* Mobile Nav Links Grid */}
              <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-slate-100">
                {navItems.map((item) => {
                  const isActive = activeRoute === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                        isActive
                          ? "bg-sky-50 text-[#0284c7] font-semibold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-[#0284c7]"
                      }`}
                    >
                      <span className={isActive ? "text-[#0284c7]" : "text-slate-500"}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              {/* Mobile Tagline */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 pb-1">
                <div className="text-[10px] text-slate-500 text-center sm:text-right w-full">
                  SIH 26067 · INCOIS · MoES
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </header>
  )
}
