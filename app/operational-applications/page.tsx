"use client"

import React, { useState, useRef, useEffect, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import EarthSphere from "@/components/page3/globe/EarthSphere"
import { ObservationItem, fetchObservations } from "@/lib/observationsApi"
import { fetchModelField, ModelFieldResponse } from "@/lib/modelApi"

// ─── 1. REAL MODEL TIME & DEPTH CONFIGURATIONS ────────────────────────────────
const AVAILABLE_MODEL_DATES = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2026, 0, 1 + i)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    label: `${dd} ${monthNames[d.getMonth()]} 2026 12:00 UTC`,
  }
})

const AVAILABLE_DEPTHS = [
  { value: "0.5", label: "Surface (0.5 m)" },
  { value: "11.4", label: "Sub-surface (11.4 m)" },
  { value: "25.2", label: "Upper Layer (25.2 m)" },
  { value: "55.8", label: "Euphotic Zone (55.8 m)" },
  { value: "109.7", label: "Thermocline Core (109.7 m)" },
  { value: "222.5", label: "Upper Mesopelagic (222.5 m)" },
  { value: "541.1", label: "Intermediate Depth (541.1 m)" },
  { value: "1062.4", label: "Deep Ocean Layer (1062.4 m)" },
]

// ─── 2. APPLICATION CATEGORIES DATA (SCIENTIFICALLY ACCURATE) ─────────────────
interface AppCategory {
  id: "hazard" | "sar" | "fishery" | "climate"
  title: string
  subtitle: string
  icon: string
  iconBg: string
  iconColor: string
  badgeBg: string
  description: string
  tags: string[]
  aboutTitle: string
  aboutText: string
  parameters: { name: string; icon: string; desc: string }[]
  useCases: { title: string; icon: string; desc: string }[]
  colorScale: {
    title: string
    unit: string
    min: number
    max: number
    gradient: string
    ticks: string[]
  }
  defaultVariable: string
  variables: { id: string; name: string; unit: string }[]
  overlays: {
    coastline: boolean
    currents: boolean
    feature: boolean
    featureName: string
    observations: boolean
    eez: boolean
  }
}

