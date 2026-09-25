"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export interface ManualItem {
  id: string
  icon: string
  title: string
  summary: string
  detailedText: string
  actionLabel: string
  referenceUrl: string
  category: string
  specs: { label: string; value: string }[]
}

const MANUAL_CARDS: ManualItem[] = [
  {
    id: "volume",
    icon: "🌊",
    title: "3D Ocean Volume",
    category: "Volumetric Rendering",
    summary: "Volumetric 3D water block with depth-interpolated fields, data-derived bathymetry, and light shafts.",
    detailedText:
      "Sagar Netra 3D renders the Indian Ocean as a true 3D spherical volume. Data from 25–40 discrete depth levels is GPU-filtered with custom GLSL shaders to reconstruct continuous temperature and salinity gradients from the surface mixed layer down to the bathymetric ocean floor.",
    actionLabel: "Copernicus Physical Model →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "COORDINATES", value: "Lat -35°..30° · Lon 40°..100°" },
      { label: "DEPTH RESOLUTION", value: "0 to 2,000 m (40 levels)" },
      { label: "RENDERING", value: "Three.js / WebGL ACESFilmic" },
    ],
  },
  {
    id: "temp",
    icon: "🌡️",
    title: "Temperature (thetao)",
    category: "Physical Field",
    summary: "Potential temperature field tracking warm surface pools, thermocline gradients, and cold bottom waters.",
    detailedText:
      "Potential temperature (thetao) measures thermal energy without adiabatic compression effects. Warm surface waters in the equatorial Indian Ocean and Bay of Bengal (>28°C) contrast sharply with intermediate and deep waters (<10°C) beneath the thermocline.",
    actionLabel: "Copernicus PHY Specs →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "MODEL VARIABLE", value: "thetao (°C)" },
      { label: "TYPICAL RANGE", value: "1.5°C to 31.5°C" },
      { label: "SPATIAL GRID", value: "0.083° (~9 km resolution)" },
    ],
  },
  {
    id: "saln",
    icon: "🧂",
    title: "Salinity (so)",
    category: "Physical Field",
    summary: "Practical salinity measuring dissolved mineral concentration, driving buoyancy and deep currents.",
    detailedText:
      "Practical salinity (so) controls water mass density. The northern Indian Ocean exhibits dramatic contrast: the high-salinity Arabian Sea (>36 PSU) driven by excess evaporation vs. the low-salinity Bay of Bengal (<33 PSU) freshened by major monsoonal river discharges (Ganges-Brahmaputra).",
    actionLabel: "Copernicus Salinity Specs →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "MODEL VARIABLE", value: "so (PSU / 1e-3)" },
      { label: "TYPICAL RANGE", value: "32.0 to 37.0 PSU" },
      { label: "DENSITY FACTOR", value: "Governs thermohaline flow" },
    ],
  },
  {
    id: "currents",
    icon: "🧭",
    title: "Current Vectors (uo, vo)",
    category: "Dynamics & Velocity",
    summary: "Horizontal ocean velocity arrows dynamically oriented by zonal (uo) and meridional (vo) components.",
    detailedText:
      "Ocean circulation is visualized via instanced 3D velocity vectors. Zonal velocity (uo, eastward) and meridional velocity (vo, northward) combine into current speed (m/s) and heading, revealing major features like the Somali Current, Equatorial Undercurrent, and seasonal gyres.",
    actionLabel: "HYCOM / CMEMS Velocity →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "VARIABLES", value: "uo (eastward), vo (northward)" },
      { label: "VECTOR SPEED", value: "√(uo² + vo²) in m/s" },
      { label: "MONSOON REVERSAL", value: "Reverses semiannually" },
    ],
  },
  {
    id: "slices",
    icon: "🥞",
    title: "Depth Slices",
    category: "Interactive Navigation",
    summary: "Discrete horizontal depth slices highlighting water characteristics at user-selected depths.",
    detailedText:
      "The depth slice control lets oceanographers isolate and inspect any discrete vertical level from the sea surface down through the water column. The active slice is highlighted while maintaining context with transparent surrounding layers and depth callouts.",
    actionLabel: "Depth Layer Tools →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "SLICE LEVELS", value: "0, 10, 50, 100, 250, 500, 1000m" },
      { label: "OPACITY", value: "0.05 to 1.0 adjustable" },
      { label: "EXAGGERATION", value: "10× to 200× vertical scale" },
    ],
  },
  {
    id: "isosurfaces",
    icon: "🧊",
    title: "Isosurfaces & Clouds",
    category: "Volumetric Analysis",
    summary: "3D scalar boundary extraction highlighting constant temperature/salinity surfaces.",
    detailedText:
      "Isosurface extraction using GPU-compatible algorithms generates 3D volumetric surfaces where physical properties meet a threshold (e.g. 20°C thermocline envelope). Value-band point clouds isolate specific water mass signatures across the basin.",
    actionLabel: "NOAA WOD Analysis →",
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    specs: [
      { label: "ALGORITHM", value: "Marching tetrahedra / grid scan" },
      { label: "VALUE THRESHOLD", value: "Interactive real-time slider" },
      { label: "POINT CLOUDS", value: "Value-band density filters" },
    ],
  },
  {
    id: "time",
    icon: "⏱️",
    title: "Time Animation",
    category: "Temporal Dynamics",
    summary: "Stepped and continuous timeline playback across daily forecast steps and seasonal cycles.",
    detailedText:
      "Sagar Netra 3D supports both monthly stepped progression and continuous simulation clock playback with variable speed multipliers (0.5× to 4×). Forecasters can observe the onset of the Indian Ocean Dipole (IOD) and seasonal thermocline deepening.",
    actionLabel: "Copernicus Time Series →",
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    specs: [
      { label: "DAILY SERIES", value: "90 daily steps (Q1 2026)" },
      { label: "SEASONAL SERIES", value: "12-month annual climatology" },
      { label: "PLAYBACK CONTROLS", value: "Play/Pause, Scrubber, Speed" },
    ],
  },
  {
    id: "instruments",
    icon: "⚓",
    title: "Instrument Profiles",
    category: "In-Situ Observations",
    summary: "Real Argo floats, Gliders, and CTD casts with interactive multi-channel vertical profile charts.",
    detailedText:
      "Clicking any 3D instrument marker opens the Observation Inspector. Users can explore multi-cycle profiles of Temperature, Salinity, and Chlorophyll-a, view historical 3D trajectories, copy exact coordinates, and download CSV data directly.",
    actionLabel: "NCEI World Ocean Database →",
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    specs: [
      { label: "ARGO FLOATS", value: "492 platforms (22,231 casts)" },
      { label: "GLIDERS", value: "2,591 saw-tooth dive casts" },
      { label: "CTD CASTS", value: "619 deep-sea research casts" },
    ],
  },
  {
    id: "validation",
    icon: "📈",
    title: "Model vs Observation",
    category: "Validation & Assimilation",
    summary: "Real-time co-located validation calculating point-by-point error residuals, Bias, RMSE, and MAE.",
    detailedText:
      "The system co-locates in-situ observations with 3D model grid cells to compute scientific error statistics: Residual = Obs - Model, Bias (mean error), Root-Mean-Square Error (RMSE), and Mean Absolute Error (MAE). A fleet-wide scatter panel visualizes 1:1 model accuracy.",
    actionLabel: "WOD Observation Portal →",
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    specs: [
      { label: "ERROR FORMULA", value: "Δ = Observed - Model Value" },
      { label: "STATISTICS", value: "Bias, RMSE, MAE, Max Error" },
      { label: "FLEET SCATTER", value: "Fleet-wide 1:1 validation plot" },
    ],
  },
]

