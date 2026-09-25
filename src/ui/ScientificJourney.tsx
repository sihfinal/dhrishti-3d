"use client"

import { motion } from "framer-motion"

interface JourneyItemProps {
  label: string
  icon: string
  dotColor: string
  active?: boolean
  onClick: () => void
  subtext?: string
}

function JourneyItem({ label, icon, dotColor, active, onClick, subtext }: JourneyItemProps) {
  return (
    <div className="relative pl-7 group">
      {/* Node dot along the vertical line */}
      <span
        className={`absolute -left-[5px] top-[14px] w-2.5 h-2.5 rounded-full border border-sky-300/40 transition-all duration-300 ${
          active
            ? `${dotColor} ring-4 ring-sky-400/30 scale-125 shadow-[0_0_12px_#38bdf8]`
            : `${dotColor} opacity-75 group-hover:opacity-100 group-hover:scale-125 group-hover:shadow-[0_0_8px_currentColor]`
        }`}
      />

      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border backdrop-blur-md transition-all duration-200 text-left pointer-events-auto shadow-sm ${
          active
            ? "bg-[#102a4a]/90 border-sky-400 text-white shadow-lg shadow-sky-500/20 translate-x-1.5"
            : "bg-slate-900/50 hover:bg-[#0d203a]/75 border-sky-950/60 hover:border-sky-500/50 text-slate-200 hover:text-white hover:translate-x-1.5 hover:shadow-md hover:shadow-sky-500/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base select-none">{icon}</span>
          <div>
            <span className="text-xs md:text-sm font-semibold tracking-wide block">
              {label}
            </span>
            {subtext && (
              <span className="text-[10px] text-slate-400 font-mono block">
                {subtext}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sky-400/60 group-hover:text-sky-300 font-bold text-xs transition-colors">
          <span className="text-[10px] uppercase font-mono tracking-wider hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
            Inspect
          </span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </button>
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  nodeIcon?: string
}

function SectionHeader({ title, subtitle, nodeIcon }: SectionHeaderProps) {
  return (
    <div className="relative pl-7 pt-3 pb-1">
      {/* Section Node */}
      <span className="absolute -left-[8px] top-[14px] w-4 h-4 rounded-full bg-sky-950 border-2 border-sky-400 flex items-center justify-center shadow-[0_0_10px_#38bdf8]">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-300" />
      </span>

      <div>
        <h3 className="text-[11px] md:text-xs font-black tracking-[0.2em] text-sky-400 uppercase drop-shadow">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

export default function ScientificJourney({
  activeTerm,
  onSelectTerm,
  onStartDiscovery,
}: {
  activeTerm: string | null
  onSelectTerm: (term: string) => void
  onStartDiscovery: () => void
}) {
  return (
    <div className="relative w-full h-full flex flex-col justify-between py-2 text-slate-100 overflow-y-auto scroll-thin pr-3">
      {/* Top Header Node */}
      <div className="mb-4 pb-3 border-b border-sky-500/20">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-sky-500/30">
            ●
          </div>
          <div>
            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-white">
              Core Concepts in Ocean Observation
            </h2>
            <p className="text-[11px] text-sky-300/80">
              Interactive Scientific Knowledge Timeline
            </p>
          </div>
        </div>
      </div>

      {/* ─── The Flowing Timeline Path ─── */}
      <div className="relative flex flex-col gap-5 pl-2">
        {/* Continuous Flowing Vertical Line */}
        <div
          className="absolute left-[3px] top-2 bottom-6 w-[2px] bg-gradient-to-b from-sky-400 via-cyan-400/60 to-teal-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.4)] pointer-events-none"
        />

        {/* ─── SECTION 1: UNDERSTAND THE OCEAN ─── */}
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Understand the Ocean"
            subtitle="Fundamental hydrographic state variables"
          />

          <JourneyItem
            label="Temperature"
            icon="🌡️"
            dotColor="bg-rose-400"
            subtext="Variable: thetao · Thermal stratification (°C)"
            active={activeTerm === "Temperature"}
            onClick={() => onSelectTerm("Temperature")}
          />
          <JourneyItem
            label="Salinity"
            icon="🧂"
            dotColor="bg-cyan-400"
            subtext="Variable: so · Haline density driver (PSU)"
            active={activeTerm === "Salinity"}
            onClick={() => onSelectTerm("Salinity")}
          />
          <JourneyItem
            label="Currents"
            icon="🧭"
            dotColor="bg-emerald-400"
            subtext="Variables: uo, vo · 3D Velocity vectors (m/s)"
            active={activeTerm === "Currents"}
            onClick={() => onSelectTerm("Currents")}
          />
          <JourneyItem
            label="Depth Layers"
            icon="🥞"
            dotColor="bg-blue-400"
            subtext="Vertical slicing & 10×–200× exaggeration"
            active={activeTerm === "Depth Layers"}
            onClick={() => onSelectTerm("Depth Layers")}
          />
        </div>

        {/* ─── SECTION 2: HOW DO WE OBSERVE IT? ─── */}
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="How Do We Observe It?"
            subtitle="Autonomous in-situ observing platforms"
          />

          <JourneyItem
            label="Argo Floats"
            icon="🛟"
            dotColor="bg-cyan-400"
            subtext="492 floats · 22,231 profiles down to 2,000 m"
            active={activeTerm === "Argo Floats"}
            onClick={() => onSelectTerm("Argo Floats")}
          />
          <JourneyItem
            label="Gliders"
            icon="✈️"
            dotColor="bg-rose-400"
            subtext="2,591 saw-tooth continuous dive transects"
            active={activeTerm === "Gliders"}
            onClick={() => onSelectTerm("Gliders")}
          />
          <JourneyItem
            label="CTD Profiles"
            icon="⚓"
            dotColor="bg-emerald-400"
            subtext="619 research vessel deep casts down to 6,000 m"
            active={activeTerm === "CTD Profiles"}
            onClick={() => onSelectTerm("CTD Profiles")}
          />
          <JourneyItem
            label="BGC Sensors"
            icon="🌱"
            dotColor="bg-amber-400"
            subtext="1.4M+ Chlorophyll, Oxygen, Nitrate & pH points"
            active={activeTerm === "BGC Sensors"}
            onClick={() => onSelectTerm("BGC Sensors")}
          />
        </div>

        {/* ─── SECTION 3: ANALYZE & EXPLORE ─── */}
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Analyze & Explore"
            subtitle="Multi-dimensional diagnostic framework"
          />

          <JourneyItem
            label="Space Dimensions"
            icon="🌐"
            dotColor="bg-sky-400"
            subtext="Geospatial bounding box & WGS84 datum"
            active={activeTerm === "Space Dimensions"}
            onClick={() => onSelectTerm("Space Dimensions")}
          />
          <JourneyItem
            label="Depth Stratification"
            icon="📊"
            dotColor="bg-indigo-400"
            subtext="Mixed layer, thermocline & pycnocline"
            active={activeTerm === "Depth Stratification"}
            onClick={() => onSelectTerm("Depth Stratification")}
          />
          <JourneyItem
            label="Time Dynamics"
            icon="⏱️"
            dotColor="bg-purple-400"
            subtext="90 daily steps & 12 monthly climatologies"
            active={activeTerm === "Time Dynamics"}
            onClick={() => onSelectTerm("Time Dynamics")}
          />
          <JourneyItem
            label="Model vs Obs"
            icon="📈"
            dotColor="bg-teal-400"
            subtext="Residuals, Bias, RMSE & 1:1 scatter validation"
            active={activeTerm === "Model vs Obs"}
            onClick={() => onSelectTerm("Model vs Obs")}
          />
          <JourneyItem
            label="How Data Works"
            icon="💾"
            dotColor="bg-cyan-300"
            subtext="NetCDF-4 → xarray → uint8 binary → GPU Shader"
            active={activeTerm === "How Data Works"}
            onClick={() => onSelectTerm("How Data Works")}
          />
        </div>

        {/* ─── SECTION 4: WHY DOES THIS MATTER? ─── */}
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Why Does This Matter?"
            subtitle="Societal impact and climate forecasting"
          />

          <JourneyItem
            label="Why am I looking at this?"
            icon="🔭"
            dotColor="bg-sky-400"
            subtext="Sagar Netra 3D mission & problem statement"
            active={activeTerm === "Why am I looking at this?" || activeTerm === "What am I looking at?"}
            onClick={() => onSelectTerm("Why am I looking at this?")}
          />
          <JourneyItem
            label="How do scientists observe ocean?"
            icon="🛰️"
            dotColor="bg-teal-400"
            subtext="Integrated satellite & autonomous GOOS network"
            active={activeTerm === "How do scientists observe ocean?" || activeTerm === "How do scientists observe the ocean?"}
            onClick={() => onSelectTerm("How do scientists observe ocean?")}
          />
          <JourneyItem
            label="Why does this matter?"
            icon="🌍"
            dotColor="bg-emerald-400"
            subtext="Monsoon forcing, cyclone risk & EEZ security"
            active={activeTerm === "Why does this matter?"}
            onClick={() => onSelectTerm("Why does this matter?")}
          />
        </div>

        {/* ─── SECTION 5: GET STARTED (PROMINENT CTA) ─── */}
        <div className="relative pl-7 pt-4 pb-4">
          <span className="absolute -left-[8px] top-[24px] w-4 h-4 rounded-full bg-teal-400 ring-4 ring-teal-400/30 shadow-[0_0_12px_#2dd4bf]" />

          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900/90 to-teal-950/80 border border-teal-400/40 shadow-[0_10px_30px_rgba(45,212,191,0.15)] flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-teal-300">
                Get Started
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-teal-500/20 text-teal-200 border border-teal-400/30">
                Guided Tour
              </span>
            </div>

            <button
              onClick={onStartDiscovery}
              className="w-full group relative overflow-hidden py-3 px-5 rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300 text-slate-950 font-black text-xs md:text-sm tracking-wide uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-sky-400/25 flex items-center justify-center gap-2"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>✨</span> Start Ocean Discovery <span>→</span>
              </span>
              <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-0" />
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Step-by-step walkthrough of 3D volumetric controls & observations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
