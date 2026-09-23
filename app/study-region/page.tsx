"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { useOcean } from "@/lib/store"

interface ConceptDetail {
  title: string
  category: string
  badge: string
  explanation: string
  keyPoints: string[]
  facts: { label: string; value: string }[]
  referenceUrl?: string
  referenceLabel?: string
  explorerMode?: "volume" | "globe"
}

const STUDY_CONCEPTS: Record<string, ConceptDetail> = {
  "Temperature": {
    title: "Ocean Temperature & Thermal Stratification",
    category: "Physical Oceanography",
    badge: "Variable: thetao · Unit: °C",
    explanation:
      "Ocean temperature varies continuously across horizontal space and vertical depth. Solar insolation warms the upper epipelagic layer, while vertical density stratification creates a steep thermocline before transitioning to cold abyssal waters. In numerical ocean models, potential temperature is represented by thetao in units of °C.",
    keyPoints: [
      "Thermal stratification creates distinct surface mixed layers and deep thermoclines.",
      "Primary driver of tropical cyclone intensification and monsoon rainfall dynamics.",
      "Co-validated against Argo floats and ship-based CTD baseline profiles.",
    ],
    facts: [
      { label: "MODEL VARIABLE", value: "thetao / temp_annual" },
      { label: "STANDARD UNIT", value: "°C (Degree Celsius)" },
      { label: "DEPTH RANGE", value: "Surface (0 m) to 6,000 m" },
      { label: "DATA CONVENTION", value: "CF-1.8 Standard Name" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    referenceLabel: "Copernicus Marine Physics Dataset",
    explorerMode: "volume",
  },
  "Salinity": {
    title: "Practical Salinity & Haline Structures",
    category: "Physical Oceanography",
    badge: "Variable: so · Unit: PSU",
    explanation:
      "Practical salinity measures the concentration of dissolved mineral salts in seawater, serving as a primary driver of ocean density and global thermohaline circulation. Fresh river runoff and monsoonal precipitation create low-salinity surface pools in the Bay of Bengal, contrasting with intense evaporation in the Arabian Sea.",
    keyPoints: [
      "Governs seawater density, halosteric sea level changes, and vertical stability.",
      "Extreme basin contrast: Arabian Sea (>36 PSU) vs Bay of Bengal (<33 PSU).",
      "Essential for tracking river plumes, barrier layers, and deep water mass formation.",
    ],
    facts: [
      { label: "MODEL VARIABLE", value: "so / salt_annual" },
      { label: "STANDARD UNIT", value: "PSU (Practical Salinity)" },
      { label: "PHYSICAL ROLE", value: "Density & Buoyancy Driver" },
      { label: "BASIN CONTRAST", value: "Arabian Sea vs Bay of Bengal" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    referenceLabel: "Copernicus Marine Salinity Reference",
    explorerMode: "volume",
  },
  "Currents": {
    title: "Ocean Currents & 3D Circulation",
    category: "Physical Oceanography",
    badge: "Variables: uo, vo · Unit: m/s",
    explanation:
      "Ocean currents transport immense volumes of heat, salt, and momentum across the ocean basin. The horizontal velocity vector is decomposed into orthogonal components: uo for eastward (zonal) velocity and vo for northward (meridional) velocity. SagarDrishti-3D visualizes speed and direction throughout the vertical water column.",
    keyPoints: [
      "Vector decomposition into orthogonal components uo (zonal) and vo (meridional).",
      "Features semiannual reversal driven by the Southwest and Northeast Monsoons.",
      "Instanced 3D velocity vectors reveal Somali Current and equatorial undercurrents.",
    ],
    facts: [
      { label: "ZONAL VECTOR (U)", value: "uo (Eastward Velocity in m/s)" },
      { label: "MERIDIONAL VECTOR (V)", value: "vo (Northward Velocity in m/s)" },
      { label: "MODEL SOURCE", value: "HYCOM / Copernicus CMEMS" },
      { label: "DYNAMIC REVERSAL", value: "Southwest & Northeast Monsoons" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    referenceLabel: "HYCOM / CMEMS Velocity Data",
    explorerMode: "volume",
  },
  "Depth Layers": {
    title: "Vertical Depth Layers & Slices",
    category: "Physical Oceanography",
    badge: "Levels: 25–54 Standard Depths",
    explanation:
      "The ocean is vertically structured into distinct strata: the sunlit surface mixed layer (0–200m), the sharp pycnocline/thermocline transition layer, and the deep bathypelagic abyss. Depth-resolved numerical models and autonomous profilers sample these discrete vertical layers.",
    keyPoints: [
      "Interactive horizontal depth slicing from 0 to 6,000 meters.",
      "Adjustable 10× to 200× vertical exaggeration highlights subtle thermoclines.",
      "Integrated bathymetry mesh provides data-derived seafloor topography context.",
    ],
    facts: [
      { label: "VERTICAL RESOLUTION", value: "25–54 standard levels" },
      { label: "DEPTH SLICING", value: "0 to 6,000 meters" },
      { label: "VERTICAL EXAGGERATION", value: "10× to 200× adjustable scale" },
      { label: "BATHYMETRY", value: "Data-derived seafloor topography" },
    ],
    referenceUrl: "https://www.gebco.net/data_and_products/gridded_bathymetry_data/",
    referenceLabel: "GEBCO Bathymetric Grids",
    explorerMode: "volume",
  },
  "Argo Floats": {
    title: "Autonomous Argo Profiling Floats",
    category: "Observation Systems",
    badge: "Fleet: 492 Active Floats in IO",
    explanation:
      "Argo floats are robotic autonomous profiling instruments that operate continuously across the global ocean. Each float drifts at a 1,000m parking depth for approximately 10 days, descends to 2,000m, and ascends while collecting continuous, high-precision vertical profiles of temperature, salinity, and pressure before transmitting data via satellite.",
    keyPoints: [
      "Over 492 floats with 22,231 verified profiles in the Indian Ocean study dataset.",
      "Standard 10-day cycle: surface GPS fix → 1,000 m drift → 2,000 m profile ascent.",
      "Real-time sensor transmission via Iridium satellite communication links.",
    ],
    facts: [
      { label: "ACTIVE FLOATS", value: "492 platforms in Indian Ocean" },
      { label: "TOTAL PROFILES", value: "22,231 verified casts in dataset" },
      { label: "PARKING DEPTH", value: "1,000 m drifting · 2,000 m profiling" },
      { label: "DATA SOURCE", value: "NOAA NCEI World Ocean Database (WOD)" },
    ],
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    referenceLabel: "NOAA NCEI WOD Float Registry",
    explorerMode: "volume",
  },
  "Gliders": {
    title: "Autonomous Underwater Gliders",
    category: "Observation Systems",
    badge: "Missions: 2,591 Saw-Tooth Dives",
    explanation:
      "Underwater gliders are autonomous buoyancy-driven underwater vehicles (AUVs) that traverse targeted oceanographic transects along continuous saw-tooth flight trajectories. They capture exceptionally high-resolution vertical sections of physical and biogeochemical parameters across the upper 1,000m of the water column.",
    keyPoints: [
      "Buoyancy engine enables long-endurance missions without active propulsion.",
      "High spatio-temporal sampling along precise oceanographic transect tracks.",
      "Co-located multi-sensor payload: CTD, dissolved oxygen, and chlorophyll fluorometers.",
    ],
    facts: [
      { label: "TOTAL DIVES", value: "2,591 high-resolution profiles" },
      { label: "TRAJECTORY TYPE", value: "Saw-tooth continuous flight path" },
      { label: "PRIMARY SENSORS", value: "CTD, Optical Backscatter, Chl-a" },
      { label: "DEPLOYMENT REGION", value: "Arabian Sea & Bay of Bengal" },
    ],
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    referenceLabel: "NOAA NCEI WOD Glider Data",
    explorerMode: "volume",
  },
  "CTD": {
    title: "Research Vessel CTD Rosettes",
    category: "Observation Systems",
    badge: "Casts: 619 Deep-Sea Profiles",
    explanation:
      "Conductivity, Temperature, and Depth (CTD) rosette packages deployed from research vessels represent the scientific gold standard for oceanographic observations. Equipped with 24 Niskin water sampling bottles and lab-calibrated sensors, CTD casts capture ultra-precise water-column data from the sea surface to abyssal depths of 6,000m.",
    keyPoints: [
      "Direct laboratory calibration with secondary discrete Niskin bottle sampling.",
      "Deepest observation modality, penetrating through abyssal depths to 6,000 meters.",
      "Primary reference standard for calibrating autonomous Argo and Glider sensors.",
    ],
    facts: [
      { label: "TOTAL CASTS", value: "619 research vessel profiles" },
      { label: "MAXIMUM DEPTH", value: "Up to 6,000.3 m abyssal depth" },
      { label: "CALIBRATION", value: "Laboratory-calibrated sensor package" },
      { label: "ANCILLARY DATA", value: "Dissolved Oxygen & Nutrients" },
    ],
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    referenceLabel: "NOAA NCEI WOD CTD Casts",
    explorerMode: "volume",
  },
  "BGC Sensors": {
    title: "Biogeochemical Optical Sensors",
    category: "Observation Systems",
    badge: "Observations: 1,429,883 Chl-a Points",
    explanation:
      "Biogeochemical (BGC) optical sensors quantify critical biological and chemical parameters. Sensors include bio-optical fluorometers for chlorophyll-a (phytoplankton biomass), optodes for dissolved oxygen (O2), optical spectrophotometers for dissolved nitrate (NO3), and ISFET electrodes for seawater pH monitoring.",
    keyPoints: [
      "Tracks phytoplankton blooms, marine primary productivity, and coastal upwelling.",
      "Monitors oxygen minimum zones (OMZ) and ocean deoxygenation in the Arabian Sea.",
      "Measures marine carbon chemistry, carbonate saturation, and ocean acidification.",
    ],
    facts: [
      { label: "KEY PARAMETERS", value: "Chlorophyll-a, O2, NO3, pH" },
      { label: "CHLOROPHYLL OBS", value: "1,429,883 observation points" },
      { label: "OXYGEN OBS", value: "1,515,170 observation points" },
      { label: "ECOSYSTEM ROLE", value: "Primary Productivity & Hypoxia" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_BGC_001_029/description",
    referenceLabel: "Copernicus BGC Chlorophyll Product",
    explorerMode: "volume",
  },
  "Model Data": {
    title: "Numerical Ocean Model Outputs",
    category: "Data & Analysis",
    badge: "CMEMS / NetCDF-4 / CF-1.8",
    explanation:
      "Raw CF-compliant NetCDF-4 model datasets are parsed server-side with Python xarray and NumPy. 3D fields are cropped, depth-sliced, and quantized into ultra-compact 8-bit binary buffers. The frontend streams these buffers directly to custom WebGL fragment shaders that reconstruct physical values at 60 FPS.",
    keyPoints: [
      "Server-side lazy chunked slicing with Python xarray and NetCDF4/HDF5.",
      "GPU-quantized uint8 streaming: full seasonal 3D volume fits in <1 MB.",
      "Custom WebGL bilinear shaders perform instant real-time colormap mapping.",
    ],
    facts: [
      { label: "INGESTION PIPELINE", value: "Python xarray, NetCDF-4, NumPy" },
      { label: "QUANTIZATION", value: "uint8 (254 physical steps + NaN fill)" },
      { label: "GPU SHADERS", value: "Real-time bilinear Colormap LUTs" },
      { label: "DATA SOURCE", value: "Copernicus Marine Physics Engine" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/",
    referenceLabel: "Copernicus Marine Store",
    explorerMode: "volume",
  },
  "Observational Data": {
    title: "In-situ Observational Integration",
    category: "Data & Analysis",
    badge: "Argo, Glider, CTD, BGC",
    explanation:
      "In-situ observation systems gather continuous depth profiles across the Indian Ocean basin. Over 25,000 discrete profile casts are integrated into the spatial engine, allowing instant cross-validation between simulated model predictions and empirical ground truth.",
    keyPoints: [
      "Quality-controlled observational profiles adhering to international IOC standards.",
      "Real-time spatio-temporal co-location with model volumetric cells.",
      "Standardized vertical pressure-to-depth hydrostatic conversion.",
    ],
    facts: [
      { label: "TOTAL PROFILES", value: "25,000+ verified casts" },
      { label: "QUALITY CONTROL", value: "Automated & expert flag validation" },
      { label: "DATA SOURCES", value: "WOD, INCOIS, Copernicus" },
      { label: "SAMPLING DEPTH", value: "0 to 6,000 m abyssal range" },
    ],
    referenceUrl: "https://incois.gov.in/portal/datainfo/argo.jsp",
    referenceLabel: "INCOIS Argo Data Center",
    explorerMode: "volume",
  },
  "Model vs Observation Comparison": {
    title: "Model vs Observation Statistical Verification",
    category: "Data & Analysis",
    badge: "Error Residuals: Obs - Model",
    explanation:
      "The validation engine matches in-situ observations with co-located 3D model grid points across spatial coordinates, depth levels, and timestamp intervals. It computes statistical error residuals, root mean square error (RMSE), mean absolute error (MAE), and bias to evaluate forecast skill.",
    keyPoints: [
      "Point-by-point 3D spatial interpolation with bilinear horizontal and linear vertical weights.",
      "Statistical metric dashboard: Bias, RMSE, Scatter Index, and Correlation.",
      "Visual assimilation verification lens for forecasters and oceanographers.",
    ],
    facts: [
      { label: "ERROR FORMULA", value: "Residual = Observed - Model Value" },
      { label: "STATISTICAL METRICS", value: "Bias, RMSE, MAE, Max Error" },
      { label: "FLEET SCATTER", value: "1:1 empirical correlation tracking" },
      { label: "OPERATIONAL GOAL", value: "Quantify forecast model confidence" },
    ],
    referenceUrl: "https://incois.gov.in/",
    referenceLabel: "INCOIS Ocean Modeling Group",
    explorerMode: "volume",
  },
  "Hazard Assessment": {
    title: "Hazard Assessment & Ocean State Forecast",
    category: "Why Does This Matter?",
    badge: "Cyclones, Surges, Waves",
    explanation:
      "Ocean temperature, storm surge height, and current dynamics directly influence coastal hazard severity. SagarDrishti-3D visualizes cyclonic heat potential (TCHP), wave surge forecasts, and rip currents to empower disaster management authorities and port operators.",
    keyPoints: [
      "Tropical Cyclone Heat Potential (TCHP) tracking for intensity forecasting.",
      "Early warning indicators for storm surge and coastal inundation risks.",
      "High-resolution wave spectra for port operations and coastal communities.",
    ],
    facts: [
      { label: "PRIMARY HAZARDS", value: "Cyclones, Storm Surges, High Waves" },
      { label: "KEY PARAMETER", value: "Tropical Cyclone Heat Potential (TCHP)" },
      { label: "AGENCY SUPPORT", value: "NDMA, SDMAs, Coast Guard, Ports" },
      { label: "ARCHIVE COVERAGE", value: "Daily model archive / multi-layer" },
    ],
    referenceUrl: "https://incois.gov.in/portal/osf/osf.jsp",
    referenceLabel: "INCOIS Ocean State Forecast Portal",
    explorerMode: "volume",
  },
  "Search & Rescue": {
    title: "Search & Rescue (SAR) & Drift Modeling",
    category: "Why Does This Matter?",
    badge: "Maritime Drift & SAROPS",
    explanation:
      "Search and rescue (SAR) operations depend critically on accurate 3D ocean velocity vectors (uo, vo, wo) and wind-driven surface drift. SagarDrishti-3D provides current streamline forecasting to predict the probable drift trajectories of lost vessels, life rafts, and floating objects.",
    keyPoints: [
      "Surface and subsurface current vector integration for trajectory simulation.",
      "SAROPS and Leeway model integration for maritime search sector optimization.",
      "Coast Guard interoperability for rapid emergency response deployments.",
    ],
    facts: [
      { label: "MODEL INPUTS", value: "U/V Current Vectors & Wind Stress" },
      { label: "METHODOLOGY", value: "Monte Carlo Lagrangian Drift Particles" },
      { label: "TARGET USER", value: "Indian Coast Guard & Maritime Police" },
      { label: "RESPONSE TIME", value: "Instant interactive 3D vector inspection" },
    ],
    referenceUrl: "https://incois.gov.in/portal/sarops.jsp",
    referenceLabel: "INCOIS SAROPS System",
    explorerMode: "volume",
  },
  "Fishery Advisory": {
    title: "Fishery Advisory & Potential Fishing Zones",
    category: "Why Does This Matter?",
    badge: "PFZ & Thermal Fronts",
    explanation:
      "Marine biological productivity concentrates along oceanic thermal fronts, upwelling zones, and chlorophyll gradients. SagarDrishti-3D fuses BGC chlorophyll-a data with Sea Surface Temperature (SST) to identify Potential Fishing Zones (PFZ), optimizing fishing effort and conserving fuel.",
    keyPoints: [
      "Thermal front and chlorophyll gradient intersection mapping.",
      "Daily advisory support for artisanal and commercial fishing fleets.",
      "Safeguards ecologically sensitive zones and overfished marine habitats.",
    ],
    facts: [
      { label: "CORE SENSORS", value: "MODIS / Sentinel-3 Ocean Color & SST" },
      { label: "SOCIO-ECONOMIC BENEFIT", value: "30-40% reduction in fishing search time" },
      { label: "USER REACH", value: "Over 500,000 fishers across India" },
      { label: "UPDATE CADENCE", value: "Daily operational advisory bulletin" },
    ],
    referenceUrl: "https://incois.gov.in/portal/pfz/pfz.jsp",
    referenceLabel: "INCOIS PFZ Mission Portal",
    explorerMode: "volume",
  },
  "Climate Monitoring": {
    title: "Climate Monitoring & Ocean Heat Content",
    category: "Why Does This Matter?",
    badge: "Indian Ocean Dipole (IOD)",
    explanation:
      "The Indian Ocean absorbs a substantial portion of global oceanic excess heat. SagarDrishti-3D tracks long-term ocean heat content (OHC) anomalies, thermocline depth variations, and the Indian Ocean Dipole (IOD), providing scientists with high-resolution volumetric climate indicators.",
    keyPoints: [
      "Indian Ocean Dipole (IOD) index tracking and thermocline depth anomalies.",
      "Decadal ocean heat content (OHC) volumetric integration across depth strata.",
      "Supports IPCC climate reporting and South Asian monsoon teleconnection research.",
    ],
    facts: [
      { label: "CLIMATE MODES", value: "Positive/Negative IOD, El Niño / IOD" },
      { label: "HEAT SINK", value: "Upper 2,000 m Ocean Heat Content" },
      { label: "STANDARDS", value: "IPCC AR6 & WMO Climate Indicators" },
      { label: "DATA LENGTH", value: "Multi-decadal validated reanalysis" },
    ],
    referenceUrl: "https://incois.gov.in/portal/climatology.jsp",
    referenceLabel: "INCOIS Climate Services",
    explorerMode: "volume",
  },
}

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
  ctaText?: string
  ctaAction?: () => void
}

function useTypewriter(text: string, speed = 8) {
  const [displayedText, setDisplayedText] = useState("")
  const [isTypingDone, setIsTypingDone] = useState(false)

  useEffect(() => {
    setDisplayedText("")
    setIsTypingDone(false)
    if (!text) return

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setIsTypingDone(true)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayedText, isTypingDone }
}

function GlassConceptModal({
  conceptKey,
  onClose,
  onLaunch,
}: {
  conceptKey: string
  onClose: () => void
  onLaunch: (mode?: "volume" | "globe") => void
}) {
  const detail = STUDY_CONCEPTS[conceptKey]
  const { displayedText, isTypingDone } = useTypewriter(detail?.explanation ?? "", 6)

  if (!detail) return null

  return (
    <motion.div
      key="concept-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        key="concept-glass-card"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/90 backdrop-blur-2xl border border-slate-300/90 shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-6 md:p-7 text-slate-800 flex flex-col gap-4 font-sans"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#0284c7]">
              {detail.category}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-100 border border-slate-300 text-slate-700">
              {detail.badge}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#0a2540] tracking-tight">
            {detail.title}
          </h2>
        </div>

        {/* Typing Explanation Box */}
        <div className="p-4 rounded-xl bg-slate-100/90 border border-slate-200/90 text-xs sm:text-sm text-slate-700 leading-relaxed min-h-[75px]">
          {displayedText}
          {!isTypingDone && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-sky-500 animate-pulse align-middle" />
          )}
        </div>

        {/* Key Scientific Points */}
        {detail.keyPoints && detail.keyPoints.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">
              Key Scientific Observations
            </span>
            <ul className="space-y-1.5">
              {detail.keyPoints.map((point, i) => (
                <li key={i} className="text-xs text-slate-700 pl-4 relative leading-relaxed">
                  <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata Facts Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs font-mono">
          {detail.facts.map((fact, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200/80 flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
                {fact.label}
              </span>
              <span className="text-[#0a2540] font-bold text-[11px] mt-0.5 truncate">{fact.value}</span>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {detail.referenceUrl ? (
            <a
              href={detail.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold transition-all"
            >
              <span>{detail.referenceLabel ?? "Official Research Reference"}</span>
              <span className="text-xs font-mono">↗</span>
            </a>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">INCOIS Verified Dataset</span>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose()
                onLaunch(detail.explorerMode ?? "volume")
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#0a2e5c] hover:bg-[#072142] text-white text-xs font-bold tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Explore in 3D Workstation</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function StudyRegionPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStep, setActiveStep] = useState(0)
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  const navModals: Record<string, InfoModalData> = {
    observations: {
      title: "In-situ Ocean Observations",
      subtitle: "Real-time and archived observational platforms across the Indian Ocean basin.",
      icon: "📡",
      sections: [
        { heading: "Autonomous Argo Floats (460+ Active)", body: "Autonomous profilers descending to 2000m depth every 10 days, delivering CTD and bio-geochemical profiles." },
        { heading: "Gliders & Ship-borne CTD Transects", body: "High-resolution spatial cross-sections along critical maritime corridors and EEZ boundaries." },
      ],
      ctaText: "Inspect In-situ Platforms →",
      ctaAction: () => launchExplorer("globe"),
    },
    dataServices: {
      title: "Data Services & OGC Interoperability",
      subtitle: "Standardized geospatial ocean data feeds adhering to international ocean standards.",
      icon: "🗄️",
      sections: [
        { heading: "NetCDF-4 & CF-1.8 Compliance", body: "Fully compliant CF metadata conventions supporting multi-dimensional slicing across latitude, longitude, depth, and time coordinates." },
        { heading: "Open Geospatial Consortium (OGC) Standards", body: "Direct WMS, WFS, and ERDDAP endpoints ensuring seamless interoperability with INCOIS RSMC and global oceanographic portals." },
      ],
      ctaText: "Open 3D Data Services →",
      ctaAction: () => launchExplorer("volume"),
    },
    resources: {
      title: "Documentation & Resources",
      subtitle: "User guides, scientific methodology, and Hackathon problem statement specifications.",
      icon: "📖",
      sections: [
        { heading: "SIH 2026 Problem Statement 26067", body: "3D Visualization of Ocean Model Data and in-situ Observations by INCOIS & Ministry of Earth Sciences." },
        { heading: "User Manual & Guided Tour", body: "Interactive walkthroughs covering volume slicing, isosurfaces, current vector densities, and model-vs-observation comparisons." },
      ],
      ctaText: "Launch Interactive Explorer →",
      ctaAction: () => launchExplorer("volume"),
    },
    about: {
      title: "About SAGARDRISHTI-3D",
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

  const steps = [
    { title: "Understand\nThe Ocean", id: "sec-understand" },
    { title: "Observe\nThe Ocean", id: "sec-observe" },
    { title: "Data &\nAnalysis", id: "sec-data" },
    { title: "Why It\nMatters", id: "sec-why" },
    { title: "Get\nStarted", id: "sec-start" },
  ]

  function scrollToSection(index: number, id: string) {
    setActiveStep(index)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  function handleScroll() {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    
    const sectionIds = ["sec-understand", "sec-observe", "sec-data", "sec-why", "sec-start"]
    for (let i = sectionIds.length - 1; i >= 0; i--) {
      const el = document.getElementById(sectionIds[i])
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= containerRect.top + 140) {
          setActiveStep(i)
          break
        }
      }
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#eaf4fd] text-slate-900 selection:bg-sky-100 selection:text-sky-900 font-sans">

      {/* ────────────────────────────────────────────────────────────
          1. INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        
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

            {/* Center: National Tagline */}
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
                  <svg className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search datasets, variables, regions..."
                    className="w-full text-xs text-slate-700 bg-transparent placeholder-slate-400 focus:outline-none"
                  />
                  <button type="submit" className="ml-1 text-slate-400 hover:text-sky-600 transition cursor-pointer" title="Search">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </form>

              <button
                onClick={() => setInfoModal(navModals.about)}
                className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer"
                title="User Profile"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Navigation Bar — STUDY REGION IS ACTIVE */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
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

                {/* Study Region — ACTIVE (Blue underline) */}
                <button
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Study Region</span>
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
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

              {/* Right: Launch Explorer Pill */}
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
          2. MAIN STUDY REGION WORKSPACE (EQUAL 50% / 50% SPLIT WITH MASTER BG)
      ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/landing/study-region-bg-v3.jpg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >

        {/* ── LEFT PANEL: Information / Knowledge Flow (50% Width) ── */}
        <div className="w-full lg:w-1/2 shrink-0 flex flex-col z-10 overflow-hidden bg-transparent">
          
          {/* Header intro of left panel */}
          <div className="px-5 pt-3.5 pb-2.5 shrink-0 bg-transparent">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284c7] hover:text-[#0369a1] mb-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </button>

            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-[17.5px] font-black text-[#0f294a] leading-snug tracking-tight">
                  Indian Ocean Study Region
                </h1>
                <p className="text-[11px] text-slate-600 font-medium mt-1 leading-relaxed max-w-[310px]">
                  Explore ocean variables, observations and processes in the Indian Ocean region through an interactive 3D environment. Click any card to inspect scientific details.
                </p>
              </div>

              {/* Blue Wave Icon / Badge */}
              <div className="shrink-0 flex flex-col items-center justify-center p-1.5 text-center">
                <svg className="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[8.5px] font-bold text-sky-800 leading-tight block mt-0.5">Knowledge<br/>for a Safer<br/>Ocean</span>
              </div>
            </div>
          </div>

          {/* Body with vertical timeline + scrollable cards */}
          <div className="flex flex-1 overflow-hidden min-h-0 bg-transparent">

            {/* Left vertical timeline rail */}
            <div className="relative flex flex-col pl-3 pt-3 pr-1 shrink-0 w-[78px] bg-transparent">
              <div className="absolute left-[18px] top-6 bottom-8 w-[2px] bg-sky-100 rounded-full" />
              {steps.map((step, idx) => {
                const isActive = activeStep === idx
                return (
                  <div key={idx} className="relative flex-1 flex flex-col justify-center my-1.5">
                    <button
                      onClick={() => scrollToSection(idx, step.id)}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                            isActive
                              ? "bg-[#0284c7] border-[#0284c7] shadow-[0_0_0_3px_rgba(2,132,199,0.25)] scale-110"
                              : "bg-white border-slate-300 group-hover:border-sky-400 group-hover:scale-105"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[9px] font-bold text-center leading-tight transition-colors whitespace-pre-line mt-1.5 ${
                          isActive ? "text-[#0284c7]" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      >
                        {step.title}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Scrollable sections */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-3.5 space-y-5 scrollbar-thin scrollbar-thumb-slate-200"
            >

              {/* 1. UNDERSTAND THE OCEAN */}
              <section id="sec-understand">
                <div className="mb-2">
                  <h3 className="text-[11px] font-black tracking-[0.16em] text-slate-800 uppercase">
                    UNDERSTAND THE OCEAN
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Explore the fundamental oceanographic variables
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Temperature */}
                  <button
                    onClick={() => setSelectedConcept("Temperature")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 border border-rose-200">
                      <span className="text-rose-500 text-sm">🌡️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Temperature</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Thermal structure and stratification (°C)</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Salinity */}
                  <button
                    onClick={() => setSelectedConcept("Salinity")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0 border border-cyan-200">
                      <span className="text-cyan-600 text-sm">🌊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Salinity</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Salinity and water-mass characteristics (PSU)</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Currents */}
                  <button
                    onClick={() => setSelectedConcept("Currents")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 border border-teal-200">
                      <span className="text-teal-600 text-sm">🌀</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Currents</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">3D ocean circulation (u, v, w in m/s)</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Depth Layers */}
                  <button
                    onClick={() => setSelectedConcept("Depth Layers")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-200">
                      <span className="text-indigo-600 text-sm">🥞</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Depth Layers</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Vertical structure of the ocean (0 – 6,000 m)</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>
                </div>
              </section>

              {/* 2. HOW DO WE OBSERVE IT? */}
              <section id="sec-observe">
                <div className="mb-2">
                  <h3 className="text-[11px] font-black tracking-[0.16em] text-slate-800 uppercase">
                    HOW DO WE OBSERVE IT?
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    In-situ observing platforms providing real-world ocean data
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Argo Floats */}
                  <button
                    onClick={() => setSelectedConcept("Argo Floats")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0 border border-yellow-200">
                      <span className="text-yellow-600 text-sm">🛟</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Argo Floats</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Global profiles of temperature and salinity</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Gliders */}
                  <button
                    onClick={() => setSelectedConcept("Gliders")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-200">
                      <span className="text-emerald-600 text-sm">✈️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Gliders</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">High-resolution transects and time series</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* CTD */}
                  <button
                    onClick={() => setSelectedConcept("CTD")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                      <span className="text-blue-600 text-sm">⚓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">CTD</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Detailed vertical profiles</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* BGC Sensors */}
                  <button
                    onClick={() => setSelectedConcept("BGC Sensors")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0 border border-green-200">
                      <span className="text-green-600 text-sm">🌱</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">BGC Sensors</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Biogeochemical observations (e.g., chlorophyll)</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>
                </div>
              </section>

              {/* 3. DATA & ANALYSIS */}
              <section id="sec-data">
                <div className="mb-2">
                  <h3 className="text-[11px] font-black tracking-[0.16em] text-slate-800 uppercase">
                    DATA & ANALYSIS
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    From models to meaningful insights
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  {/* Model Data */}
                  <button
                    onClick={() => setSelectedConcept("Model Data")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 border border-teal-200">
                      <span className="text-teal-600 text-sm">🗄️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Model Data</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">CMEMS ocean model outputs</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Observational Data */}
                  <button
                    onClick={() => setSelectedConcept("Observational Data")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-200">
                      <span className="text-indigo-600 text-sm">📊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Observational Data</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Argo, Glider, CTD, BGC</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>
                </div>

                {/* Model vs Observation Comparison (Full Width Card) */}
                <button
                  onClick={() => setSelectedConcept("Model vs Observation Comparison")}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left w-full group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                    <span className="text-blue-700 text-base">⚖️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 leading-tight">Model vs Observation Comparison</p>
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">Validate and compare model data with in-situ observations</p>
                  </div>
                  <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-sm font-bold">→</span>
                </button>
              </section>

              {/* 4. WHY DOES THIS MATTER? */}
              <section id="sec-why">
                <div className="mb-2">
                  <h3 className="text-[11px] font-black tracking-[0.16em] text-slate-800 uppercase">
                    WHY DOES THIS MATTER?
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Real-world impact and decision support
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Hazard Assessment */}
                  <button
                    onClick={() => setSelectedConcept("Hazard Assessment")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 border border-red-200">
                      <span className="text-red-500 text-sm">⚠️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Hazard Assessment</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Understand ocean conditions for better preparedness</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Search & Rescue */}
                  <button
                    onClick={() => setSelectedConcept("Search & Rescue")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 border border-orange-200">
                      <span className="text-orange-500 text-sm">🛟</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Search & Rescue</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Analyze currents and support search operations</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Fishery Advisory */}
                  <button
                    onClick={() => setSelectedConcept("Fishery Advisory")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0 border border-cyan-200">
                      <span className="text-cyan-600 text-sm">🐟</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Fishery Advisory</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Explore productive marine environments</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>

                  {/* Climate Monitoring */}
                  <button
                    onClick={() => setSelectedConcept("Climate Monitoring")}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-300/90 bg-[#f1f5f9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-white hover:border-sky-500 hover:shadow-md transition-all text-left group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-200">
                      <span className="text-indigo-600 text-sm">📈</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">Climate Monitoring</p>
                      <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">Visualize long-term ocean variability</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all text-xs">→</span>
                  </button>
                </div>
              </section>

              {/* 5. READY TO EXPLORE? */}
              <section id="sec-start" className="pt-1 pb-3">
                <div className="mb-2.5">
                  <h3 className="text-[11px] font-black tracking-[0.16em] text-slate-800 uppercase">
                    READY TO EXPLORE?
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                    Dive into the interactive 3D ocean and explore real data across space, depth and time.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => launchExplorer("volume")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0066cc] hover:bg-[#0052cc] text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <svg className="w-4 h-4 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                      <path strokeWidth="1.8" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    <span>Launch 3D Ocean Explorer</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="text-[9.5px] text-slate-400 font-medium leading-tight">
                      Explore<br/>Analyze<br/>Understand<br/>Contribute
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Master Background Globe View (50% Width) ── */}
        <div className="w-full lg:w-1/2 flex-1 bg-transparent relative overflow-hidden pointer-events-none" />

      </div>

      {/* ────────────────────────────────────────────────────────────
          3. WHITE & GRAY GLASSMORPHISM CONCEPT INSPECTION MODAL
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedConcept && (
          <GlassConceptModal
            conceptKey={selectedConcept}
            onClose={() => setSelectedConcept(null)}
            onLaunch={launchExplorer}
          />
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────
          4. HEADER INFO MODALS (OBSERVATIONS / SERVICES / ABOUT)
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal && (
          <motion.div
            key="modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(5,20,40,0.55)", backdropFilter: "blur(6px)" }}
            onClick={() => setInfoModal(null)}
          >
            <motion.div
              key="modal-box"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
            >
              <button
                onClick={() => setInfoModal(null)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{infoModal.icon}</span>
                <div>
                  <h2 className="text-base font-black text-[#0a2540]">{infoModal.title}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">{infoModal.subtitle}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 mb-5">
                {infoModal.sections.map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[12px] font-bold text-slate-800 mb-1">{s.heading}</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
              {infoModal.ctaText && (
                <button
                  onClick={() => { infoModal.ctaAction?.(); setInfoModal(null) }}
                  className="w-full py-2.5 rounded-xl bg-[#0a2e5c] hover:bg-[#072142] text-white text-xs font-bold tracking-wide transition-colors"
                >
                  {infoModal.ctaText}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