export default function Manual({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const selectedCard = MANUAL_CARDS.find((c) => c.id === selectedCardId) ?? null

  function handleClose() {
    setSelectedCardId(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 pointer-events-auto">
          {/* Backdrop (semi-transparent so 3D ocean remains visible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />

          {/* Bounded Manual Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="relative z-10 w-[880px] max-w-full max-h-[88vh] glass bg-[#081a33]/95 backdrop-blur-2xl rounded-2xl border border-sky-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden text-slate-100"
          >
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCard ? (
                  <button
                    onClick={() => setSelectedCardId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 text-xs font-semibold transition-colors"
                  >
                    <span>←</span> Back to Grid
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                    <h2 className="text-base md:text-lg font-black tracking-wide text-white">
                      Scientific User Manual
                    </h2>
                  </div>
                )}
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 hidden sm:inline-block">
                  Sagar Netra 3D · INCOIS SIH26067
                </span>
              </div>

              <button
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-bold"
                title="Close Manual"
              >
                ✕ Close
              </button>
            </div>

            {/* Dialog Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <AnimatePresence mode="wait">
                {selectedCard ? (
                  /* ENLARGED CARD DETAIL VIEW */
                  <motion.div
                    key={selectedCard.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-2xl shadow-lg">
                        {selectedCard.icon}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-sky-400">
                          {selectedCard.category}
                        </span>
                        <h3 className="text-xl md:text-2xl font-black text-white mt-0.5">
                          {selectedCard.title}
                        </h3>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-sm md:text-base text-slate-200 leading-relaxed">
                      {selectedCard.detailedText}
                    </div>

                    {/* Scientific Specifications */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                      {selectedCard.specs.map((spec, i) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col">
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                            {spec.label}
                          </span>
                          <span className="text-sky-300 font-bold mt-1">{spec.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Reference link */}
                    <div className="pt-2 flex items-center justify-between border-t border-white/10">
                      <span className="text-xs text-slate-400">Official Scientific Documentation:</span>
                      <a
                        href={selectedCard.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-sky-500/20 flex items-center gap-1.5"
                      >
                        <span>{selectedCard.actionLabel}</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </motion.div>
                ) : (
                  /* 3 × 3 GRID OF 9 CARDS */
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5"
                  >
                    {MANUAL_CARDS.map((card, idx) => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className="p-4 rounded-xl glass bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 hover:border-sky-400/50 transition-all text-left flex flex-col justify-between gap-3 group shadow-md hover:scale-[1.02]"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-2xl p-2 rounded-lg bg-white/5 border border-white/5 group-hover:scale-110 transition-transform">
                            {card.icon}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 font-semibold">
                            0{idx + 1}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-sky-400/80 block">
                            {card.category}
                          </span>
                          <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors mt-0.5">
                            {card.title}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                            {card.summary}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-sky-400 font-semibold group-hover:text-sky-300">
                          <span>Inspect details</span>
                          <span>→</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
