"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export interface ConceptDetail {
  title: string
  category: "Physical Oceanography" | "Observation Systems" | "System Architecture" | "Core Concepts"
  badge: string
  explanation: string
  keyPoints: string[]
  facts: { label: string; value: string }[]
  referenceUrl?: string
  referenceLabel?: string
}

export const CONCEPTS_DATA: Record<string, ConceptDetail> = {
  "Temperature": {
    title: "Ocean Temperature",
    category: "Physical Oceanography",
    badge: "Variable: thetao · Unit: °C",
    explanation:
      "Ocean temperature varies continuously across horizontal space and vertical depth. Solar insolation warms the upper epipelagic layer, while vertical density stratification creates a steep thermocline before transitioning to cold abyssal waters. In numerical ocean models, potential temperature is represented by the variable thetao in units of °C.",
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
  },
  "Salinity": {
    title: "Practical Salinity",
    category: "Physical Oceanography",
    badge: "Variable: so · Unit: PSU",
    explanation:
      "Practical salinity measures the concentration of dissolved mineral salts in seawater, serving as a primary driver of ocean density and global thermohaline circulation. Fresh river runoff and monsoonal precipitation create low-salinity surface pools in the Bay of Bengal, contrasting with intense evaporation in the Arabian Sea. In numerical models, salinity is represented by the variable so in Practical Salinity Units (PSU).",
    keyPoints: [
      "Governs seawater density, halosteric sea level changes, and vertical stability.",
      "Extreme basin contrast: Arabian Sea (>36 PSU) vs Bay of Bengal (<33 PSU).",
      "Essential for tracking river plumes, barrier layers, and deep water mass formation.",
    ],
    facts: [
      { label: "MODEL VARIABLE", value: "so / salt_annual" },
      { label: "STANDARD UNIT", value: "PSU (1e-3 practical scale)" },
      { label: "PHYSICAL ROLE", value: "Density & Buoyancy Driver" },
      { label: "BASIN CONTRAST", value: "Arabian Sea vs Bay of Bengal" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    referenceLabel: "Copernicus Marine Salinity Reference",
  },
  "Currents": {
    title: "Ocean Currents & Velocity Vectors",
    category: "Physical Oceanography",
    badge: "Variables: uo, vo · Unit: m/s",
    explanation:
      "Ocean currents transport immense volumes of heat, salt, and momentum across the ocean basin. The horizontal velocity vector is decomposed into orthogonal components: uo for eastward (zonal) velocity and vo for northward (meridional) velocity, with current speed magnitude computed as √(uo² + vo²). In SagarDrishti-3D, dynamic 3D vector arrows visualize speed and direction throughout the vertical water column.",
    keyPoints: [
      "Vector decomposition into orthogonal components uo (zonal) and vo (meridional).",
      "Current speed magnitude computed strictly as Speed = √(uo² + vo²).",
      "Features semiannual reversal driven by the Southwest and Northeast Monsoons.",
      "Instanced 3D velocity arrows reveal Somali Current and equatorial undercurrents.",
    ],
    facts: [
      { label: "CURRENT SPEED", value: "Speed = √(uo² + vo²) in m/s" },
      { label: "ZONAL VECTOR (U)", value: "uo (Eastward Velocity in m/s)" },
      { label: "MERIDIONAL VECTOR (V)", value: "vo (Northward Velocity in m/s)" },
      { label: "MODEL SOURCE", value: "HYCOM / Copernicus CMEMS" },
      { label: "DYNAMIC REVERSAL", value: "Southwest & Northeast Monsoons" },
    ],
    referenceUrl: "https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description",
    referenceLabel: "HYCOM / CMEMS Velocity Data",
  },
  "Depth Layers": {
    title: "Depth Stratification & Slices",
    category: "Physical Oceanography",
    badge: "Levels: 25–54 Standard Depths",
    explanation:
      "The ocean is vertically structured into distinct strata: the sunlit surface mixed layer (0–200m), the sharp pycnocline/thermocline transition layer, and the deep bathypelagic abyss. Depth-resolved numerical models and autonomous profilers sample these discrete vertical layers. SagarDrishti-3D provides real-time vertical exaggeration (10×–200×) for comprehensive structural analysis.",
    keyPoints: [
      "Interactive horizontal depth slicing from 0 to 6,000 meters.",
      "Adjustable 10× to 200× vertical exaggeration highlights subtle thermoclines.",
      "Integrated bathymetry mesh provides data-derived seafloor topography context.",
    ],
    facts: [
      { label: "VERTICAL RESOLUTION", value: "25–54 discrete standard levels" },
      { label: "DEPTH SLICING", value: "Interactive horizontal planes" },
      { label: "VERTICAL EXAGGERATION", value: "10× to 200× adjustable scale" },
      { label: "BATHYMETRY", value: "Data-derived seafloor topography" },
    ],
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
      "Real-time sensor transmission via Iridium/Argos satellite communication links.",
    ],
    facts: [
      { label: "ACTIVE FLOATS", value: "492 platforms across Indian Ocean" },
      { label: "TOTAL PROFILES", value: "22,231 verified casts in dataset" },
      { label: "PARKING DEPTH", value: "1,000 m drifting · 2,000 m profiling" },
      { label: "DATA SOURCE", value: "NOAA NCEI World Ocean Database (WOD)" },
    ],
    referenceUrl: "https://www.ncei.noaa.gov/access/world-ocean-database-select/dbsearch.html",
    referenceLabel: "NOAA NCEI WOD Float Registry",
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
  },
  "CTD Profiles": {
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
  },
  "What am I looking at?": {
    title: "SagarDrishti-3D Overview",
    category: "System Architecture",
    badge: "INCOIS SIH26067 Solution",
    explanation:
      "You are viewing SagarDrishti-3D, a browser-native 3D oceanographic visualization and analysis workspace developed for INCOIS (Ministry of Earth Sciences). It fuses 3D gridded numerical model fields (Copernicus / WOA23) with real in-situ autonomous sensor observations (Argo, Gliders, CTD, BGC) in a unified interactive environment.",
    keyPoints: [
      "Interactive 3D volumetric rendering over India's EEZ and the Indian Ocean.",
      "Dual-mode architecture: offline binary store and live FastAPI streaming backend.",
      "Real-time assimilation lens for calculating point-by-point model error residuals.",
    ],
    facts: [
      { label: "STUDY REGION", value: "Indian Ocean & India's EEZ" },
      { label: "COORDINATES", value: "Lat -35° to +30° · Lon 40° to 100°" },
      { label: "TARGET USER", value: "Operational Oceanographers & Forecasters" },
      { label: "TECHNOLOGY", value: "WebGL, Three.js, React 19, FastAPI" },
    ],
  },
  "Why am I looking at this?": {
    title: "SagarDrishti-3D Overview",
    category: "System Architecture",
    badge: "INCOIS SIH26067 Solution",
    explanation:
      "You are viewing SagarDrishti-3D, a browser-native 3D oceanographic visualization and analysis workspace developed for INCOIS (Ministry of Earth Sciences). It fuses 3D gridded numerical model fields (Copernicus / WOA23) with real in-situ autonomous sensor observations (Argo, Gliders, CTD, BGC) in a unified interactive environment.",
    keyPoints: [
      "Interactive 3D volumetric rendering over India's EEZ and the Indian Ocean.",
      "Dual-mode architecture: offline binary store and live FastAPI streaming backend.",
      "Real-time assimilation lens for calculating point-by-point model error residuals.",
    ],
    facts: [
      { label: "STUDY REGION", value: "Indian Ocean & India's EEZ" },
      { label: "COORDINATES", value: "Lat -35° to +30° · Lon 40° to 100°" },
      { label: "TARGET USER", value: "Operational Oceanographers & Forecasters" },
      { label: "TECHNOLOGY", value: "WebGL, Three.js, React 19, FastAPI" },
    ],
  },
  "How do scientists observe the ocean?": {
    title: "Global Ocean Observing Network",
    category: "System Architecture",
    badge: "GOOS / INCOIS Network",
    explanation:
      "Operational ocean observation relies on a multi-tiered observing system: earth-observation satellites for surface skin temperatures and altimetry, robotic Argo floats and gliders for continuous subsurface water columns, and research vessels for deep-water baseline validation.",
    keyPoints: [
      "Satellite remote sensing provides wide-swath surface skin boundary conditions.",
      "Robotic autonomous profilers provide continuous subsurface vertical columns.",
      "Vessel surveys calibrate autonomous sensors and capture deep abyssal water masses.",
    ],
    facts: [
      { label: "SATELLITE", value: "Surface altimetry, SST, ocean color" },
      { label: "IN-SITU AUTONOMOUS", value: "Argo profiling floats & gliders" },
      { label: "VESSEL SURVEYS", value: "Deep-water CTD & mooring arrays" },
      { label: "DATA ASSIMILATION", value: "Real-time feeding into numerical models" },
    ],
  },
  "How do scientists observe ocean?": {
    title: "Global Ocean Observing Network",
    category: "System Architecture",
    badge: "GOOS / INCOIS Network",
    explanation:
      "Operational ocean observation relies on a multi-tiered observing system: earth-observation satellites for surface skin temperatures and altimetry, robotic Argo floats and gliders for continuous subsurface water columns, and research vessels for deep-water baseline validation.",
    keyPoints: [
      "Satellite remote sensing provides wide-swath surface skin boundary conditions.",
      "Robotic autonomous profilers provide continuous subsurface vertical columns.",
      "Vessel surveys calibrate autonomous sensors and capture deep abyssal water masses.",
    ],
    facts: [
      { label: "SATELLITE", value: "Surface altimetry, SST, ocean color" },
      { label: "IN-SITU AUTONOMOUS", value: "Argo profiling floats & gliders" },
      { label: "VESSEL SURVEYS", value: "Deep-water CTD & mooring arrays" },
      { label: "DATA ASSIMILATION", value: "Real-time feeding into numerical models" },
    ],
  },
  "Why does this matter?": {
    title: "Societal & Scientific Significance",
    category: "Core Concepts",
    badge: "Climate & National Impact",
    explanation:
      "The Indian Ocean governs the South Asian Monsoon, dictates tropical cyclone rapid intensification, absorbs massive quantities of anthropogenic heat and carbon, and sustains rich marine ecosystems. Understanding its 3D thermal and salinity structure is critical for maritime safety, weather forecasting, and coastal protection.",
    keyPoints: [
      "Direct thermal forcing controls South Asian Monsoon precipitation timing and strength.",
      "Upper ocean heat content (OHC) directly fuels tropical cyclone intensification.",
      "Informs maritime exclusive economic zone (EEZ) management and coastal hazard defense.",
    ],
    facts: [
      { label: "MONSOON PREDICTION", value: "Direct thermal forcing on rainfall" },
      { label: "CYCLONE INTENSITY", value: "Ocean Heat Content (OHC) analysis" },
      { label: "CLIMATE REGULATION", value: "Global heat and carbon sink" },
      { label: "EEZ MANAGEMENT", value: "Fisheries and maritime security" },
    ],
  },
  "Space Dimensions": {
    title: "Geographic Coordinate Space",
    category: "Core Concepts",
    badge: "Lat: -35°..30° · Lon: 40°..100°",
    explanation:
      "Ocean model fields and observation points are mapped across standardized spherical geographic coordinates (latitude and longitude on the WGS84 datum). SagarDrishti-3D covers the Arabian Sea, Bay of Bengal, Equatorial Indian Ocean, and southern tropical waters.",
    keyPoints: [
      "High-resolution 0.083° (~9 km) structured grid spanning the Indian Ocean basin.",
      "Exact geospatial projection mapped onto realistic 3D spherical Earth geometry.",
      "Includes India's 200-nautical-mile Exclusive Economic Zone boundary context.",
    ],
    facts: [
      { label: "LATITUDE BOUNDS", value: "-35.0°S to +30.0°N" },
      { label: "LONGITUDE BOUNDS", value: "40.0°E to 100.0°E" },
      { label: "GRID SPACING", value: "0.083° (~9 km) model resolution" },
      { label: "COASTLINE MAPPING", value: "High-resolution vector boundaries" },
    ],
  },
  "Depth Stratification": {
    title: "Vertical Density Stratification",
    category: "Core Concepts",
    badge: "Epipelagic to Abyssal Abyss",
    explanation:
      "Seawater density increases monotonically with depth due to cooling temperature and increasing salinity. This stratification separates the buoyant upper mixed layer from the stable deep ocean, dictating vertical turbulent mixing, internal wave propagation, and oxygen minimum zones (OMZ).",
    keyPoints: [
      "Distinct layering: Surface Mixed Layer, Main Thermocline, Abyssal Plain.",
      "Pycnocline prevents deep nutrient mixing except during strong monsoon upwelling.",
      "Visualized with interactive 3D isosurfaces and vertical slice curtains.",
    ],
    facts: [
      { label: "MIXED LAYER", value: "0–100 m wind-stirred surface layer" },
      { label: "THERMOCLINE", value: "100–500 m sharp temperature drop" },
      { label: "DEEP WATER", value: "Cold, dense Antarctic intermediate waters" },
      { label: "STABILITY", value: "Quantified by Brunt-Väisälä frequency (N²)" },
    ],
  },
  "Time Dynamics": {
    title: "Temporal Evolution & Animation",
    category: "Core Concepts",
    badge: "Daily / Monthly Time Series",
    explanation:
      "Ocean conditions undergo rapid temporal variations driven by wind stress, monsoon reversals, and eddy dynamics. SagarDrishti-3D provides interactive timeline controls, continuous simulation playback, and frame-by-frame seasonal progression to analyze dynamic oceanic processes.",
    keyPoints: [
      "Continuous 90-day time-series and 12-month seasonal climatological cycles.",
      "Interactive timeline scrubber with variable playback speeds (0.5× to 4.0×).",
      "Dynamic visualization of Indian Ocean Dipole (IOD) and monsoon currents.",
    ],
    facts: [
      { label: "TIME SERIES", value: "90 daily steps & 12 monthly climatologies" },
      { label: "PLAYBACK SPEED", value: "0.5×, 1×, 2×, 4× variable speeds" },
      { label: "MONSOON CYCLES", value: "Seasonal current and SST reversals" },
      { label: "SIMULATION CLOCK", value: "Synchronized observation evidence lens" },
    ],
  },
  "Model vs Obs": {
    title: "Model Validation & Assimilation",
    category: "System Architecture",
    badge: "Error Residuals: Obs - Model",
    explanation:
      "Numerical ocean models simulate geophysical hydrodynamics on discrete grids, but require rigorous observational validation. In SagarDrishti-3D, in-situ float profiles are matched with co-located model cells to compute point-by-point error residuals, Bias, RMSE, and Mean Absolute Error (MAE).",
    keyPoints: [
      "Co-location engine samples 3D model grids at exact instrument depths and coordinates.",
      "Calculates statistical metrics: Bias, RMSE, MAE, and Maximum Absolute Error.",
      "Interactive depth-by-depth residual table and fleet-wide validation scatter plot.",
    ],
    facts: [
      { label: "ERROR METRIC", value: "Residual = Observed - Model Value" },
      { label: "STATISTICAL RIGOR", value: "Bias, RMSE, MAE, Max Absolute Error" },
      { label: "FLEET SCATTER", value: "Fleet-wide 1:1 validation correlation" },
      { label: "OPERATIONAL GOAL", value: "Quantify forecast model confidence" },
    ],
  },
  "How Data Works": {
    title: "NetCDF & WebGL Data Pipeline",
    category: "System Architecture",
    badge: "NetCDF-4 → xarray → uint8 → GPU",
    explanation:
      "Raw CF-compliant NetCDF-4 model datasets are parsed server-side with Python xarray and NumPy. 3D fields are cropped, depth-sliced, and quantized into ultra-compact 8-bit binary buffers (uint8). The frontend streams these buffers directly to custom WebGL fragment shaders that reconstruct physical values at 60 FPS.",
    keyPoints: [
      "Server-side lazy chunked slicing with Python xarray and NetCDF4/HDF5.",
      "GPU-quantized uint8 streaming: full seasonal 3D volume fits in <1 MB.",
      "Custom WebGL bilinear shaders perform instant real-time colormap mapping.",
    ],
    facts: [
      { label: "INGESTION", value: "xarray, NetCDF4, HDF5, NumPy" },
      { label: "QUANTIZATION", value: "uint8 (254 steps + 255 NaN fill)" },
      { label: "GPU SHADER", value: "Real-time bilinear ColormapShader LUT" },
      { label: "BANDWIDTH EFFICIENCY", value: "<1 MB per seasonal 3D volume" },
    ],
  },
}

/** Smooth typewriter animation hook */
function useTypewriter(text: string, speed = 12) {
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

export default function ConceptInfoCard({
  activeTerm,
  onClose,
}: {
  activeTerm: string | null
  onClose: () => void
}) {
  const detail = activeTerm ? CONCEPTS_DATA[activeTerm] : null
  const { displayedText, isTypingDone } = useTypewriter(detail?.explanation ?? "", 10)

  if (!activeTerm || !detail) return null

  return (
    <motion.div
      key={activeTerm}
      initial={{ opacity: 0, x: -20, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full h-full flex flex-col justify-between glass bg-[#081a33]/95 backdrop-blur-2xl p-6 md:p-8 rounded-2xl border border-sky-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-slate-100 overflow-y-auto scroll-thin"
    >
      <div className="flex flex-col gap-4">
        {/* ─── Top Actions Bar ─── */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 text-xs font-semibold transition-colors"
          >
            <span>←</span> Back to Scientific Journey
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close card"
          >
            ✕
          </button>
        </div>

        {/* ─── Header & Badges ─── */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-widest font-bold text-sky-400">
              {detail.category}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold">
              {detail.badge}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {detail.title}
          </h2>
        </div>

        {/* ─── Typing Explanation Body ─── */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-sm md:text-base text-slate-200 leading-relaxed min-h-[90px]">
          {displayedText}
          {!isTypingDone && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />
          )}
        </div>

        {/* ─── Key Scientific Points ─── */}
        {detail.keyPoints && detail.keyPoints.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-sky-400/90 block">
              Key Scientific Observations
            </span>
            <ul className="space-y-1.5">
              {detail.keyPoints.map((point, i) => (
                <li key={i} className="text-xs md:text-sm text-slate-300 pl-4 relative leading-relaxed">
                  <span className="absolute left-0 top-[8px] w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ─── Metadata Facts Grid ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 font-mono text-xs"
        >
          {detail.facts.map((fact, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block">
                {fact.label}
              </span>
              <span className="text-sky-300 font-bold mt-0.5 truncate">{fact.value}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ─── Footer with Official Reference ─── */}
      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Official INCOIS/WOD Resource:</span>
        {detail.referenceUrl ? (
          <a
            href={detail.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>{detail.referenceLabel ?? "Learn more"}</span>
            <span>↗</span>
          </a>
        ) : (
          <span className="text-sky-400/80 font-mono text-[10px]">INCOIS Verified Data</span>
        )}
      </div>
    </motion.div>
  )
}
