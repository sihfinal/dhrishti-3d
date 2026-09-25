"use client"

import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useOcean } from "@/lib/store"
import { fetchIngestionStatus, triggerIngestionScan, IngestionStatusResponse } from "@/lib/ingestionApi"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"

interface InfoModalData {
  title: string
  subtitle: string
  icon: string
  sections: { heading: string; body: string }[]
  ctaText?: string
  ctaAction?: () => void
}

export default function DataServicesPage() {
  const router = useRouter()
  const { setViewMode } = useOcean()

  // State
  const [activeDatasetTab, setActiveDatasetTab] = useState<"model" | "observation" | "derived">("model")
  const [codeLanguage, setCodeLanguage] = useState<"python" | "javascript" | "curl" | "wms" | "wcs" | "opendap">("python")
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null)
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false)
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState<boolean>(false)
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatusResponse | null>(null)
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleOpenIngestionModal = async () => {
    setIsIngestionModalOpen(true)
    try {
      const data = await fetchIngestionStatus()
      setIngestionStatus(data)
    } catch {
      setIngestionStatus({
        automated_ingestion_enabled: true,
        incoming_directory: "data/incoming/",
        last_scan_time: null,
        supported_formats: ["NetCDF (.nc)", "CSV (.csv)", "TSV (.tsv)", "ASCII (.txt, .dat, .ascii)"],
        files_discovered: 0,
        files_ingested: 0,
        files_failed: 0,
        recent_jobs: [],
      })
    }
  }

  const handleTriggerScan = async () => {
    setIsScanning(true)
    try {
      const res = await triggerIngestionScan()
      setIngestionStatus(res.ingestion_summary)
    } catch (e) {
      console.error(e)
    } finally {
      setIsScanning(false)
    }
  }

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const launchExplorer = (mode: "volume" | "globe" = "volume") => {
    setViewMode(mode)
    router.push("/explore")
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
  }

  const navModals: Record<string, InfoModalData> = {
    operationalApps: {
      title: "Operational Applications & Mission Modules",
      subtitle: "Mission-critical ocean intelligence for maritime security, disaster management, and blue economy.",
      icon: "⚡",
      sections: [
        {
          heading: "Maritime Domain Awareness (MDA)",
          body: "Sub-surface acoustic propagation modeling, thermocline gradient tracking, and EEZ environmental intelligence.",
        },
        {
          heading: "Disaster Risk & Cyclone Heat Potential (TCHP)",
          body: "Integrated ocean heat content mapping for rapid cyclone intensification warnings and storm surge forecasting.",
        },
      ],
      ctaText: "Explore Operational Models →",
      ctaAction: () => launchExplorer("volume"),
    },
    resources: {
      title: "Scientific Documentation & Knowledge Base",
      subtitle: "Peer-reviewed methodology, data conventions, and platform architectural specifications.",
      icon: "📚",
      sections: [
        {
          heading: "Ocean Observation Quality Control (QC)",
          body: "Automated real-time quality control flags adhering to international Argo and WOD23 scientific protocols.",
        },
        {
          heading: "3D Rendering Pipeline",
          body: "Hardware-accelerated WebGL volumetric raymarching and Marching Cubes isosurface extraction engines.",
        },
      ],
      ctaText: "Launch Interactive Explorer →",
      ctaAction: () => launchExplorer("volume"),
    },
    about: {
      title: "About SAGAR NETRA 3D — The Ocean Eye",
      subtitle: "Next-generation 4D ocean data intelligence and interactive sub-surface visualization platform.",
      icon: "🌊",
      sections: [
        {
          heading: "Platform Mission",
          body: "Built for Smart India Hackathon (SIH 2026) Problem Statement 26067 under the Ministry of Earth Sciences (MoES) and INCOIS.",
        },
        {
          heading: "Standard Compliance",
          body: "Adheres to international OGC (Open Geospatial Consortium) WMS/WCS standards, CF-1.8 metadata conventions, and FAIR data principles.",
        },
      ],
      ctaText: "Explore 3D Workstation →",
      ctaAction: () => launchExplorer("volume"),
    },
    wms: {
      title: "OGC Web Map Service (WMS 1.3.0 / 1.1.1)",
      subtitle: "Standardized 2D georeferenced raster tile rendering service for GIS clients.",
      icon: "🗺️",
      sections: [
        {
          heading: "Service Endpoint & Standard Compliance",
          body: "Fully compliant with OGC WMS 1.3.0 and 1.1.1 specifications. Compatible with QGIS, ArcGIS, Mapbox, Leaflet, OpenLayers, and Cesium.",
        },
        {
          heading: "Supported Ocean Layers & Dimensions",
          body: "Exposes 6 verified oceanographic layers with multi-temporal (daily timesteps) and depth elevation (0m to 5,700m) dimensions: Sea Water Potential Temperature (thetao), Practical Salinity (so), Chlorophyll-a (chl), Eastward Current (uo), Northward Current (vo), and Hydrodynamic Current Speed.",
        },
      ],
      ctaText: "Open WMS Capabilities XML ↗",
      ctaAction: () => {
        if (typeof window !== "undefined") {
          window.open(`${API_BASE}/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities`, "_blank")
        }
      },
    },
    wcs: {
      title: "OGC Web Coverage Service (WCS 2.0.1 / 1.0.0)",
      subtitle: "Direct programmatic access to raw gridded numerical ocean model arrays.",
      icon: "📦",
      sections: [
        {
          heading: "Multidimensional Numerical Array Access",
          body: "Provides direct scientific extraction of raw float32 numerical grid arrays in NetCDF-4 (application/x-netcdf) and GeoTIFF (image/tiff) formats with exact spatial subsetting, elevation/depth slicing, and temporal filtering.",
        },
        {
          heading: "Supported Ocean Model Coverages",
          body: "Exposes 6 raw numerical coverage layers directly from CMEMS/INCOIS model grids: thetao (temperature), so (salinity), chl (chlorophyll-a), uo (eastward velocity), vo (northward velocity), and currents (current speed magnitude = sqrt(uo^2 + vo^2)).",
        },
      ],
      ctaText: "Open WCS Capabilities XML ↗",
      ctaAction: () => {
        if (typeof window !== "undefined") {
          window.open(`${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities`, "_blank")
        }
      },
    },
    opendap: {
      title: "OPeNDAP / THREDDS Scientific Data Access (DAP 2.0)",
      subtitle: "Direct remote slice querying & multidimensional dataset access protocol.",
      icon: "🔗",
      sections: [
        {
          heading: "Remote Multidimensional Subsetting",
          body: "OPeNDAP enables oceanographers using Python (xarray/netCDF4), MATLAB, R, GDAL, CDO, and QGIS to query precise 3D/4D spatial-temporal slices without downloading multi-gigabyte dataset files.",
        },
        {
          heading: "THREDDS Catalog & DAP2 Interoperability",
          body: "Fully compliant with OPeNDAP DAP 2.0 (DDS, DAS, DODS binary XDR, HTML) and THREDDS InvCatalog standards, hosted directly on national oceanographic data nodes.",
        },
      ],
      ctaText: "Open THREDDS Catalog XML ↗",
      ctaAction: () => {
        if (typeof window !== "undefined") {
          window.open(`${API_BASE}/opendap/catalog.xml`, "_blank")
        }
      },
    },
    dataPolicy: {
      title: "Data Policy & Licensing Terms",
      subtitle: "Government of India National Data Sharing and Accessibility Policy (NDSAP).",
      icon: "🛡️",
      sections: [
        {
          heading: "Open Access & Fair Use",
          body: "All observational and model products served by Sagar Netra 3D are provided freely for scientific research, academic study, disaster mitigation, and operational marine planning.",
        },
        {
          heading: "Attribution Requirement",
          body: "Publications and downstream applications utilizing data must cite: 'Ministry of Earth Sciences (MoES), Government of India / INCOIS Sagar Netra 3D Ocean Intelligence Portal'.",
        },
      ],
    },
    sampleScripts: {
      title: "Sample Scripts & Code Repositories",
      subtitle: "Production-ready automation scripts in Python, MATLAB, and Node.js.",
      icon: "💻",
      sections: [
        {
          heading: "Python xarray & requests Pipeline",
          body: "Automate depth-slice extraction, thermal gradient calculations, and automated GeoJSON point extractions with provided sample notebooks.",
        },
        {
          heading: "MATLAB & R Oceanography Toolboxes",
          body: "Direct integration templates for m_map, seawater/gsw toolboxes, and ggplot ocean stratification profiles.",
        },
      ],
      ctaText: "View REST API Reference →",
      ctaAction: () => setIsApiModalOpen(true),
    },
    support: {
      title: "Technical Support & INCOIS Data Desk",
      subtitle: "Assistance for researchers, institutional partners, and developers.",
      icon: "🎧",
      sections: [
        {
          heading: "Developer & API Support",
          body: "For questions regarding REST API rate limits, binary envelope decoders, or high-throughput batch extraction, contact the Sagar Netra 3D technical team.",
        },
        {
          heading: "Institutional Data Desk",
          body: "Indian National Centre for Ocean Information Services (INCOIS), Ocean Valley, Pragathi Nagar (BO), Nizampet (SO), Hyderabad - 500090, India.",
        },
      ],
    },
  }

  // Real code snippets based on existing API
  const codeSnippets = {
    python: `# Example: Access Sagar Netra 3D REST API & xarray model data
import requests
import xarray as xr

# 1. Query live FastAPI dataset metadata
api_base = "http://127.0.0.1:8000/api/v1"
res = requests.get(f"{api_base}/model/metadata")
metadata = res.json()
print("Variables available:", metadata.get("variables"))

# 2. Fetch specific depth slice for temperature
slice_res = requests.get(
    f"{api_base}/model/field",
    params={"variable": "thetao", "depth": 10.0, "time_idx": 0}
)
field_data = slice_res.json()
print(f"Grid dimensions: {field_data['width']}x{field_data['height']}")
print("Sample values (5x5):", field_data['data'][0][:5])`,

    javascript: `// Example: Query Sagar Netra 3D In-situ Observations using JavaScript/TypeScript
const API_BASE = "http://127.0.0.1:8000/api/v1";

async function getArgoObservations() {
  const params = new URLSearchParams({
    type: "argo",
    lat_min: "5.0",
    lat_max: "25.0",
    limit: "50"
  });

  const response = await fetch(\`\${API_BASE}/observations?\${params}\`);
  const data = await response.json();
  console.log(\`Retrieved \${data.count} profiling floats\`, data.items);
  
  // Extract station metadata & coordinate geometry
  if (data.items && data.items.length > 0) {
    const station = data.items[0];
    console.log("Station ID:", station.id, "Coordinates:", station.coordinates);
  }
}

getArgoObservations();`,

    curl: `# Example: Query Sagar Netra 3D Health & Observation Endpoints via cURL
# 1. Health check & status verification
curl -X GET "${API_BASE}/health" \\
     -H "Accept: application/json"

# 2. Get list of all available oceanographic datasets
curl -X GET "${API_BASE}/datasets" \\
     -H "Accept: application/json"

# 3. Retrieve vertical depth profile for a specific platform
curl -X GET "${API_BASE}/observations/argo_2902210/profile" \\
     -H "Accept: application/json"

# 4. Query temperature numerical slice metadata
curl -X GET "${API_BASE}/model/field?variable=thetao&depth=0.5&time_idx=0" \\
     -H "Accept: application/json"`,

    wms: `# OGC WMS (Web Map Service 1.3.0 / 1.1.1) GIS Integration:
# 1. Base Service Endpoint (Add to QGIS / ArcGIS / Leaflet / OpenLayers):
# ${API_BASE}/ogc/wms

# 2. GetCapabilities Request (Full Service XML Metadata):
curl -X GET "${API_BASE}/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities"

# 3. GetMap Request (2D Sea Water Potential Temperature PNG raster map):
curl -X GET "${API_BASE}/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=temperature&BBOX=-20,55,15,85&CRS=EPSG:4326&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE" \\
     --output temperature_layer.png

# 4. GetMap Request (2D Hydrodynamic Current Speed magnitude map = sqrt(uo^2 + vo^2)):
curl -X GET "${API_BASE}/ogc/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=currents&BBOX=-20,55,15,85&CRS=EPSG:4326&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE" \\
     --output currents_magnitude.png`,

    wcs: `# OGC WCS (Web Coverage Service 2.0.1 / 1.0.0) Raw Array Access:
# 1. Base Service Endpoint (Add to QGIS / ArcGIS / Python xarray / GDAL):
# ${API_BASE}/ogc/wcs

# 2. GetCapabilities (Full Service XML Metadata):
curl -X GET "${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities"

# 3. DescribeCoverage (Coverage details & grid domain for temperature):
curl -X GET "${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=DescribeCoverage&COVERAGEID=temperature"

# 4. GetCoverage (Download raw NetCDF-4 array for temperature):
curl -X GET "${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=temperature&SUBSET=Long(55,85)&SUBSET=Lat(-20,15)&FORMAT=application/x-netcdf" \\
     --output temperature_grid.nc

# 5. GetCoverage (Download raw 32-bit Float GeoTIFF for current speed magnitude):
curl -X GET "${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=currents&SUBSET=Long(55,85)&SUBSET=Lat(-20,15)&FORMAT=image/tiff" \\
     --output currents_grid.tif`,

    opendap: `# OPeNDAP / THREDDS Scientific Dataset Access (Python xarray / netCDF4):
import xarray as xr

# 1. Connect directly to live SAGAR NETRA 3D OPeNDAP endpoint remotely:
dataset_url = "${API_BASE}/opendap/cmems_physical"
ds = xr.open_dataset(dataset_url)

print("Remote variables:", list(ds.data_vars.keys()))
print("Dimensions:", dict(ds.sizes))

# 2. Perform server-side spatial & depth subset (e.g., Indian Ocean ROI):
subset = ds["thetao"].sel(
    latitude=slice(-10.0, 20.0),
    longitude=slice(60.0, 90.0),
    depth=0.5,
    method="nearest"
)
print("Temperature slice shape:", subset.shape)
print("Surface Temperature sample (°C):", float(subset.values.flat[0]))`,
  }

  // Dataset Table Data (Strictly 5 items per category with identical character length for exact card height matching)
  const modelDatasets = [
    {
      name: "CMEMS Global Ocean Physics",
      provider: "Copernicus Marine Service",
      variables: "Temperature, Salinity, Currents",
      spatial: "Global Ocean (1/12°)",
      temporal: "1993 – Present (Daily)",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "CMEMS Global Biogeochemistry",
      provider: "Copernicus Marine Service",
      variables: "Chlorophyll, Oxygen, Nutrients",
      spatial: "Global Ocean (1/12°)",
      temporal: "1997 – Present (Daily)",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "INCOIS Regional High-Res Models",
      provider: "INCOIS",
      variables: "Temperature, Currents, Sea Level",
      spatial: "Indian Ocean (1/12°)",
      temporal: "2010 – Present (Daily)",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "NOAA Global Ocean Data (WOA23)",
      provider: "NOAA / NCEI",
      variables: "Temperature, Salinity, Currents",
      spatial: "Global Ocean (1/4°)",
      temporal: "1980 – Present (Daily)",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "World Ocean Database (WOD)",
      provider: "NCEI / NOAA",
      variables: "In-situ Profiles (T, S, O2, BGC)",
      spatial: "Global (Point Data)",
      temporal: "1955 – Present",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
  ]

  const observationDatasets = [
    {
      name: "Argo Profiling Float Network",
      provider: "Argo GDAC / INCOIS",
      variables: "Temperature, Salinity, Pressure",
      spatial: "Indian Ocean (Active)",
      temporal: "2000 – Present (10-Day)",
      apiLive: true,
      ogcReady: false,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Autonomous Underwater Gliders",
      provider: "IOOS / Glider Data Network",
      variables: "Temperature, Salinity, Optical",
      spatial: "Maritime Corridors",
      temporal: "2018 – Present (Missions)",
      apiLive: true,
      ogcReady: false,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Shipboard CTD Profiling Archive",
      provider: "World Ocean Database (WOD23)",
      variables: "Conductivity, Temp, Depth",
      spatial: "Indian Ocean Stations",
      temporal: "1970 – Present (Cruises)",
      apiLive: true,
      ogcReady: false,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Biogeochemical Argo (BGC-Argo)",
      provider: "BGC Argo International",
      variables: "Chlorophyll-a, DO, Nitrate, pH",
      spatial: "Oxygen Minimum Zones",
      temporal: "2015 – Present",
      apiLive: true,
      ogcReady: false,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Moored Ocean Buoy Array (RAMA)",
      provider: "INCOIS / MoES / NOAA",
      variables: "SST, Salinity, Wind, Waves",
      spatial: "Tropical Indian Ocean",
      temporal: "2000 – Present (Hourly)",
      apiLive: true,
      ogcReady: false,
      preview: "/textures/earth_4k_v3.jpg",
    },
  ]

  const derivedDatasets = [
    {
      name: "Tropical Cyclone Heat Potential",
      provider: "Sagar Netra 3D Engine",
      variables: "Heat Content (D26 Isotherm)",
      spatial: "Bay of Bengal & Arab Sea",
      temporal: "Daily Cyclogenesis Forecast",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Sonic Layer Depth & Sound Speed",
      provider: "Sagar Netra 3D Acoustic",
      variables: "Sound Velocity, SLD Gradients",
      spatial: "Indian Ocean (0-2000m)",
      temporal: "Daily Operational Analysis",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Ocean Mixed Layer Depth (MLD)",
      provider: "INCOIS / Sagar Netra 3D",
      variables: "Density & Temp Thresholds",
      spatial: "North Indian Ocean (1/12°)",
      temporal: "Daily Realtime & Climatology",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Upper Ocean Heat Content (OHC)",
      provider: "Sagar Netra 3D Engine",
      variables: "Integrated Thermal Energy",
      spatial: "Tropical Indian Ocean",
      temporal: "Operational Daily Analysis",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
    {
      name: "Marine Heatwave & SST Alerts",
      provider: "INCOIS Coral Reef Watch",
      variables: "SST Anomaly, Degree Heating",
      spatial: "Coral Reef & EEZ Zones",
      temporal: "Daily Operational Bulletins",
      apiLive: true,
      ogcReady: true,
      preview: "/textures/earth_4k_v3.jpg",
    },
  ]

  const currentDatasets =
    activeDatasetTab === "model"
      ? modelDatasets
      : activeDatasetTab === "observation"
      ? observationDatasets
      : derivedDatasets

  return (
    <div className="min-h-screen w-full bg-[#f4f8fc] text-slate-900 font-sans flex flex-col justify-between selection:bg-sky-100 selection:text-sky-900">
      
      {/* ────────────────────────────────────────────────────────────
          1. TOP INSTITUTIONAL HEADER (ROW 1 + ROW 2)
      ──────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-200/80 z-30 sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
        
        {/* Row 1: Institutional Badges, Tagline, Search, User */}
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px] sm:h-[66px] gap-4">
            
            {/* Left: MoES Emblem & INCOIS Logo */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <Link href="/" className="flex items-center cursor-pointer">
                <Image
                  src="/landing/header-emblem-moes.png"
                  alt="Ministry of Earth Sciences, Government of India"
                  width={220}
                  height={64}
                  priority
                  unoptimized
                  className="h-10 sm:h-11 w-auto object-contain"
                />
              </Link>

              {/* Vertical divider */}
              <div className="h-8 w-[1px] bg-slate-200" />

              <Link href="/" className="flex items-center cursor-pointer">
                <Image
                  src="/landing/header-incois.png"
                  alt="INCOIS - Indian National Centre for Ocean Information Services"
                  width={340}
                  height={64}
                  priority
                  unoptimized
                  className="h-10 sm:h-11 w-auto object-contain"
                />
              </Link>
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
              {/* Search Bar */}
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

              {/* User Profile Avatar */}
              <button
                type="button"
                onClick={() => setInfoModal(navModals.about)}
                className="w-8 h-8 rounded-full bg-[#0a2540] flex items-center justify-center text-white shadow-sm hover:bg-[#0f3458] transition-colors cursor-pointer"
                title="Institutional Session & Access"
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

        {/* Row 2: Institutional Navbar (Data Services Active) */}
        <div className="w-full bg-white border-t border-slate-100">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[38px] sm:h-[40px]">
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
                {/* Home */}
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span>Home</span>
                </Link>

                {/* Study Region */}
                <Link
                  href="/study-region"
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Study Region</span>
                </Link>

                {/* Explorer */}
                <button
                  type="button"
                  onClick={() => launchExplorer("volume")}
                  className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700 hover:text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                    <path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
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

                {/* Data Services (Active) */}
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="relative flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#0284c7] shrink-0 py-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#0284c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
                    <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  <span>Data Services</span>
                  {/* Blue Active Indicator Bar */}
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#0284c7] rounded-full" />
                </button>

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

              {/* Right CTA Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchExplorer("volume")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#0a2540] hover:bg-[#0f3458] text-white text-xs font-semibold rounded-md shadow-sm transition cursor-pointer"
                >
                  <span>Launch Explorer</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────
          2. DATA SERVICES HERO & FEATURE PILLS
      ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-gradient-to-b from-[#0a2540] via-[#0c3358] to-[#0d3b66] text-white py-8 sm:py-10 px-4 sm:px-6 lg:px-8 select-none overflow-hidden shrink-0 shadow-sm">
        {/* Oceanographic satellite background backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
          style={{
            backgroundImage: "url('/landing/study-region-bg-perfect.jpg')",
            backgroundPosition: "center 40%",
          }}
        />
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-[#0a2540]/80 pointer-events-none" />

        <div className="relative max-w-[1536px] mx-auto flex flex-col gap-6">
          
          {/* Top Hero Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Left Title & Description */}
            <div className="flex flex-col max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                Data Services
              </h1>
              <p className="text-base sm:text-lg font-semibold text-sky-200 mt-1">
                Access ocean data, anytime, anywhere
              </p>
              <p className="text-xs sm:text-[13px] text-slate-200/90 mt-2 leading-relaxed font-normal">
                SAGAR NETRA 3D provides seamless access to ocean model outputs and in-situ observations
                through standard data services, enabling researchers, policymakers, and the public to use
                data for exploration, analysis, and operational applications.
              </p>
            </div>

            {/* Right Artistic Callout Badge */}
            <div className="flex flex-col items-start lg:items-end text-left lg:text-right shrink-0">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Open Data
              </span>
              <span className="text-sm sm:text-base font-semibold text-sky-300">
                for a Safer Ocean
              </span>
              <span className="text-[11px] sm:text-xs text-slate-300 mt-1 font-mono tracking-wide">
                Explore · Access · Integrate · Innovate
              </span>
            </div>

          </div>

          {/* Bottom Hero 4 Feature Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            {/* Pill 1: Open Standards */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 text-sky-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
                  <path strokeWidth={1.8} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Open Standards</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">OGC compliant services</p>
              </div>
            </div>

            {/* Pill 2: Multiple Data Sources */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Multiple Data Sources</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">CMEMS, WOD, INCOIS and more</p>
              </div>
            </div>

            {/* Pill 3: Easy Integration */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 text-cyan-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Easy Integration</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">APIs for your applications</p>
              </div>
            </div>

            {/* Pill 4: Support & Documentation */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3 transition">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0 text-purple-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-xs font-bold text-white leading-tight">Support & Documentation</h4>
                <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate">Guides, examples and tools</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────
          3. MAIN CONTENT WORKSPACE
      ──────────────────────────────────────────────────────────── */}
      <main className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col gap-4">
        
        {/* ─── ROW A: 4 PRIMARY DATA SERVICE CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none items-stretch">
          
          {/* Service 1: WMS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-sky-300 transition h-full min-w-0">
            <div className="flex flex-col gap-2.5 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600 mt-0.5">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title="OGC Web Map Service (WMS)">WMS</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Available
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 truncate" title="OGC Web Map Service">OGC Web Map Service</span>
                </div>
              </div>

              {/* Fixed Height Description */}
              <p className="text-[11px] text-slate-500 leading-snug h-[32px] line-clamp-2 min-w-0" title="Standardized 2D map access to ocean model layers.">
                Standardized 2D map access to ocean model layers.
              </p>

              {/* Verified Capabilities Information Box (Exact 3 Rows) */}
              <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-h-[112px] text-[10.5px] min-w-0 gap-1.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Operations:</span>
                  <span className="text-slate-800 font-semibold font-mono text-[9.5px] leading-tight break-words" title="GetCapabilities · GetMap">
                    GetCapabilities · GetMap
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Layers:</span>
                  <span className="text-slate-700 font-medium text-[10px] leading-tight break-words" title="Temperature · Salinity · Chlorophyll · Currents">
                    Temperature · Salinity · Chlorophyll · Currents
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Formats &amp; CRS:</span>
                  <span className="text-slate-600 font-mono text-[9px] leading-tight break-words" title="PNG · JPEG · EPSG:4326 · EPSG:3857">
                    PNG · JPEG · EPSG:4326 · EPSG:3857
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 min-w-0">
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <a
                  href={`${API_BASE}/ogc/wms?SERVICE=WMS&REQUEST=GetCapabilities`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 py-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-center text-[10.5px] font-semibold shadow-xs transition cursor-pointer truncate"
                  title="Open WMS Capabilities XML in new tab"
                >
                  Open WMS Cap. ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/ogc/wms`, "wms-ep-card")}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200 transition cursor-pointer shrink-0 whitespace-nowrap"
                  title="Copy WMS Service Endpoint URL"
                >
                  {copiedField === "wms-ep-card" ? "✓ Copied" : "Copy Endpoint"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(navModals.wms)}
                className="text-[10.5px] font-medium text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer text-left flex items-center gap-1 truncate w-fit"
                title="View WMS Technical Specifications"
              >
                <span>View WMS Specifications</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Service 2: WCS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-emerald-300 transition h-full min-w-0">
            <div className="flex flex-col gap-2.5 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title="OGC Web Coverage Service (WCS)">WCS</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Available
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 truncate" title="OGC Web Coverage Service">OGC Web Coverage Service</span>
                </div>
              </div>

              {/* Fixed Height Description */}
              <p className="text-[11px] text-slate-500 leading-snug h-[32px] line-clamp-2 min-w-0" title="Direct access to raw numerical model grids (NetCDF & GeoTIFF).">
                Direct access to raw numerical model grids (NetCDF &amp; GeoTIFF).
              </p>

              {/* Verified Capabilities Information Box (Exact 3 Rows) */}
              <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-h-[112px] text-[10.5px] min-w-0 gap-1.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Operations:</span>
                  <span className="text-slate-800 font-semibold font-mono text-[9.5px] leading-tight break-words" title="GetCapabilities · DescribeCoverage · GetCoverage">
                    GetCapabilities · DescribeCoverage · GetCoverage
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Coverages:</span>
                  <span className="text-slate-700 font-medium text-[10px] leading-tight break-words" title="Temperature · Salinity · Chlorophyll · Currents">
                    Temperature · Salinity · Chlorophyll · Currents
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Formats &amp; CRS:</span>
                  <span className="text-slate-600 font-mono text-[9px] leading-tight break-words" title="NetCDF-4 · GeoTIFF · EPSG:4326 · CRS:84">
                    NetCDF-4 · GeoTIFF · EPSG:4326 · CRS:84
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 min-w-0">
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <a
                  href={`${API_BASE}/ogc/wcs?SERVICE=WCS&REQUEST=GetCapabilities`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-center text-[10.5px] font-semibold shadow-xs transition cursor-pointer truncate"
                  title="Open WCS Capabilities XML in new tab"
                >
                  Open WCS Cap. ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/ogc/wcs`, "wcs-ep-card")}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200 transition cursor-pointer shrink-0 whitespace-nowrap"
                  title="Copy WCS Service Endpoint URL"
                >
                  {copiedField === "wcs-ep-card" ? "✓ Copied" : "Copy Endpoint"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(navModals.wcs)}
                className="text-[10.5px] font-medium text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer text-left flex items-center gap-1 truncate w-fit"
                title="View WCS Technical Specifications"
              >
                <span>View WCS Specifications</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Service 3: OPeNDAP */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-purple-300 transition h-full min-w-0">
            <div className="flex flex-col gap-2.5 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 text-purple-600 mt-0.5">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title="OPeNDAP / THREDDS Data Server">OPeNDAP / THREDDS</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Available
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 truncate" title="Remote Scientific Data Access">Remote Scientific Data Access</span>
                </div>
              </div>

              {/* Fixed Height Description */}
              <p className="text-[11px] text-slate-500 leading-snug h-[32px] line-clamp-2 min-w-0" title="Remote scientific access to multidimensional ocean model datasets.">
                Remote scientific access to multidimensional ocean model datasets.
              </p>

              {/* Verified Capabilities Information Box (Exact 3 Rows) */}
              <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-h-[112px] text-[10.5px] min-w-0 gap-1.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Operations:</span>
                  <span className="text-slate-800 font-semibold font-mono text-[9.5px] leading-tight break-words" title="DDS · DAS · DODS · Catalog">
                    DDS · DAS · DODS · Catalog
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Datasets:</span>
                  <span className="text-slate-700 font-medium text-[10px] leading-tight break-words" title="CMEMS Physical · CMEMS BGC">
                    CMEMS Physical · CMEMS BGC
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Protocol &amp; Format:</span>
                  <span className="text-slate-600 font-mono text-[9px] leading-tight break-words" title="DAP 2.0 · XDR Stream · NetCDF-4">
                    DAP 2.0 · XDR Stream · NetCDF-4
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 min-w-0">
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <a
                  href={`${API_BASE}/opendap/cmems_physical.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-center text-[10.5px] font-semibold shadow-xs transition cursor-pointer truncate"
                  title="Open OPeNDAP Dataset in new tab"
                >
                  Open Dataset ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/opendap/cmems_physical`, "opendap-ep-card")}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200 transition cursor-pointer shrink-0 whitespace-nowrap"
                  title="Copy OPeNDAP Service Endpoint URL"
                >
                  {copiedField === "opendap-ep-card" ? "✓ Copied" : "Copy Endpoint"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(navModals.opendap)}
                className="text-[10.5px] font-medium text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer text-left flex items-center gap-1 truncate w-fit"
                title="View OPeNDAP Technical Specifications"
              >
                <span>View OPeNDAP Specifications</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Service 4: REST API */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-orange-300 transition h-full min-w-0">
            <div className="flex flex-col gap-2.5 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 text-orange-600 mt-0.5">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title="FastAPI RESTful API">REST API</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Operational (v2.0)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 truncate" title="Application Programming Interface">Application Programming Interface</span>
                </div>
              </div>

              {/* Fixed Height Description */}
              <p className="text-[11px] text-slate-500 leading-snug h-[32px] line-clamp-2 min-w-0" title="Programmatic access to datasets, metadata, and observations.">
                Programmatic access to datasets, metadata, and observations.
              </p>

              {/* Verified Capabilities Information Box (Exact 3 Rows) */}
              <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-h-[112px] text-[10.5px] min-w-0 gap-1.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Endpoints:</span>
                  <span className="text-slate-800 font-semibold font-mono text-[9.5px] leading-tight break-words" title="Model Field · Observations · Datasets">
                    Model Field · Observations · Datasets
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Access:</span>
                  <span className="text-slate-700 font-medium text-[10px] leading-tight break-words" title="JSON REST · OpenAPI Docs">
                    JSON REST · OpenAPI Docs
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-1 min-w-0">
                  <span className="text-slate-500 font-medium shrink-0 leading-tight">Data Types:</span>
                  <span className="text-slate-600 font-mono text-[9px] leading-tight break-words" title="Model Outputs · Observations · Metadata">
                    Model Outputs · Observations · Metadata
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100 min-w-0">
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <a
                  href={`${API_BASE.replace(/\/api\/v1\/?$/, "")}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 py-1.5 px-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-center text-[10.5px] font-semibold shadow-xs transition cursor-pointer truncate"
                  title="Open Swagger/OpenAPI Interactive Documentation in new tab"
                >
                  View API Docs ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(API_BASE, "rest-ep-card")}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200 transition cursor-pointer shrink-0 whitespace-nowrap"
                  title="Copy REST API Base URL"
                >
                  {copiedField === "rest-ep-card" ? "✓ Copied" : "Copy Endpoint"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="text-[10.5px] font-medium text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer text-left flex items-center gap-1 truncate w-fit"
                title="View REST API Technical Specifications"
              >
                <span>View REST API Specifications</span>
                <span>→</span>
              </button>
            </div>
          </div>

        </div>

        {/* ─── ROW B: AVAILABLE DATASETS (FULL-WIDTH EXPANDED CARD) ─── */}
        <div className="w-full">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-3.5 select-none w-full">
            
            {/* Header + Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-xs">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
                    <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Available Datasets</h2>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">Explore oceanographic model outputs, in-situ observations, and derived diagnostic products.</p>
                </div>
              </div>

              {/* 3 Pill Tabs */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveDatasetTab("model")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeDatasetTab === "model"
                      ? "bg-[#0284c7] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/70"
                  }`}
                >
                  Model Data
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDatasetTab("observation")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeDatasetTab === "observation"
                      ? "bg-[#0284c7] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/70"
                  }`}
                >
                  Observation Data
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDatasetTab("derived")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeDatasetTab === "derived"
                      ? "bg-[#0284c7] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/70"
                  }`}
                >
                  Derived Products
                </button>
              </div>
            </div>

            {/* Datasets Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs w-full">
              <table className="w-full text-left border-collapse table-fixed text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider h-[36px]">
                    <th className="py-2 px-3.5 w-[28%]">Dataset Name</th>
                    <th className="py-2 px-3 w-[26%]">Variables</th>
                    <th className="py-2 px-3 w-[18%]">Spatial Coverage</th>
                    <th className="py-2 px-3 w-[16%]">Temporal Coverage</th>
                    <th className="py-2 px-3.5 text-right w-[12%]">Service Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentDatasets.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors h-[50px]">
                      {/* Name + Thumbnail */}
                      <td className="py-2 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7.5 h-7.5 rounded-lg overflow-hidden border border-slate-200/80 shrink-0 flex items-center justify-center font-bold text-xs shadow-2xs ${
                            idx % 5 === 0
                              ? "bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-800 text-white"
                              : idx % 5 === 1
                              ? "bg-gradient-to-br from-emerald-400 via-teal-600 to-cyan-800 text-white"
                              : idx % 5 === 2
                              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-700 text-white"
                              : idx % 5 === 3
                              ? "bg-gradient-to-br from-violet-400 via-purple-600 to-indigo-900 text-white"
                              : "bg-gradient-to-br from-teal-400 via-sky-600 to-blue-900 text-white"
                          }`}>
                            {idx % 5 === 0 ? "🌊" : idx % 5 === 1 ? "🧬" : idx % 5 === 2 ? "🇮🇳" : idx % 5 === 3 ? "🌐" : "📊"}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-slate-900 text-[11.5px] leading-tight truncate block" title={row.name}>{row.name}</span>
                            <span className="text-[10px] font-medium text-slate-500 truncate block" title={row.provider}>{row.provider}</span>
                          </div>
                        </div>
                      </td>

                      {/* Variables */}
                      <td className="py-2 px-3 text-slate-600 text-[11px] leading-snug">
                        <span className="truncate block" title={row.variables}>{row.variables}</span>
                      </td>

                      {/* Spatial Coverage */}
                      <td className="py-2 px-3 font-mono text-[10.5px] text-slate-600">
                        <span className="truncate block" title={row.spatial}>{row.spatial}</span>
                      </td>

                      {/* Temporal Coverage */}
                      <td className="py-2 px-3 font-mono text-[10.5px] text-slate-600">
                        <span className="truncate block" title={row.temporal}>{row.temporal}</span>
                      </td>

                      {/* Service Links */}
                      <td className="py-2 px-3.5 text-right font-mono text-[10.5px] shrink-0 whitespace-nowrap">
                        {row.ogcReady ? (
                          <div className="flex items-center justify-end gap-1.5 text-[#0284c7] font-semibold">
                            <button
                              type="button"
                              onClick={() => setInfoModal(navModals.wms)}
                              className="hover:underline cursor-pointer"
                              title="OGC WMS Specification"
                            >
                              WMS
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setInfoModal(navModals.wcs)}
                              className="hover:underline cursor-pointer"
                              title="OGC WCS Specification"
                            >
                              WCS
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setInfoModal(navModals.opendap)}
                              className="hover:underline cursor-pointer"
                              title="OPeNDAP Subsetting"
                            >
                              DAP
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 font-semibold">
                            <button
                              type="button"
                              onClick={() => setInfoModal(navModals.opendap)}
                              className="text-[#0284c7] hover:underline cursor-pointer"
                            >
                              DAP
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setIsApiModalOpen(true)}
                              className="text-orange-600 hover:underline cursor-pointer"
                            >
                              API
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* ─── ROW B2: QUICK START (LEFT) & DATA ACCESS INFORMATION (RIGHT) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Quick Start Card (6 cols) */}
          <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-3.5 select-none">
            
            {/* Header + Subtitle */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 mt-0.5 shadow-xs text-base">
                🚀
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Quick Start</h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Get started with our data services using the interactive examples below.</p>
              </div>
            </div>

            {/* Language Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setCodeLanguage("python")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "python"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => setCodeLanguage("javascript")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "javascript"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                JavaScript
              </button>
              <button
                type="button"
                onClick={() => setCodeLanguage("curl")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "curl"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                cURL
              </button>
              <button
                type="button"
                onClick={() => setCodeLanguage("wms")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "wms"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                OGC WMS
              </button>
              <button
                type="button"
                onClick={() => setCodeLanguage("wcs")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "wcs"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                OGC WCS
              </button>
              <button
                type="button"
                onClick={() => setCodeLanguage("opendap")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  codeLanguage === "opendap"
                    ? "bg-[#0284c7] text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                OPeNDAP
              </button>
            </div>

            {/* Fixed Height Code Box */}
            <div className="relative rounded-xl overflow-hidden bg-[#0d1b2a] border border-slate-800 text-slate-200 p-3 font-mono text-[11px] leading-relaxed select-text h-[258px] flex flex-col justify-between">
              <button
                type="button"
                onClick={() => handleCopy(codeSnippets[codeLanguage], "codeBox")}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer z-10"
                title="Copy to clipboard"
              >
                {copiedField === "codeBox" ? (
                  <span className="text-[10px] text-emerald-400 font-sans px-1.5 py-0.5 bg-emerald-950/80 rounded border border-emerald-500/30">✓ Copied!</span>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <pre className="overflow-x-auto overflow-y-auto whitespace-pre no-scrollbar h-full">
                <code>{codeSnippets[codeLanguage]}</code>
              </pre>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="font-semibold text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer flex items-center gap-1"
              >
                <span>View more examples in our Documentation</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Data Access Information Card (6 cols) */}
          <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-3 select-none">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <div className="w-5 h-5 rounded-md bg-sky-100 text-[#0284c7] flex items-center justify-center font-bold text-xs">
                ℹ
              </div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Data Access Information</h3>
            </div>

            {/* Endpoint 1: Base URL (APIs) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-slate-700">Base URL (APIs)</span>
                <span className="text-[9.5px] text-emerald-600 font-semibold font-mono">Live Endpoint</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-800">
                <span className="truncate">https://sagarnetra.incois.gov.in/api/v1</span>
                <button
                  type="button"
                  onClick={() => handleCopy("https://sagarnetra.incois.gov.in/api/v1", "ep1")}
                  className="ml-2 text-slate-400 hover:text-sky-600 cursor-pointer"
                >
                  {copiedField === "ep1" ? "✓" : "📋"}
                </button>
              </div>
            </div>

            {/* Endpoint 2: WMS Endpoint */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-slate-700">WMS Endpoint (OGC WMS 1.3.0)</span>
                <span className="text-[9.5px] text-emerald-600 font-semibold font-mono">Live Endpoint</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-800">
                <span className="truncate">{API_BASE}/ogc/wms</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/ogc/wms`, "ep2")}
                  className="ml-2 text-slate-400 hover:text-sky-600 cursor-pointer"
                  title="Copy WMS Endpoint"
                >
                  {copiedField === "ep2" ? "✓" : "📋"}
                </button>
              </div>
            </div>

            {/* Endpoint 3: WCS Endpoint */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-slate-700">WCS Endpoint (OGC WCS 2.0.1)</span>
                <span className="text-[9.5px] text-emerald-600 font-semibold font-mono">Live Endpoint</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-800">
                <span className="truncate">{API_BASE}/ogc/wcs</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/ogc/wcs`, "ep3")}
                  className="ml-2 text-slate-400 hover:text-sky-600 cursor-pointer"
                  title="Copy WCS Endpoint"
                >
                  {copiedField === "ep3" ? "✓" : "📋"}
                </button>
              </div>
            </div>

            {/* Endpoint 4: OPeNDAP Endpoint */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-slate-700">OPeNDAP Endpoint (DAP 2.0)</span>
                <span className="text-[9.5px] text-emerald-600 font-semibold font-mono">Live Endpoint</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-800">
                <span className="truncate">{API_BASE}/opendap/cmems_physical</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`${API_BASE}/opendap/cmems_physical`, "ep4")}
                  className="ml-2 text-slate-400 hover:text-sky-600 cursor-pointer"
                  title="Copy OPeNDAP Endpoint"
                >
                  {copiedField === "ep4" ? "✓" : "📋"}
                </button>
              </div>
            </div>

            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] transition cursor-pointer flex items-center gap-1"
              >
                <span>View complete API reference</span>
                <span>→</span>
              </button>
            </div>

          </div>

        </div>

        {/* ─── ROW B3: 4 INFORMATION CARDS (DOCUMENTATION, POLICY, SCRIPTS, SUPPORT) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
          
          {/* Card 1: Documentation */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-2.5 hover:border-sky-300 transition">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284c7] shrink-0 shadow-2xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Documentation</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                  User guides, API references, and tutorials to help you access and use the data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 transition cursor-pointer self-start"
            >
              <span>Explore Documentation</span>
              <span>→</span>
            </button>
          </div>

          {/* Card 2: Data Policy & License */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-2.5 hover:border-blue-300 transition">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Data Policy & License</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                  Our data follows open access policies with proper attribution requirements.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(navModals.dataPolicy)}
              className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 transition cursor-pointer self-start"
            >
              <span>Read Data Policy</span>
              <span>→</span>
            </button>
          </div>

          {/* Card 3: Sample Scripts */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-2.5 hover:border-cyan-300 transition">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0 shadow-2xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Sample Scripts</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                  Ready-to-use code examples in Python, MATLAB, and other languages.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(navModals.sampleScripts)}
              className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 transition cursor-pointer self-start"
            >
              <span>View Examples</span>
              <span>→</span>
            </button>
          </div>

          {/* Card 4: Support */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-2.5 hover:border-indigo-300 transition">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Support</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                  Need help? Contact our support team for technical assistance.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(navModals.support)}
              className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 transition cursor-pointer self-start"
            >
              <span>Contact Support</span>
              <span>→</span>
            </button>
          </div>

        </div>

        {/* ─── ROW C: EXTENSIBLE DATA ARCHITECTURE (STEP 1 EXTENSIBILITY LAYER) ─── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-4 select-none">
          
          {/* Header + Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  EXTENSIBLE DATA ARCHITECTURE
                </h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Modular adapters and registries allow new observation sources and ocean variables to be integrated with minimal changes to the core platform.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Registry Architecture Active
              </span>
            </div>
          </div>

          {/* Conceptual Architecture Flow Diagram */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 sm:p-4">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>Architectural Data Flow Pipeline</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Input Layer</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">Data Sources</div>
                <div className="text-[10px] text-slate-500">CMEMS · WOD · In-situ</div>
              </div>

              <div className="text-slate-400 font-bold hidden sm:block">→</div>

              <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                <div className="text-[10px] font-semibold text-indigo-500 uppercase">Adapter Layer</div>
                <div className="text-xs font-bold text-indigo-900 mt-0.5">Model & Obs Adapters</div>
                <div className="text-[10px] text-slate-500">BaseAdapter Contracts</div>
              </div>

              <div className="text-slate-400 font-bold hidden sm:block">→</div>

              <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                <div className="text-[10px] font-semibold text-sky-500 uppercase">Unified Core</div>
                <div className="text-xs font-bold text-sky-900 mt-0.5">Unified Data Layer</div>
                <div className="text-[10px] text-slate-500">Registries & Schemas</div>
              </div>

              <div className="text-slate-400 font-bold hidden sm:block">→</div>

              <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                <div className="text-[10px] font-semibold text-teal-500 uppercase">Service Layer</div>
                <div className="text-xs font-bold text-teal-900 mt-0.5">Services & APIs</div>
                <div className="text-[10px] text-slate-500">FastAPI Endpoints</div>
              </div>

              <div className="text-slate-400 font-bold hidden sm:block">→</div>

              <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-xs">
                <div className="text-[10px] font-semibold text-blue-600 uppercase">Presentation</div>
                <div className="text-xs font-bold text-[#0a2e5c] mt-0.5">SAGAR NETRA 3D</div>
                <div className="text-[10px] text-slate-500">WebGL / 3D Workstation</div>
              </div>
            </div>
          </div>

          {/* 4 Cards: Supported Sources, Active Obs Types, Extension-Ready Sensors, Extension-Ready Variables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            
            {/* Card 1: Supported Data Sources */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col justify-between gap-2 shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SUPPORTED DATA SOURCES</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Operational</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11.5px] font-semibold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
                    <span>CMEMS (Copernicus Marine)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    <span>WOD (World Ocean Database)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>IFREMER (Coriolis GDAC)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <span>NOAA (NCEI Repositories)</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                Authoritative upstream archives configured
              </div>
            </div>

            {/* Card 2: Current Observation Types */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col justify-between gap-2 shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CURRENT OBSERVATION TYPES</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active Data</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11.5px] font-semibold text-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Argo Floats</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">PFL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Underwater Gliders</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">GLD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Shipboard CTD Casts</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">CTD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>BGC Profiling Floats</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">BGC</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                100% real-data profile depth soundings
              </div>
            </div>

            {/* Card 3: Extension-Ready Sensors */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col justify-between gap-2 shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EXTENSION-READY SENSORS</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Future / Extension Ready</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11.5px] font-medium text-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Ocean Moorings / Buoys</span>
                    </div>
                    <span className="text-[9.5px] text-amber-600 font-semibold font-mono">RAMA/OMNI</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>ADCP Velocity Profilers</span>
                    </div>
                    <span className="text-[9.5px] text-amber-600 font-semibold font-mono">ADCP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>HF Coastal Radar Arrays</span>
                    </div>
                    <span className="text-[9.5px] text-amber-600 font-semibold font-mono">HFR</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-amber-700 bg-amber-50/60 rounded px-1.5 py-0.5 border border-amber-100">
                Extension points ready for new sensor adapters
              </div>
            </div>

            {/* Card 4: Extension-Ready Variables */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col justify-between gap-2 shadow-2xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EXTENSION-READY VARIABLES</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Future / Extension Ready</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11.5px] font-medium text-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Dissolved Oxygen</span>
                    </div>
                    <span className="text-[9.5px] text-purple-600 font-semibold font-mono">µmol/kg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Nitrate Concentration</span>
                    </div>
                    <span className="text-[9.5px] text-purple-600 font-semibold font-mono">µmol/kg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Sea Water pH</span>
                    </div>
                    <span className="text-[9.5px] text-purple-600 font-semibold font-mono">Total Scale</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Water Turbidity / BBP</span>
                    </div>
                    <span className="text-[9.5px] text-purple-600 font-semibold font-mono">NTU</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-purple-700 bg-purple-50/60 rounded px-1.5 py-0.5 border border-purple-100">
                Registered CF definitions ready for ingestion
              </div>
            </div>

          </div>

        </div>

        {/* ─── ROW D: DATA INGESTION (STEP 2 INGESTION PIPELINE) ─── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-4 select-none">
          
          {/* Header + Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 shadow-xs">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  DATA INGESTION
                </h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Automated detection, scientific validation, and normalization for NetCDF, CSV, TSV, and ASCII datasets.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Automated Ingestion: Enabled
              </span>
              <button
                type="button"
                onClick={handleOpenIngestionModal}
                className="px-3 py-1 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
              >
                <span>View Ingestion Status</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Visual Ingestion Workflow */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            
            {/* Visual Workflow ASCII / Flow Diagram */}
            <div className="lg:col-span-8 bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 sm:p-4">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Ingestion Workflow Pipeline</span>
                <span className="text-[10px] text-slate-400 font-mono">Incoming Directory: data/incoming/</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                
                {/* Inputs Stack */}
                <div className="flex flex-col gap-1.5 w-full sm:w-28 shrink-0">
                  <div className="px-2 py-1 bg-white border border-blue-200 rounded-md font-mono text-[11px] font-semibold text-blue-800 text-center shadow-2xs">
                    NetCDF (.nc)
                  </div>
                  <div className="px-2 py-1 bg-white border border-teal-200 rounded-md font-mono text-[11px] font-semibold text-teal-800 text-center shadow-2xs">
                    CSV (.csv)
                  </div>
                  <div className="px-2 py-1 bg-white border border-emerald-200 rounded-md font-mono text-[11px] font-semibold text-emerald-800 text-center shadow-2xs">
                    TSV (.tsv)
                  </div>
                  <div className="px-2 py-1 bg-white border border-purple-200 rounded-md font-mono text-[11px] font-semibold text-purple-800 text-center shadow-2xs">
                    ASCII (.txt, .dat)
                  </div>
                </div>

                <div className="text-slate-400 font-bold text-lg hidden sm:block">──┤ →</div>

                {/* Processing Steps */}
                <div className="flex-1 grid grid-cols-3 gap-2 w-full">
                  <div className="bg-white border border-slate-200 rounded-lg p-2 text-center shadow-2xs">
                    <div className="text-[9.5px] font-semibold text-indigo-500 uppercase">Step 1</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">Adapter</div>
                    <div className="text-[9.5px] text-slate-500">Registry Router</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-2 text-center shadow-2xs">
                    <div className="text-[9.5px] font-semibold text-amber-500 uppercase">Step 2</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">Validation</div>
                    <div className="text-[9.5px] text-slate-500">Lat/Lon/Depth QC</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-2 text-center shadow-2xs">
                    <div className="text-[9.5px] font-semibold text-emerald-500 uppercase">Step 3</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">Unified Data</div>
                    <div className="text-[9.5px] text-slate-500">Live Observation API</div>
                  </div>
                </div>

              </div>
            </div>

            {/* Supported Formats Card */}
            <div className="lg:col-span-4 border border-slate-200 rounded-xl p-3 sm:p-3.5 bg-white flex flex-col justify-between gap-2 shadow-2xs h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">SUPPORTED FORMATS</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Handlers
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-800">
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>NetCDF-4</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span>CSV Tabular</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>TSV Tab-Sep</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>ASCII Delimited</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Deduplication: SHA-256</span>
                <span className="text-emerald-600 font-semibold font-mono">Zero-Duplicate Mode</span>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ────────────────────────────────────────────────────────────
          4. INSTITUTIONAL FOOTER
      ──────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between shrink-0 text-[11px] text-slate-500 font-sans mt-2">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-slate-600">Data Sources:</span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] inline-block" />
            Copernicus Marine Service (CMEMS)
          </span>
          <span className="flex items-center gap-1 hover:text-slate-800 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
            IFREMER
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
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
            INCOIS
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200" />
            Official Data Sources Configured
          </span>
          <span className="hidden md:inline">|</span>
          <span className="text-slate-500">Last Updated: 15 Feb 2026, 12:30 UTC</span>
        </div>
      </footer>

      {/* ────────────────────────────────────────────────────────────
          5. INTERACTIVE API DOCUMENTATION MODAL
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isApiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setIsApiModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 max-w-3xl w-full max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl text-slate-800 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">Sagar Netra 3D REST API v2.0 Specification</h3>
                    <p className="text-xs text-slate-500">FastAPI backend endpoints serving real CMEMS & WOD in-situ datasets.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: Endpoints List */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
                
                {/* Endpoint 1: Health */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/health</span>
                    </div>
                    <span className="text-[10px] text-slate-400">System Health</span>
                  </div>
                  <p className="text-slate-600">Verifies backend status, cached NetCDF file handles, and memory subsystem health.</p>
                </div>

                {/* Endpoint 2: Datasets */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/datasets</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Catalog</span>
                  </div>
                  <p className="text-slate-600">Lists all registered ocean model archives and observation databases.</p>
                </div>

                {/* Endpoint 3: Model Field Slice */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/model/field</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Numerical Grids</span>
                  </div>
                  <p className="text-slate-600">Extracts 2D depth-slice grids for temperature, salinity, currents, or chlorophyll in JSON or SD3D binary format.</p>
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-md">
                    Parameters: variable (str), depth (float), time_idx (int), format (json|binary)
                  </div>
                </div>

                {/* Endpoint 4: In-situ Observations List */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/observations</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Observation Queries</span>
                  </div>
                  <p className="text-slate-600">Queries geo-filtered in-situ observation platforms (Argo floats, gliders, CTD profiles, BGC sensors).</p>
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-md">
                    Parameters: type (argo|glider|ctd|bgc), lat_min, lat_max, lon_min, lon_max, limit
                  </div>
                </div>

                {/* Endpoint 5: Observation Sounding Profile */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/observations/{`{id}`}/profile</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Vertical Soundings</span>
                  </div>
                  <p className="text-slate-600">Returns high-resolution depth profiles of temperature, salinity, density, and oxygen measurements.</p>
                </div>

                {/* Endpoint 6: Indian Exclusive Economic Zone (EEZ) GeoJSON */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/geospatial/india-eez</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Geospatial Boundary</span>
                  </div>
                  <p className="text-slate-600">Returns authoritative Indian EEZ maritime boundary GeoJSON polygons (Mainland, Lakshadweep, Andaman &amp; Nicobar) from Marine Regions (VLIZ) World EEZ Dataset v12 (MRGID 8480, 8333).</p>
                </div>

                {/* Endpoint 7: Model vs Observation Sounding Comparison */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">GET</span>
                      <span className="font-mono font-bold text-slate-800">/api/v1/compare/model-observation</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Scientific Validation</span>
                  </div>
                  <p className="text-slate-600">Compares in-situ sounding profiles with nearest numerical ocean model predictions across depth, time, and space, calculating layer residuals (Observation - Model), MAE, and RMSD.</p>
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-md">
                    Parameters: obs_id (required), variable (temperature|salinity|chlorophyll), model_date (optional)
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Base: http://127.0.0.1:8000/api/v1</span>
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Close Documentation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────
          6. INSTITUTIONAL INFO MODALS
      ──────────────────────────────────────────────────────────── */}
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

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {infoModal.ctaText && infoModal.ctaAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoModal(null)
                      infoModal.ctaAction?.()
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    {infoModal.ctaText}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ────────────────────────────────────────────────────────────
          7. AUTOMATED INGESTION STATUS MODAL
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIngestionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setIsIngestionModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 max-w-2xl w-full max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl text-slate-800 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">Automated Ingestion Pipeline Status</h3>
                    <p className="text-xs text-slate-500">Live monitoring of incoming folder, deduplication, and adapter jobs.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsIngestionModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
                
                {/* Status KPI Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Files Discovered</div>
                    <div className="text-xl font-bold text-slate-800 mt-0.5">
                      {ingestionStatus?.files_discovered ?? 0}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Files Ingested</div>
                    <div className="text-xl font-bold text-emerald-800 mt-0.5">
                      {ingestionStatus?.files_ingested ?? 0}
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-rose-600 uppercase">Files Failed</div>
                    <div className="text-xl font-bold text-rose-800 mt-0.5">
                      {ingestionStatus?.files_failed ?? 0}
                    </div>
                  </div>
                </div>

                {/* Subsystem Details */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Incoming Directory:</span>
                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {ingestionStatus?.incoming_directory ?? "data/incoming/"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Last Directory Scan:</span>
                    <span className="font-mono text-slate-800">
                      {ingestionStatus?.last_scan_time ?? "Live on demand"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Supported Formats:</span>
                    <span className="text-slate-700">NetCDF, CSV, TSV, ASCII</span>
                  </div>
                </div>

                {/* Recent Ingestion Log */}
                <div>
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Recent Ingestion Log
                  </div>
                  {ingestionStatus?.recent_jobs && ingestionStatus.recent_jobs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {ingestionStatus.recent_jobs.map((job, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 truncate">{job.file_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {job.format} · {job.valid_records} valid records
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold font-mono ${
                            job.status === "INGESTED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {job.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs">
                      No external incoming files dropped yet. Drop .csv, .tsv, or .nc files into <code className="text-slate-600">data/incoming/</code>.
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTriggerScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>{isScanning ? "Scanning..." : "🔄 Trigger Directory Scan"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsIngestionModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
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