const APPLICATION_CATEGORIES: Record<string, AppCategory> = {
  hazard: {
    id: "hazard",
    title: "Hazard Assessment",
    subtitle: "Visualize ocean conditions to identify and monitor potential environmental hazards",
    icon: "🌊",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-600",
    badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
    description: "Monitor and analyze three-dimensional ocean conditions including thermal patterns, salinity, and currents relevant to marine hazard assessment.",
    tags: ["Temperature", "Salinity", "Currents", "Observations"],
    aboutTitle: "About Hazard Assessment",
    aboutText: "Provides visualization and analysis of three-dimensional ocean conditions relevant to marine hazard assessment. Combines numerical model outputs with in-situ observational datasets to provide environmental situational awareness across the Indian Ocean basin.",
    parameters: [
      { name: "Sea Water Temperature", icon: "🌡️", desc: "Thermal energy distribution and surface gradients" },
      { name: "Sea Water Salinity", icon: "🧂", desc: "Halocline gradients and density stratification" },
      { name: "Ocean Current Velocity", icon: "🧭", desc: "Hydrodynamic circulation: speed = sqrt(uo² + vo²)" },
      { name: "In-situ Observations", icon: "📡", desc: "Argo, Glider, CTD, and BGC profile soundings" },
    ],
    useCases: [
      { title: "Environmental Situational Awareness", icon: "🛡️", desc: "Monitor thermal gradients and hydrodynamic circulation" },
      { title: "Sub-surface Stratification Analysis", icon: "📏", desc: "Analyze depth-resolved thermocline and halocline structures" },
      { title: "Model & Observation Validation", icon: "📡", desc: "Cross-validate numerical fields with in-situ float data" },
      { title: "Regional EEZ Assessment", icon: "🌊", desc: "Examine ocean physical dynamics across Indian EEZ boundaries" },
    ],
    colorScale: {
      title: "Temperature",
      unit: "°C",
      min: 10.0,
      max: 32.0,
      gradient: "from-blue-700 via-sky-400 via-emerald-400 to-rose-600",
      ticks: ["32.0", "26.5", "21.0", "15.5", "10.0"],
    },
    defaultVariable: "thetao",
    variables: [
      { id: "thetao", name: "Sea Water Temperature (°C)", unit: "°C" },
      { id: "so", name: "Sea Water Salinity (PSU)", unit: "PSU" },
      { id: "currents", name: "Current Velocity (m/s)", unit: "m/s" },
    ],
    overlays: {
      coastline: true,
      currents: true,
      feature: true,
      featureName: "Thermal Gradient Boundary",
      observations: true,
      eez: true,
    },
  },

  sar: {
    id: "sar",
    title: "Search & Rescue",
    subtitle: "Support SAR maritime planning using ocean currents, depth, and observation information",
    icon: "🛟",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-600",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Supports search-and-rescue planning through analysis of ocean-current conditions, observation locations, depth, and time.",
    tags: ["Currents", "Vector Field", "Observations", "EEZ"],
    aboutTitle: "About Search & Rescue Planning",
    aboutText: "Supports search-and-rescue planning through analysis of ocean-current conditions, observation locations, depth and time. Current magnitude is calculated as sqrt(uo² + vo²) from zonal (uo) and meridional (vo) velocity components.",
    parameters: [
      { name: "Current Velocity Magnitude", icon: "🧭", desc: "Speed computed via sqrt(uo² + vo²)" },
      { name: "Zonal Current U (Eastward)", icon: "➡️", desc: "Eastward velocity component (m/s)" },
      { name: "Meridional Current V (Northward)", icon: "⬆️", desc: "Northward velocity component (m/s)" },
      { name: "Water Temperature", icon: "🌡️", desc: "Thermal conditions for maritime operations" },
      { name: "Observation Positions", icon: "📍", desc: "In-situ float and profile coordinates" },
    ],
    useCases: [
      { title: "Surface Current Vector Analysis", icon: "🧭", desc: "Assess ocean current direction and vector magnitude" },
      { title: "Depth-Resolved Flow Inspection", icon: "📏", desc: "Examine subsurface velocity fields down to 1000m" },
      { title: "Maritime Operational Planning", icon: "🚢", desc: "Review hydrodynamic flow patterns along shipping lanes" },
      { title: "Observation Proximity Review", icon: "📡", desc: "Identify active in-situ platforms in operational zone" },
    ],
    colorScale: {
      title: "Current Speed",
      unit: "m/s",
      min: 0.0,
      max: 2.0,
      gradient: "from-slate-900 via-sky-600 via-teal-400 to-amber-300",
      ticks: ["2.0", "1.5", "1.0", "0.5", "0.0"],
    },
    defaultVariable: "currents",
    variables: [
      { id: "currents", name: "Current Velocity Magnitude (m/s)", unit: "m/s" },
      { id: "uo", name: "Zonal Current U (Eastward) (m/s)", unit: "m/s" },
      { id: "vo", name: "Meridional Current V (Northward) (m/s)", unit: "m/s" },
      { id: "thetao", name: "Water Temperature (°C)", unit: "°C" },
    ],
    overlays: {
      coastline: true,
      currents: true,
      feature: true,
      featureName: "High Velocity Flow Channel",
      observations: true,
      eez: true,
    },
  },

  fishery: {
    id: "fishery",
    title: "Fishery Advisory",
    subtitle: "Explore ocean environmental indicators relevant to marine productivity analysis",
    icon: "🐟",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Supports analysis of oceanographic conditions and environmental indicators relevant to fishery advisory activities.",
    tags: ["Chlorophyll", "Temperature", "Currents", "Salinity"],
    aboutTitle: "About Fishery Environmental Advisory",
    aboutText: "Supports analysis of oceanographic conditions and environmental indicators relevant to fishery advisory activities. Visualizes chlorophyll-a concentration, sea surface temperature, and ocean currents.",
    parameters: [
      { name: "Chlorophyll-a Concentration", icon: "🌿", desc: "Phytoplankton biomass indicator (mg/m³)" },
      { name: "Sea Surface Temperature", icon: "🌡️", desc: "Thermal boundaries and gradient structures" },
      { name: "Ocean Current Velocity", icon: "🧭", desc: "Advection of biophysical nutrients" },
      { name: "Sea Water Salinity", icon: "🧂", desc: "Water mass structure and salinity gradients" },
    ],
    useCases: [
      { title: "Marine Productivity Indicators", icon: "🌿", desc: "Examine chlorophyll-a distribution across regions" },
      { title: "Biophysical Front Analysis", icon: "🌡️", desc: "Identify thermal fronts and chlorophyll gradients" },
      { title: "Ecological Research Support", icon: "📊", desc: "Data support for marine ecosystem modeling" },
      { title: "Seasonal Pattern Exploration", icon: "🔄", desc: "Track temporal changes in chlorophyll and SST" },
    ],
    colorScale: {
      title: "Chlorophyll-a",
      unit: "mg/m³",
      min: 0.05,
      max: 5.0,
      gradient: "from-blue-950 via-teal-600 via-emerald-400 to-yellow-300",
      ticks: ["5.0", "2.5", "1.0", "0.3", "0.05"],
    },
    defaultVariable: "chl",
    variables: [
      { id: "chl", name: "Chlorophyll-a Concentration (mg/m³)", unit: "mg/m³" },
      { id: "thetao", name: "Sea Surface Temperature (°C)", unit: "°C" },
      { id: "currents", name: "Current Velocity (m/s)", unit: "m/s" },
      { id: "so", name: "Sea Water Salinity (PSU)", unit: "PSU" },
    ],
    overlays: {
      coastline: true,
      currents: true,
      feature: true,
      featureName: "High Chlorophyll Front",
      observations: true,
      eez: true,
    },
  },

  climate: {
    id: "climate",
    title: "Climate Monitoring",
    subtitle: "Support temporal and depth-resolved analysis of ocean-state variability",
    icon: "🌡️",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-600",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    description: "Supports temporal and depth-resolved analysis of ocean-state variability across the available model archive.",
    tags: ["Temperature", "Salinity", "Depth Slices", "Temporal Data"],
    aboutTitle: "About Ocean Climate Monitoring",
    aboutText: "Supports temporal and depth-resolved analysis of ocean-state variability across the Indian Ocean basin. Allows researchers to examine temperature, salinity, and depth profiles using available model archive files (Jan–Mar 2026).",
    parameters: [
      { name: "Ocean Temperature", icon: "🌡️", desc: "Depth-resolved thermal distribution (0m to 1000m)" },
      { name: "Sea Water Salinity", icon: "🧂", desc: "Salinity distribution and halocline structure" },
      { name: "Vertical Depth Profiles", icon: "📉", desc: "Subsurface temperature and salinity stratification" },
      { name: "In-situ Profile Soundings", icon: "📡", desc: "Argo float and glider profile validation" },
    ],
    useCases: [
      { title: "Subsurface Thermal Analysis", icon: "📈", desc: "Analyze thermal profile changes down to 1000m depth" },
      { title: "Salinity Distribution Monitoring", icon: "🧂", desc: "Examine spatial and depth salinity variations" },
      { title: "Temporal Ocean State Review", icon: "🗓️", desc: "Track daily model updates across Jan–Mar 2026 archive" },
      { title: "In-situ Profile Comparison", icon: "📡", desc: "Compare model layers with real Argo soundings" },
    ],
    colorScale: {
      title: "Temperature",
      unit: "°C",
      min: 10.0,
      max: 32.0,
      gradient: "from-blue-700 via-sky-300 via-amber-200 to-rose-700",
      ticks: ["32.0", "26.5", "21.0", "15.5", "10.0"],
    },
    defaultVariable: "thetao",
    variables: [
      { id: "thetao", name: "Ocean Temperature (°C)", unit: "°C" },
      { id: "so", name: "Sea Water Salinity (PSU)", unit: "PSU" },
      { id: "currents", name: "Current Velocity (m/s)", unit: "m/s" },
    ],
    overlays: {
      coastline: true,
      currents: false,
      feature: true,
      featureName: "Thermal Isotherm Boundary",
      observations: true,
      eez: true,
    },
  },
}

