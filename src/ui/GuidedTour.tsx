"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Step {
  stepNumber: number
  title: string
  subtitle: string
  body: string
  badge: string
  actionHint: string
}

const TOUR_STEPS: Step[] = [
  {
    stepNumber: 1,
    title: "Understand the Ocean",
    subtitle: "SAGAR NETRA 3D — The Ocean Eye · INCOIS SIH26067",
    badge: "FOUNDATION",
    body: "SAGAR NETRA 3D (Sagar Numerical & Environmental Three-dimensional Rendering Architecture) fuses 3D gridded numerical ocean model outputs with real in-situ autonomous observations across India's Exclusive Economic Zone (EEZ) and the entire Indian Ocean basin in an interactive browser-native workspace.",
    actionHint: "Explore physical and chemical variables in 3D.",
  },
  {
    stepNumber: 2,
    title: "Explore Temperature, Salinity & Currents",
    subtitle: "Physical Model Fields",
    badge: "VARIABLES",
    body: "Switch between 3D Potential Temperature (thetao in °C), Practical Salinity (so in PSU), and horizontal Current Velocity Vectors (uo, vo in m/s). The colormaps adapt dynamically using GPU shaders.",
    actionHint: "Colormaps: Turbo, Viridis, Plasma & Diverging.",
  },
  {
    stepNumber: 3,
    title: "Change Depth",
    subtitle: "Water Column Slicing",
    badge: "DEPTH CONTROL",
    body: "Navigate discrete vertical depth levels from the sunlit surface mixed layer (0 m) down to 2,000 m and 6,000 m. Adjust the vertical exaggeration slider (10× to 200×) to inspect subtle stratification and thermocline structures.",
    actionHint: "Inspect horizontal depth planes & seafloor bathymetry.",
  },
  {
    stepNumber: 4,
    title: "Move Through Time",
    subtitle: "4D Temporal Evolution",
    badge: "TIME DYNAMICS",
    body: "Ocean states evolve with the monsoons and seasonal currents. Play, pause, or scrub through 90 daily time steps and 12 monthly climatologies. Observe seasonal current reversals in the Arabian Sea and Bay of Bengal.",
    actionHint: "Adjust playback speed from 0.5× to 4.0×.",
  },
  {
    stepNumber: 5,
    title: "Explore Argo, Glider, CTD & BGC Observations",
    subtitle: "Autonomous In-Situ Platforms",
    badge: "OBSERVATIONS",
    body: "Over 492 Argo floats, 2,591 Glider dives, 619 CTD casts, and 1.4M+ BGC chlorophyll observations are mapped in real 3D spherical coordinates. Click any marker to view multi-channel depth profile line charts.",
    actionHint: "Inspect Temperature, Salinity, and Chlorophyll-a profiles.",
  },
  {
    stepNumber: 6,
    title: "Compare Model and Observations",
    subtitle: "Validation & Assimilation Engine",
    badge: "MODEL VS OBS",
    body: "The Observation Inspector automatically co-locates in-situ observations with model grid cells, computing point-by-point error residuals (Δ = Obs - Model), Bias, RMSE, and Mean Absolute Error (MAE).",
    actionHint: "Inspect depth-by-depth residual tables & scatter plots.",
  },
  {
    stepNumber: 7,
    title: "Slices, Isosurfaces, Vectors & Controls",
    subtitle: "Advanced Scientific Tools",
    badge: "3D ANALYSIS",
    body: "Extract 3D constant-value isosurfaces (e.g. 20°C thermocline envelope), isolate value-band point clouds, toggle 3D current arrow vectors, probe surface coordinates, or search by Float ID.",
    actionHint: "Use the floating scientific dock in Volume Mode.",
  },
  {
    stepNumber: 8,
    title: "Explore the 3D Ocean",
    subtitle: "Ready for Discovery",
    badge: "LAUNCH",
    body: "You are now ready to dive deep into the volumetric water column. Dive into the 3D Ocean Volume to begin interactive scientific analysis and validation.",
    actionHint: "Click below to dive into the full 3D ocean volume.",
  },
]

export default function GuidedTour({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)

  if (!open) return null

  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_STEPS.length - 1

  function handleNext() {
    if (isLast) {
      onClose()
      onComplete()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  function handlePrev() {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Guided Tour Modal */}
        <motion.div
          key={step.stepNumber}
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative z-10 w-[560px] max-w-full glass bg-[#081a33]/95 backdrop-blur-2xl rounded-2xl border border-sky-400/40 shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 md:p-8 flex flex-col gap-4 text-slate-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  STEP {step.stepNumber} OF {TOUR_STEPS.length}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  {step.badge}
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {step.title}
              </h3>
              <p className="text-xs text-sky-300/80 font-medium">{step.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Skip Tour"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="text-sm text-slate-200 leading-relaxed min-h-[80px]">
            {step.body}
          </div>

          {/* Action Hint */}
          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/20 flex items-center gap-2.5 text-xs text-sky-200">
            <span className="text-sky-400 text-base">💡</span>
            <span>{step.actionHint}</span>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5 pt-1">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.stepNumber}
                onClick={() => setStepIndex(idx)}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  idx === stepIndex
                    ? "bg-sky-400 shadow-[0_0_8px_#38bdf8]"
                    : idx < stepIndex
                    ? "bg-sky-700/60"
                    : "bg-slate-800"
                }`}
                title={`Go to step ${s.stepNumber}`}
              />
            ))}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
            >
              Skip Walkthrough
            </button>

            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={handleNext}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 ${
                  isLast
                    ? "bg-gradient-to-r from-sky-400 to-teal-300 text-slate-950 hover:scale-[1.03] shadow-sky-500/30"
                    : "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20"
                }`}
              >
                <span>{isLast ? "EXPLORE THE 3D OCEAN →" : "Next Step →"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