// ─── 3. DYNAMIC 2D HEATMAP CANVAS RENDERER ─────────────────────────────────────
function Model2DHeatmapCanvas({
  fieldData,
  activeAppKey,
  opacity = 0.65,
}: {
  fieldData: ModelFieldResponse | null
  activeAppKey: string
  opacity?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!fieldData || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height, values, min_value, max_value } = fieldData
    canvas.width = width
    canvas.height = height

    const imgData = ctx.createImageData(width, height)
    const minV = min_value ?? 0
    const maxV = max_value ?? 1
    const range = maxV - minV || 1

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const val = values[r]?.[c]
        const pixelIdx = (r * width + c) * 4
        if (val === null || val === undefined) {
          imgData.data[pixelIdx + 3] = 0
          continue
        }

        const norm = Math.max(0, Math.min(1, (val - minV) / range))

        let red = 0, green = 0, blue = 0
        if (activeAppKey === "fishery") {
          if (norm < 0.33) {
            red = Math.floor(norm * 3 * 20)
            green = Math.floor(norm * 3 * 180)
            blue = Math.floor(200 + norm * 3 * 55)
          } else if (norm < 0.66) {
            const t = (norm - 0.33) * 3
            red = Math.floor(20 + t * 40)
            green = Math.floor(180 + t * 50)
            blue = Math.floor(255 - t * 150)
          } else {
            const t = (norm - 0.66) * 3
            red = Math.floor(60 + t * 195)
            green = Math.floor(230 + t * 25)
            blue = Math.floor(105 - t * 105)
          }
        } else if (activeAppKey === "sar") {
          red = Math.floor(norm * 240)
          green = Math.floor(100 + norm * 140)
          blue = Math.floor(220 - norm * 150)
        } else if (activeAppKey === "climate") {
          if (norm < 0.5) {
            const t = norm * 2
            red = Math.floor(30 + t * 120)
            green = Math.floor(80 + t * 140)
            blue = Math.floor(220 - t * 20)
          } else {
            const t = (norm - 0.5) * 2
            red = Math.floor(150 + t * 105)
            green = Math.floor(220 - t * 160)
            blue = Math.floor(200 - t * 160)
          }
        } else {
          if (norm < 0.5) {
            const t = norm * 2
            red = Math.floor(20 + t * 50)
            green = Math.floor(80 + t * 140)
            blue = Math.floor(220 - t * 70)
          } else {
            const t = (norm - 0.5) * 2
            red = Math.floor(70 + t * 185)
            green = Math.floor(220 - t * 140)
            blue = Math.floor(150 - t * 150)
          }
        }

        imgData.data[pixelIdx] = red
        imgData.data[pixelIdx + 1] = green
        imgData.data[pixelIdx + 2] = blue
        imgData.data[pixelIdx + 3] = Math.floor(opacity * 255)
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [fieldData, activeAppKey, opacity])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-fill pointer-events-none mix-blend-screen transition-opacity duration-300"
    />
  )
}

// ─── 3.5 INDIAN OCEAN 2D MAP PROJECTION & OBSERVATION FALLBACKS ──────────────
function getMapCoords(lat: number, lon: number) {
  const minLon = 40.0
  const maxLon = 100.0
  const minLat = -35.0
  const maxLat = 30.0

  const x = ((lon - minLon) / (maxLon - minLon)) * 100
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100
  return {
    x: Math.max(2, Math.min(98, x)),
    y: Math.max(2, Math.min(98, y)),
  }
}

const FALLBACK_INDIAN_OCEAN_OBSERVATIONS = [
  { lat: 14.5, lon: 65.2 },
  { lat: 11.2, lon: 72.4 },
  { lat: 12.8, lon: 85.5 },
  { lat: 8.5, lon: 78.1 },
  { lat: 16.2, lon: 88.4 },
  { lat: 4.8, lon: 68.9 },
  { lat: -2.5, lon: 73.5 },
  { lat: 18.1, lon: 67.8 },
  { lat: 10.4, lon: 82.3 },
  { lat: -8.2, lon: 62.1 },
  { lat: 6.9, lon: 92.0 },
  { lat: 15.5, lon: 71.0 },
  { lat: 2.1, lon: 86.4 },
  { lat: -12.4, lon: 75.8 },
  { lat: 13.9, lon: 60.5 },
  { lat: 9.1, lon: 64.8 },
]

// ─── 4. 3D GLOBE REGION POSITIONS ─────────────────────────────────────────────
const REGION_POSITIONS: Record<string, THREE.Vector3> = {
  indian_ocean: new THREE.Vector3(5.2, 0.4, 1.8),
  arabian_sea: new THREE.Vector3(3.2, 1.1, 1.4),
  bay_of_bengal: new THREE.Vector3(3.4, 0.9, 0.1),
  equatorial: new THREE.Vector3(3.7, 0.0, 1.0),
  southern_ocean: new THREE.Vector3(4.5, -2.4, 1.5),
}

function GlobeCameraRig({
  targetRegion,
  zoomTrigger,
  resetTrigger,
  controlsRef,
}: {
  targetRegion: string
  zoomTrigger: number
  resetTrigger: number
  controlsRef: React.RefObject<any>
}) {
  const { camera } = useThree()
  const targetPosRef = useRef<THREE.Vector3>(REGION_POSITIONS.indian_ocean.clone())
  const isAnimatingRef = useRef(false)
  const prevZoom = useRef(zoomTrigger)
  const prevReset = useRef(resetTrigger)
  const prevRegion = useRef(targetRegion)

  useEffect(() => {
    if (targetRegion !== prevRegion.current) {
      prevRegion.current = targetRegion
      const target = REGION_POSITIONS[targetRegion] || REGION_POSITIONS.indian_ocean
      targetPosRef.current = target.clone()
      isAnimatingRef.current = true
    }
  }, [targetRegion])

  useEffect(() => {
    if (zoomTrigger === prevZoom.current) return
    const delta = zoomTrigger > prevZoom.current ? -0.5 : 0.5
    prevZoom.current = zoomTrigger
    const cam = camera as THREE.PerspectiveCamera
    const newPos = cam.position.clone().add(cam.position.clone().normalize().multiplyScalar(delta))
    if (newPos.length() >= 2.6 && newPos.length() <= 8.5) {
      targetPosRef.current = newPos
      isAnimatingRef.current = true
    }
  }, [zoomTrigger, camera])

  useEffect(() => {
    if (resetTrigger === prevReset.current) return
    prevReset.current = resetTrigger
    targetPosRef.current = REGION_POSITIONS.indian_ocean.clone()
    isAnimatingRef.current = true
  }, [resetTrigger])

  useEffect(() => {
    let frameId: number
    const animate = () => {
      if (isAnimatingRef.current) {
        camera.position.lerp(targetPosRef.current, 0.09)
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0)
          controlsRef.current.update()
        }
        if (camera.position.distanceTo(targetPosRef.current) < 0.01) {
          camera.position.copy(targetPosRef.current)
          isAnimatingRef.current = false
        }
      }
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [camera, controlsRef])

  return null
}

// ─── 5. MAIN OPERATIONAL APPLICATIONS PAGE COMPONENT ─────────────────────────
export default function OperationalApplicationsPage() {
  const router = useRouter()
  const [activeAppKey, setActiveAppKey] = useState<"hazard" | "sar" | "fishery" | "climate">("hazard")
  const [activeTab, setActiveTab] = useState<"overview" | "interactive" | "case_studies" | "related_data">("overview")
  const [viewMode, setViewMode] = useState<"map" | "globe">("map")

  // Control States
  const [selectedVariable, setSelectedVariable] = useState<string>("thetao")
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(45)
  const [selectedDepth, setSelectedDepth] = useState<string>("0.5")
  const [selectedRegion, setSelectedRegion] = useState<string>("indian_ocean")
  const [isPlayingTime, setIsPlayingTime] = useState<boolean>(false)

  // Overlay Checkbox States
  const [overlayCoastline, setOverlayCoastline] = useState<boolean>(true)
  const [overlayCurrents, setOverlayCurrents] = useState<boolean>(true)
  const [overlayFeature, setOverlayFeature] = useState<boolean>(true)
  const [overlayObservations, setOverlayObservations] = useState<boolean>(true)
  const [overlayEEZ, setOverlayEEZ] = useState<boolean>(true)

  // Live Model Field API States
  const [fieldData, setFieldData] = useState<ModelFieldResponse | null>(null)
  const [uData, setUData] = useState<ModelFieldResponse | null>(null)
  const [vData, setVData] = useState<ModelFieldResponse | null>(null)
  const [isLoadingField, setIsLoadingField] = useState<boolean>(false)

  // Globe 3D controls
  const [zoomTrigger, setZoomTrigger] = useState<number>(0)
  const [resetTrigger, setResetTrigger] = useState<number>(0)
  const controlsRef = useRef<any>(null)

  // Observations Data for Overlays
  const [observations, setObservations] = useState<ObservationItem[]>([])
  useEffect(() => {
    fetchObservations()
      .then((data) => {
        if (data && data.items) {
          setObservations(data.items)
        }
      })
      .catch(() => {})
  }, [])

  // Modals
  const [isInsightsOpen, setIsInsightsOpen] = useState<boolean>(false)
  const [infoModal, setInfoModal] = useState<{
    title: string
    subtitle: string
    icon: string
    sections: { heading: string; body: string }[]
    ctaText?: string
    ctaAction?: () => void
  } | null>(null)

  const activeApp = APPLICATION_CATEGORIES[activeAppKey]
  const currentDateObj = AVAILABLE_MODEL_DATES[selectedDateIndex] || AVAILABLE_MODEL_DATES[45]

  // Synchronize preset on application switch
  const handleSelectApp = (key: "hazard" | "sar" | "fishery" | "climate") => {
    setActiveAppKey(key)
    const cat = APPLICATION_CATEGORIES[key]
    setSelectedVariable(cat.defaultVariable)
    setOverlayCoastline(cat.overlays.coastline)
    setOverlayCurrents(cat.overlays.currents)
    setOverlayFeature(cat.overlays.feature)
    setOverlayObservations(cat.overlays.observations)
    setOverlayEEZ(cat.overlays.eez)
  }

  // Calculate current magnitude speed = sqrt(uo^2 + vo^2) when uData and vData are loaded
  const currentSpeedData = useMemo<ModelFieldResponse | null>(() => {
    if (!uData || !vData || !uData.values || !vData.values) return null
    const h = Math.min(uData.height, vData.height)
    const w = Math.min(uData.width, vData.width)
    const values: (number | null)[][] = new Array(h)
    let minV = Infinity, maxV = -Infinity
    for (let r = 0; r < h; r++) {
      values[r] = new Array(w)
      for (let c = 0; c < w; c++) {
        const u = uData.values[r]?.[c]
        const v = vData.values[r]?.[c]
        if (u === null || v === null || u === undefined || v === undefined) {
          values[r][c] = null
        } else {
          const spd = Math.sqrt(u * u + v * v)
          values[r][c] = spd
          if (spd < minV) minV = spd
          if (spd > maxV) maxV = spd
        }
      }
    }
    return {
      variable: "current_speed",
      time: uData.time,
      depth: uData.depth,
      lat_min: uData.lat_min,
      lat_max: uData.lat_max,
      lon_min: uData.lon_min,
      lon_max: uData.lon_max,
      width: w,
      height: h,
      latitudes: uData.latitudes,
      longitudes: uData.longitudes,
      values,
      min_value: minV === Infinity ? 0 : minV,
      max_value: maxV === -Infinity ? 0 : maxV,
      unit: "m/s",
    }
  }, [uData, vData])

  const activeFieldData = selectedVariable === "currents" ? (currentSpeedData || fieldData) : fieldData

  // Fetch real model field data when controls change
  useEffect(() => {
    setIsLoadingField(true)
    const timeStr = currentDateObj.iso
    const depthVal = parseFloat(selectedDepth) || 0.5

    let lat_min = -35.0, lat_max = 30.0, lon_min = 40.0, lon_max = 100.0
    if (selectedRegion === "arabian_sea") {
      lat_min = 5.0; lat_max = 28.0; lon_min = 50.0; lon_max = 78.0
    } else if (selectedRegion === "bay_of_bengal") {
      lat_min = 5.0; lat_max = 24.0; lon_min = 78.0; lon_max = 98.0
    } else if (selectedRegion === "equatorial") {
      lat_min = -10.0; lat_max = 10.0; lon_min = 50.0; lon_max = 95.0
    } else if (selectedRegion === "southern_ocean") {
      lat_min = -35.0; lat_max = -10.0; lon_min = 45.0; lon_max = 95.0
    }

    if (selectedVariable === "currents") {
      Promise.all([
        fetchModelField({ variable: "uo", time: timeStr, depth: depthVal, lat_min, lat_max, lon_min, lon_max, stride: 3 }),
        fetchModelField({ variable: "vo", time: timeStr, depth: depthVal, lat_min, lat_max, lon_min, lon_max, stride: 3 }),
      ])
        .then(([uRes, vRes]) => {
          setUData(uRes)
          setVData(vRes)
          setIsLoadingField(false)
        })
        .catch(() => setIsLoadingField(false))
    } else {
      let apiVar = "temperature"
      if (selectedVariable === "thetao") apiVar = "temperature"
      else if (selectedVariable === "so") apiVar = "salinity"
      else if (selectedVariable === "chl") apiVar = "chlorophyll"
      else if (selectedVariable === "uo") apiVar = "uo"
      else if (selectedVariable === "vo") apiVar = "vo"

      fetchModelField({ variable: apiVar, time: timeStr, depth: depthVal, lat_min, lat_max, lon_min, lon_max, stride: 3 })
        .then((res) => {
          setFieldData(res)
          setIsLoadingField(false)
        })
        .catch(() => setIsLoadingField(false))
    }
  }, [selectedVariable, selectedDateIndex, selectedDepth, selectedRegion])

  // Animation playback for timeline across available 90 dates
  useEffect(() => {
    if (!isPlayingTime) return
    const interval = setInterval(() => {
      setSelectedDateIndex((prev) => (prev >= 89 ? 0 : prev + 1))
    }, 500)
    return () => clearInterval(interval)
  }, [isPlayingTime])

  // Compute live statistics from active field data
  const fieldStats = useMemo(() => {
    if (!activeFieldData || !activeFieldData.values) return null
    let sum = 0, count = 0
    const vals = activeFieldData.values
    for (let r = 0; r < vals.length; r++) {
      for (let c = 0; c < (vals[r]?.length || 0); c++) {
        const v = vals[r][c]
        if (v !== null && v !== undefined && !isNaN(v)) {
          sum += v
          count++
        }
      }
    }
    const mean = count > 0 ? sum / count : 0
    return {
      min: activeFieldData.min_value !== null ? activeFieldData.min_value.toFixed(2) : "N/A",
      max: activeFieldData.max_value !== null ? activeFieldData.max_value.toFixed(2) : "N/A",
      mean: mean.toFixed(2),
      unit: activeFieldData.unit || (selectedVariable === "thetao" ? "°C" : selectedVariable === "so" ? "PSU" : selectedVariable === "chl" ? "mg/m³" : "m/s"),
      points: count,
      grid: `${activeFieldData.width} × ${activeFieldData.height}`,
    }
  }, [activeFieldData, selectedVariable])

  // Header helpers
  const [searchQuery, setSearchQuery] = useState("")
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
  }
  function launchExplorer(mode: "volume" | "globe" = "volume") {
    const varParam = selectedVariable === "currents" ? "currents" : selectedVariable === "chl" ? "chlorophyll" : selectedVariable === "so" ? "salinity" : "temperature"
    router.push(mode === "globe" ? `/explore?view=globe&var=${varParam}` : `/explore?var=${varParam}`)
  }

  return (
    <div className="min-h-screen w-full bg-[#f4f8fc] text-slate-900 font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-900">
      
      {/* ─── 1. TOP INSTITUTIONAL HEADER (ROW 1 + ROW 2) ─── */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center">
                <Image src="/landing/header-emblem-moes.png" alt="MoES" width={220} height={64} priority unoptimized className="h-10 sm:h-11 w-auto object-contain" />
              </div>
              <div className="h-8 w-[1px] bg-slate-200" />
              <div className="flex items-center">
                <Image src="/landing/header-incois.png" alt="INCOIS" width={340} height={64} priority unoptimized className="h-10 sm:h-11 w-auto object-contain" />
              </div>
            </div>

            <div className="hidden xl:flex items-center justify-center flex-1 px-4">
              <Image src="/landing/header-tagline-swirl.png" alt="Tagline Swirl" width={400} height={70} priority unoptimized className="h-[52px] sm:h-[54px] w-auto object-contain -translate-x-24" />
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

              <button onClick={() => setInfoModal({ title: "About Operational Applications", subtitle: "Ministry of Earth Sciences · INCOIS", icon: "🇮🇳", sections: [{ heading: "Operational Intelligence", body: "Interactive decision-support workstation powered by real CMEMS model files and WOD observations." }] })} className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer" title="Session Info">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Navbar */}
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
                <Link href="/operational-applications" className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" /><rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" /></svg>
                  <span>Operational Applications</span>
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </Link>
                <Link href="/resources" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span>Resources</span>
                </Link>
                <Link href="/about" className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.8} /><path strokeLinecap="round" strokeWidth={1.8} d="M12 16v-4m0-4h.01" /></svg>
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

      {/* ─── 2. PAGE HERO BANNER ─── */}
      <section className="relative w-full overflow-hidden bg-slate-900 select-none py-5 sm:py-6 shadow-sm">
        <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: `url('/landing/hero-bg.jpg')` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#00172e] via-[#002b54]/85 to-transparent" />

        <div className="relative z-10 max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Operational Applications</span>
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-sky-200 mt-1">
              From data to decisions — supporting a safer, smarter and more sustainable ocean.
            </p>
            <p className="text-[11.5px] sm:text-xs text-slate-200 mt-1.5 leading-relaxed max-w-xl">
              Use ocean model outputs and in-situ observations to support real-world applications such as hazard assessment, search &amp; rescue, fishery advisories, and climate monitoring.
            </p>
          </div>

          <div className="hidden lg:flex flex-col items-end text-right self-center">
            <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-sky-200 shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Trusted Ocean Information for a Safer Tomorrow</span>
            </div>
            <span className="text-[10px] text-slate-300 mt-1">Explore · Assess · Integrate · Protect</span>
          </div>
        </div>
      </section>

      {/* ─── 3. MAIN CONTENT WORKSPACE ─── */}
      <main className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col gap-4">
        
        {/* ROW A: 4 APPLICATION CATEGORY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
          {(["hazard", "sar", "fishery", "climate"] as const).map((key) => {
            const cat = APPLICATION_CATEGORIES[key]
            const isActive = activeAppKey === key
            return (
              <div
                key={key}
                onClick={() => handleSelectApp(key)}
                className={`bg-white rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border ${
                  isActive
                    ? "border-[#0284c7] ring-2 ring-sky-400/20 shadow-md bg-gradient-to-b from-sky-50/40 to-white"
                    : "border-slate-200/90 hover:border-sky-300 hover:shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${cat.iconBg} flex items-center justify-center text-lg shrink-0 shadow-2xs border border-slate-100`}>
                        {cat.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1">
                          <span>{cat.title}</span>
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        isActive ? "bg-[#0284c7] text-white" : "bg-slate-100 text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-600"
                      }`}
                    >
                      →
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                  {cat.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ROW B: ACTIVE APPLICATION DETAILED WORKSPACE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          
          {/* Workspace Title Bar */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${activeApp.iconBg} flex items-center justify-center text-base shrink-0 shadow-2xs`}>
                {activeApp.icon}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {activeApp.title}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {activeApp.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
                <button type="button" onClick={() => setActiveTab("overview")} className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === "overview" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>Overview</button>
                <button type="button" onClick={() => setActiveTab("interactive")} className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === "interactive" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>Interactive View</button>
                <button type="button" onClick={() => setActiveTab("case_studies")} className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === "case_studies" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>Case Studies</button>
                <button type="button" onClick={() => setActiveTab("related_data")} className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === "related_data" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>Related Data</button>
              </div>

              <button type="button" onClick={() => setIsInsightsOpen(true)} className="px-3 py-1 rounded-lg border border-slate-300 hover:border-sky-500 text-slate-700 hover:text-sky-700 text-xs font-semibold bg-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0">
                <span>📊</span>
                <span>Get Insights</span>
              </button>
            </div>
          </div>

          {/* Workspace Body: 3 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 min-h-[500px]">
            
            {/* COLUMN 1: VISUALIZATION CONTROLS (3 cols) */}
            <div className="lg:col-span-3 p-4 sm:p-5 flex flex-col justify-between gap-4 select-none bg-slate-50/30">
              <div className="flex flex-col gap-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-200/80 flex items-center justify-between">
                  <span>Visualization Controls</span>
                  <span className="text-[10px] text-sky-600 font-mono font-normal">
                    {isLoadingField ? "Loading Field..." : "Live Dataset"}
                  </span>
                </h3>

                {/* 1. Variable Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Variable</label>
                  <select
                    value={selectedVariable}
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer shadow-2xs"
                  >
                    {activeApp.variables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Date & Time Picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Date &amp; Time (2026 Archive)</label>
                  <select
                    value={selectedDateIndex}
                    onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer shadow-2xs"
                  >
                    {AVAILABLE_MODEL_DATES.map((d, i) => (
                      <option key={d.iso} value={i}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Depth Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Depth Level</label>
                  <select
                    value={selectedDepth}
                    onChange={(e) => setSelectedDepth(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer shadow-2xs"
                  >
                    {AVAILABLE_DEPTHS.map((dep) => (
                      <option key={dep.value} value={dep.value}>
                        {dep.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Region Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Region</label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer shadow-2xs"
                  >
                    <option value="indian_ocean">Indian Ocean Basin</option>
                    <option value="arabian_sea">Arabian Sea</option>
                    <option value="bay_of_bengal">Bay of Bengal</option>
                    <option value="equatorial">Equatorial Indian Ocean</option>
                    <option value="southern_ocean">Southern Ocean Boundary</option>
                  </select>
                </div>

                {/* Update View Button */}
                <button
                  type="button"
                  onClick={() => setIsPlayingTime(false)}
                  className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white py-1.5 rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                >
                  <span>🔄</span>
                  <span>Update View</span>
                </button>

                {/* Overlay Options Checkboxes */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-700">Overlay Options</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={overlayCoastline} onChange={(e) => setOverlayCoastline(e.target.checked)} className="rounded text-[#0284c7] focus:ring-sky-500/30" />
                      <span>Coastline Boundary</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={overlayCurrents} onChange={(e) => setOverlayCurrents(e.target.checked)} className="rounded text-[#0284c7] focus:ring-sky-500/30" />
                      <span>Current Vectors (u, v)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={overlayFeature} onChange={(e) => setOverlayFeature(e.target.checked)} className="rounded text-[#0284c7] focus:ring-sky-500/30" />
                      <span className="truncate">{activeApp.overlays.featureName}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={overlayObservations} onChange={(e) => setOverlayObservations(e.target.checked)} className="rounded text-[#0284c7] focus:ring-sky-500/30" />
                      <span>In-situ Observations</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={overlayEEZ} onChange={(e) => setOverlayEEZ(e.target.checked)} className="rounded text-[#0284c7] focus:ring-sky-500/30" />
                      <span>Indian EEZ Overlay</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                Model: CMEMS Global 1/12° Analysis
              </div>
            </div>

            {/* COLUMN 2: INTERACTIVE MAP / GLOBE VISUALIZATION (6 cols) */}
            <div className="lg:col-span-6 p-4 flex flex-col justify-between gap-3 relative select-none bg-slate-900/5 min-h-[460px]">
              
              {/* Top View Switcher & Actions */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center bg-white/90 backdrop-blur-xs p-0.5 rounded-lg border border-slate-300 text-xs font-semibold shadow-xs">
                  <button type="button" onClick={() => setViewMode("map")} className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${viewMode === "map" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-700 hover:text-slate-900"}`}>
                    <span>🗺️</span>
                    <span>2D Map</span>
                  </button>
                  <button type="button" onClick={() => setViewMode("globe")} className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${viewMode === "globe" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-700 hover:text-slate-900"}`}>
                    <span>🌐</span>
                    <span>3D Globe</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => launchExplorer("volume")} className="px-3 py-1 bg-[#0a2e5c] hover:bg-[#072142] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                    <span>Explore in 3D</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Visualization Canvas Area */}
              <div className="relative flex-1 w-full rounded-xl overflow-hidden border border-slate-300/80 shadow-inner bg-[#00172e] flex items-center justify-center min-h-[350px]">
                
                {viewMode === "map" ? (
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                    {/* Basemap Satellite Image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url('/landing/indian-ocean-basemap.jpg')`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }}
                    />

                    {/* Live Model Field Heatmap Layer */}
                    <Model2DHeatmapCanvas fieldData={activeFieldData} activeAppKey={activeAppKey} opacity={0.65} />

                    {/* Current Vector Streamlines */}
                    {overlayCurrents && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-85" viewBox="0 0 600 400">
                        <g stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" fill="none" strokeDasharray="5,4">
                          <path d="M 220,240 Q 250,220 280,260 T 240,290 T 210,250 Z" className="animate-spin" style={{ transformOrigin: "245px 255px", animationDuration: "16s" }} />
                          <path d="M 200,220 Q 260,190 310,240 T 260,320 T 180,260 Z" className="animate-spin" style={{ transformOrigin: "245px 255px", animationDuration: "22s" }} />
                          <path d="M 120,320 C 180,310 260,340 380,320 C 450,310 520,330 580,310" />
                          <path d="M 100,280 C 160,260 220,290 320,270 C 420,250 490,290 570,270" />
                          <path d="M 330,190 C 370,200 420,240 450,220 C 480,200 510,220 540,210" />
                        </g>
                      </svg>
                    )}

                    {/* Geographic Text Labels */}
                    <div className="absolute inset-0 pointer-events-none text-white/90 font-bold select-none text-xs">
                      <div className="absolute top-[15.4%] left-[63.3%] transform -translate-x-1/2 -translate-y-1/2 text-yellow-300 font-extrabold tracking-widest text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        INDIA
                      </div>
                      <div className="absolute top-[23.0%] left-[41.5%] transform -translate-x-1/2 -translate-y-1/2 text-sky-200 text-[11px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] text-center">
                        Arabian<br />Sea
                      </div>
                      <div className="absolute top-[23.0%] left-[80.0%] transform -translate-x-1/2 -translate-y-1/2 text-sky-200 text-[11px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] text-center">
                        Bay of<br />Bengal
                      </div>
                      <div className="absolute top-[55.0%] left-[58.0%] transform -translate-x-1/2 -translate-y-1/2 text-sky-100 font-semibold text-xs tracking-wider drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                        Indian Ocean
                      </div>
                    </div>

                    {/* Feature Marker */}
                    {overlayFeature && (
                      <div className="absolute top-[23.8%] left-[44.2%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full border-2 border-sky-400/80 bg-sky-400/20 animate-ping" />
                        <div className="w-5 h-5 rounded-full bg-sky-600 border border-white text-[10px] text-white flex items-center justify-center font-bold absolute top-2.5 shadow-md">
                          📍
                        </div>
                      </div>
                    )}

                    {/* In-Situ Observation Markers */}
                    {overlayObservations && (
                      <div className="absolute inset-0 pointer-events-none">
                        {observations.slice(0, 18).map((obs, idx) => {
                          const fallback = FALLBACK_INDIAN_OCEAN_OBSERVATIONS[idx % FALLBACK_INDIAN_OCEAN_OBSERVATIONS.length]
                          const lat = obs.latitude ?? (obs as any).lat ?? fallback.lat
                          const lon = obs.longitude ?? (obs as any).lon ?? fallback.lon
                          const coords = getMapCoords(lat, lon)
                          return (
                            <div
                              key={idx}
                              className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white ring-1 ring-emerald-500/80 shadow-md transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                              style={{
                                top: `${coords.y}%`,
                                left: `${coords.x}%`,
                              }}
                              title={`${obs.platform_id || `Platform #${idx + 1}`} (${obs.type || "Argo"}) [${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E]`}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full h-full cursor-grab active:cursor-grabbing">
                    <Canvas
                      camera={{ position: [5.2, 0.4, 1.8], fov: 42 }}
                      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
                    >
                      <ambientLight intensity={1.0} />
                      <directionalLight position={[6, 4, 5]} intensity={2.2} color="#ffffff" />
                      <directionalLight position={[-5, -2, -4]} intensity={1.1} color="#60a5fa" />
                      <directionalLight position={[0, 6, -2]} intensity={0.8} color="#e0f2fe" />

                      <Suspense fallback={null}>
                        <EarthSphere
                          radius={2.0}
                          observations={overlayObservations ? observations : []}
                          visibleTypes={{ argo: true, glider: true, ctd: true, bgc: true }}
                        />
                      </Suspense>

                      <GlobeCameraRig
                        targetRegion={selectedRegion}
                        zoomTrigger={zoomTrigger}
                        resetTrigger={resetTrigger}
                        controlsRef={controlsRef}
                      />

                      <OrbitControls
                        ref={controlsRef}
                        enablePan={false}
                        minDistance={2.6}
                        maxDistance={8.5}
                        rotateSpeed={0.9}
                        zoomSpeed={0.9}
                        enableDamping={true}
                        dampingFactor={0.12}
                      />
                    </Canvas>
                  </div>
                )}

                {/* Floating Colorbar Legend on Right */}
                <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 text-white shadow-xl flex flex-col items-center gap-1 text-[10px] z-20">
                  <span className="font-bold text-[10.5px] max-w-[90px] text-center leading-tight text-slate-200">
                    {activeApp.colorScale.title}
                  </span>
                  <span className="text-[9px] text-sky-300 font-mono">
                    ({activeFieldData?.unit || activeApp.colorScale.unit})
                  </span>

                  <div className="flex items-center gap-1.5 my-1">
                    <div className={`w-3.5 h-28 rounded-md bg-gradient-to-b ${activeApp.colorScale.gradient} border border-white/20 shadow-inner`} />
                    <div className="flex flex-col justify-between h-28 text-[9px] font-mono text-slate-300">
                      {fieldStats ? (
                        <>
                          <span>{fieldStats.max}</span>
                          <span>{((Number(fieldStats.max) + Number(fieldStats.min)) / 2).toFixed(1)}</span>
                          <span>{fieldStats.min}</span>
                        </>
                      ) : (
                        activeApp.colorScale.ticks.slice(0, 3).map((tick, i) => <span key={i}>{tick}</span>)
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating Zoom & Compass Buttons */}
                <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
                  <button type="button" onClick={() => setZoomTrigger((z) => z + 1)} className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-sm font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer" title="Zoom In">+</button>
                  <button type="button" onClick={() => setZoomTrigger((z) => z - 1)} className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-sm font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer" title="Zoom Out">−</button>
                  <button type="button" onClick={() => setResetTrigger((r) => r + 1)} className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-xs font-bold shadow-md flex items-center justify-center border border-slate-200 transition cursor-pointer" title="Reset Camera">🧭</button>
                </div>

                {/* Map Scale Bar */}
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-xs border border-slate-700 px-2 py-0.5 rounded text-[9.5px] font-mono text-slate-300 z-20">
                  500 km
                </div>

              </div>

              {/* Bottom Interactive Timeline Playback Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-2 px-3 shadow-xs flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPlayingTime(!isPlayingTime)}
                  className="w-7 h-7 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center font-bold text-xs transition cursor-pointer shrink-0"
                  title={isPlayingTime ? "Pause" : "Play Timeline Animation"}
                >
                  {isPlayingTime ? "⏸" : "▶"}
                </button>

                <div className="font-mono text-xs font-semibold text-slate-800 shrink-0">
                  {currentDateObj.label}
                </div>

                <input
                  type="range"
                  min="0"
                  max="89"
                  value={selectedDateIndex}
                  onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
                  className="flex-1 accent-[#0284c7] cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => setSelectedDateIndex((prev) => Math.min(89, prev + 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition cursor-pointer shrink-0"
                  title="Next Day"
                >
                  ›
                </button>
              </div>

            </div>

            {/* COLUMN 3: ABOUT APPLICATION, LIVE METRICS, KEY PARAMETERS, USE CASES (3 cols) */}
            <div className="lg:col-span-3 p-4 sm:p-5 flex flex-col justify-between gap-4 select-none bg-slate-50/20">
              <div className="flex flex-col gap-4">
                
                {/* 1. Live Model Field Metrics */}
                {fieldStats && (
                  <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-3 flex flex-col gap-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-950 uppercase tracking-wider">Live Field Metrics</span>
                      <span className="text-[9.5px] font-mono text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded font-semibold">{fieldStats.unit}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center pt-1">
                      <div className="bg-white/90 p-1.5 rounded-lg border border-sky-100">
                        <span className="block text-[9px] text-slate-500 font-medium">Min</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{fieldStats.min}</span>
                      </div>
                      <div className="bg-white/90 p-1.5 rounded-lg border border-sky-100">
                        <span className="block text-[9px] text-slate-500 font-medium">Mean</span>
                        <span className="text-xs font-bold text-[#0284c7] font-mono">{fieldStats.mean}</span>
                      </div>
                      <div className="bg-white/90 p-1.5 rounded-lg border border-sky-100">
                        <span className="block text-[9px] text-slate-500 font-medium">Max</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{fieldStats.max}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 font-mono pt-0.5">
                      <span>Grid: {fieldStats.grid}</span>
                      <span>Depth: {selectedDepth}m</span>
                    </div>
                  </div>
                )}

                {/* 2. About Application Card */}
                <div className="flex flex-col gap-1.5 pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{activeApp.icon}</span>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {activeApp.aboutTitle}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {activeApp.aboutText}
                  </p>
                </div>

                {/* 3. Key Parameters Section */}
                <div className="flex flex-col gap-2 pb-3 border-b border-slate-200/80">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Key Parameters
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {activeApp.parameters.map((param, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-2 text-xs">
                        <span className="text-sm shrink-0 mt-0.5">{param.icon}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-[11px] leading-tight">{param.name}</span>
                          <span className="text-[10px] text-slate-500 leading-tight">{param.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Operational Use Cases */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Operational Use Cases
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {activeApp.useCases.map((uc, uIdx) => (
                      <div key={uIdx} className="flex items-start gap-2 text-xs">
                        <span className="text-xs shrink-0 mt-0.5">{uc.icon}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-[11px] leading-tight">{uc.title}</span>
                          <span className="text-[10px] text-slate-500 leading-tight">{uc.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="pt-2 border-t border-slate-200 text-[10.5px] text-slate-500 flex items-center justify-between">
                <span>INCOIS Scientific Portal</span>
                <span className="text-emerald-600 font-medium">● Real Model Data</span>
              </div>
            </div>

          </div>

        </div>

        {/* ─── ROW C: BOTTOM 4 CAPABILITY CARDS (SCIENTIFICALLY ACCURATE) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
          
          {/* Capability 1 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start gap-3 hover:border-sky-300 transition">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284c7] shrink-0 text-base shadow-2xs">
              🕒
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Ocean Data Access</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Access model outputs and observation datasets.
              </p>
            </div>
          </div>

          {/* Capability 2 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start gap-3 hover:border-blue-300 transition">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 text-base shadow-2xs">
              📚
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Multi-source Integration</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Model outputs + in-situ observations.
              </p>
            </div>
          </div>

          {/* Capability 3 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start gap-3 hover:border-cyan-300 transition">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0 text-base shadow-2xs">
              📍
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Region-wise Analysis</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Focus on specific coastal and offshore regions.
              </p>
            </div>
          </div>

          {/* Capability 4 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start gap-3 hover:border-indigo-300 transition">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 text-base shadow-2xs">
              👥
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Support Decision Making</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Useful for government agencies and stakeholders.
              </p>
            </div>
          </div>

        </div>

      </main>

      {/* ─── 4. INSTITUTIONAL FOOTER ─── */}
      <footer className="w-full bg-white border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between shrink-0 text-[11px] text-slate-500 font-sans mt-2">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-slate-600">Data Sources:</span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] inline-block" />
            Copernicus Marine Service (CMEMS)
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
            INCOIS
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
            NOAA
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
            NCEI WOD
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
            IFREMER
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200" />
            Operational Applications Functional
          </span>
          <span className="hidden md:inline">|</span>
          <span className="text-slate-500">Last Updated: 15 Feb 2026, 12:30 UTC</span>
        </div>
      </footer>

      {/* ─── 5. ANALYTICAL INSIGHTS MODAL ─── */}
      <AnimatePresence>
        {isInsightsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setIsInsightsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{activeApp.icon}</span>
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">{activeApp.title} Operational Insights</h3>
                    <p className="text-xs text-slate-500">Environmental summary and decision support indicators</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInsightsOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed py-1">
                <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3">
                  <h4 className="font-bold text-sky-900 mb-1">Current Environmental Status</h4>
                  <p>
                    Analyzing real multi-model dataset for <strong>{selectedRegion.replace("_", " ").toUpperCase()}</strong> at <strong>{selectedDepth}m Depth</strong> for date <strong>{currentDateObj.label}</strong>.
                  </p>
                </div>

                {fieldStats ? (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Real Field Observations &amp; Statistics</h4>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      <li>Minimum Value: <strong>{fieldStats.min} {fieldStats.unit}</strong></li>
                      <li>Maximum Value: <strong>{fieldStats.max} {fieldStats.unit}</strong></li>
                      <li>Regional Mean Value: <strong>{fieldStats.mean} {fieldStats.unit}</strong></li>
                      <li>Current Formula (S&amp;R / Velocity): <strong>speed = &radic;(u&sup2; + v&sup2;)</strong></li>
                      <li>Loaded Grid Dimension: <strong>{fieldStats.grid}</strong> ({fieldStats.points} valid points)</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Data Status</h4>
                    <p>Loading real CMEMS ocean model slice data from server...</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setIsInsightsOpen(false); launchExplorer("volume"); }}
                  className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-xs transition"
                >
                  Launch 3D Explorer →
                </button>
                <button
                  type="button"
                  onClick={() => setIsInsightsOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 6. INSTITUTIONAL INFO MODALS ─── */}
      <AnimatePresence>
        {infoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setInfoModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-800 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{infoModal.icon}</span>
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">{infoModal.title}</h3>
                    <p className="text-xs text-slate-500">{infoModal.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed border-t border-b border-slate-100 py-3">
                {infoModal.sections.map((sec, i) => (
                  <div key={i}>
                    <h4 className="font-semibold text-slate-900 mb-0.5">{sec.heading}</h4>
                    <p>{sec.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
