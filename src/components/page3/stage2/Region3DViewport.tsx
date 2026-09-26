"use client"

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react"
import * as THREE from "three"
import { GeographicBounds } from "../globe/RegionSelectionBox"
import { ObservationItem } from "@/lib/observationsApi"
import { ModelFieldResponse } from "@/lib/modelApi"
import { ModelControlState } from "./ModelControlPanel"
import { buildLut, cssGradient, PaletteId } from "@/lib/colormaps"
import { extractIsosurface } from "@/lib/marchingCubes"
import { createVolumeMesh, VolumeMeshHandle } from "@/lib/volumeRenderer"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

export interface ObservationCluster {
  id: string
  centroidX: number
  centroidY: number
  centroidZ: number
  lat: number
  lon: number
  count: number
  countsByType: {
    argo: number
    glider: number
    ctd: number
    bgc: number
  }
  items: ObservationItem[]
}

const _tempMatrix = new THREE.Matrix4()
const _tempPos = new THREE.Vector3()
const _tempScale = new THREE.Vector3(1, 1, 1)
const _tempQuat = new THREE.Quaternion()

interface Region3DViewportProps {
  selectedRegion: GeographicBounds | null
  modelState: ModelControlState
  depthStack: ModelFieldResponse[]
  uDepthStack: ModelFieldResponse[]
  vDepthStack: ModelFieldResponse[]
  modelLoading: boolean
  modelError: string | null
  observations: ObservationItem[]
  obsLoading: boolean
  obsError: string | null
  selectedObsId?: string | null
  onSelectObservation?: (obs: ObservationItem) => void
  isMaximized?: boolean
  onToggleMaximize?: () => void
}

export default function Region3DViewport({
  selectedRegion,
  modelState,
  depthStack,
  uDepthStack,
  vDepthStack,
  modelLoading,
  modelError,
  observations,
  obsLoading,
  obsError,
  selectedObsId,
  onSelectObservation,
  isMaximized: isMaximizedProp,
  onToggleMaximize,
}: Region3DViewportProps) {
  const [isNavActive, setIsNavActive] = useState<boolean>(true)
  const [hoveredObs, setHoveredObs] = useState<ObservationItem | null>(null)
  const [hoveredCluster, setHoveredCluster] = useState<ObservationCluster | null>(null)
  const [activeLod, setActiveLod] = useState<number>(0)
  const [renderedMarkerCount, setRenderedMarkerCount] = useState<number>(0)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [viewMode, setViewMode] = useState<"3d" | "top" | "side">("3d")
  const [internalMaximized, setInternalMaximized] = useState<boolean>(false)

  const isMaximized = isMaximizedProp !== undefined ? isMaximizedProp : internalMaximized
  const toggleMaximize = onToggleMaximize || (() => setInternalMaximized((prev) => !prev))

  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const volumeHandleRef = useRef<VolumeMeshHandle | null>(null)
  const obsInstancedMeshesRef = useRef<Record<string, THREE.InstancedMesh>>({})
  const clusterInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const obsInstanceMapRef = useRef<Record<string, ObservationItem[]>>({
    argo: [],
    glider: [],
    ctd: [],
    bgc: [],
  })
  const clusterMapRef = useRef<ObservationCluster[]>([])
  const sharedClusterGeoRef = useRef<THREE.SphereGeometry | null>(null)
  const clusterMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const selectedHighlightMeshRef = useRef<THREE.Mesh | null>(null)
  const lastLodRef = useRef<number>(-1)
  const updateObservationLODRef = useRef<(camDist?: number) => void>(() => {})
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const notifyInteraction = useCallback(() => {
    if (volumeHandleRef.current) {
      volumeHandleRef.current.setInteractive(true)
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      interactionTimeoutRef.current = setTimeout(() => {
        if (volumeHandleRef.current) {
          volumeHandleRef.current.setInteractive(false)
        }
      }, 150)
    }
  }, [])

  const cageMeshRef = useRef<{
    mesh: THREE.LineSegments
    geo: THREE.BoxGeometry
    edges: THREE.EdgesGeometry
    mat: THREE.LineBasicMaterial
  } | null>(null)

  interface SlicePlaneRecord {
    planeMesh: THREE.Mesh
    borderMesh: THREE.LineSegments
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    texture: THREE.CanvasTexture
    planeMat: THREE.MeshBasicMaterial
    borderMat: THREE.LineBasicMaterial
    depthMeters: number
  }
  const sliceRecordsRef = useRef<SlicePlaneRecord[]>([])
  const sharedPlaneGeoRef = useRef<THREE.PlaneGeometry | null>(null)
  const sharedBorderGeoRef = useRef<THREE.EdgesGeometry | null>(null)

  const currentsMeshRef = useRef<{
    mesh: THREE.LineSegments
    geo: THREE.BufferGeometry
    mat: THREE.LineBasicMaterial
    capacity: number
  } | null>(null)

  const isoMeshRef = useRef<{
    mesh: THREE.Mesh
    wireMesh: THREE.Mesh
    mat: THREE.MeshStandardMaterial
    wireMat: THREE.MeshBasicMaterial
  } | null>(null)

  const sharedObsGeoRef = useRef<THREE.SphereGeometry | null>(null)
  const obsMaterialsRef = useRef<Record<string, THREE.MeshBasicMaterial> | null>(null)
  const modelLayerGroupRef = useRef<THREE.Group | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseVecRef = useRef<THREE.Vector2>(new THREE.Vector2())

  const pointerDownRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 })

  const verticalExaggeration = modelState.verticalExaggeration || 7

  const controlsRef = useRef<{
    isDragging: boolean
    isRightDragging: boolean
    prevX: number
    prevY: number
    rotX: number
    rotY: number
    distance: number
    panX: number
    panY: number
  }>({
    isDragging: false,
    isRightDragging: false,
    prevX: 0,
    prevY: 0,
    rotX: 0.55,
    rotY: -0.65,
    distance: 24,
    panX: 0,
    panY: 0,
  })

  const bounds = useMemo(() => {
    if (!selectedRegion) {
      return { latMin: -18.0, latMax: -5.0, lonMin: 65.0, lonMax: 85.0 }
    }
    return {
      latMin: Math.min(selectedRegion.latMin, selectedRegion.latMax),
      latMax: Math.max(selectedRegion.latMin, selectedRegion.latMax),
      lonMin: Math.min(selectedRegion.lonMin, selectedRegion.lonMax),
      lonMax: Math.max(selectedRegion.lonMin, selectedRegion.lonMax),
    }
  }, [selectedRegion])

  const latSpan = bounds.latMax - bounds.latMin || 1
  const lonSpan = bounds.lonMax - bounds.lonMin || 1

  const validObservations = useMemo(() => {
    return observations.filter(
      (obs) =>
        obs.latitude >= bounds.latMin &&
        obs.latitude <= bounds.latMax &&
        obs.longitude >= bounds.lonMin &&
        obs.longitude <= bounds.lonMax
    )
  }, [observations, bounds])

  const formatCoord = (val: number, isLat: boolean) => {
    if (isLat) {
      return val >= 0 ? `${val.toFixed(2)}°N` : `${Math.abs(val).toFixed(2)}°S`
    }
    return val >= 0 ? `${val.toFixed(2)}°E` : `${Math.abs(val).toFixed(2)}°W`
  }

  const getDateStr = (index: number) => {
    const baseDate = new Date(Date.UTC(2026, 0, 1))
    baseDate.setUTCDate(baseDate.getUTCDate() + index)
    const day = baseDate.getUTCDate().toString().padStart(2, "0")
    const month = baseDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    const year = baseDate.getUTCFullYear()
    return `${day} ${month} ${year}`
  }

  const isCurrents = modelState.variable === "currents"
  const palette: PaletteId =
    modelState.variable === "salinity"
      ? "viridis"
      : modelState.variable === "chlorophyll"
      ? "plasma"
      : "turbo"

  const gradient = cssGradient(palette, 32)

  // Find nearest actual resolved depth from loaded depth stack
  const resolvedSlice = useMemo(() => {
    if (depthStack.length === 0) return null
    return depthStack.reduce((prev, curr) =>
      Math.abs((curr.depth ?? 0) - modelState.depth) < Math.abs((prev.depth ?? 0) - modelState.depth)
        ? curr
        : prev
    )
  }, [depthStack, modelState.depth])

  const resolvedDepth = resolvedSlice?.depth ?? modelState.depth
  const primarySlice = resolvedSlice || depthStack[0]

  // Default isovalue according to variable
  const activeIsovalue = useMemo(() => {
    if (modelState.isosurfaceValue !== undefined) return modelState.isosurfaceValue
    if (modelState.variable === "temperature") return 26.0
    if (modelState.variable === "salinity") return 35.0
    if (modelState.variable === "chlorophyll") return 0.3
    return 0.35 // currents speed (m/s)
  }, [modelState.isosurfaceValue, modelState.variable])

  // Initialize Three.js WebGL Scene (Single idempotent lifecycle)
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Ambient & Directional Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 1.4)
    scene.add(ambLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(12, 24, 16)
    scene.add(dirLight)

    let reqId: number
    const updateCamera = () => {
      const { rotX, rotY, distance, panX, panY } = controlsRef.current
      const x = distance * Math.cos(rotX) * Math.sin(rotY) + panX
      const y = distance * Math.sin(rotX) + panY
      const z = distance * Math.cos(rotX) * Math.cos(rotY)
      camera.position.set(x, y, z)
      camera.lookAt(panX, panY - 2.5, 0)

      // Update volume ray-marcher camera origin
      if (volumeHandleRef.current) {
        volumeHandleRef.current.updateCameraPos(camera.position)
      }
    }

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      updateCamera()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container || !renderer || !camera) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(container)

    return () => {
      window.removeEventListener("resize", handleResize)
      resizeObserver.disconnect()
      cancelAnimationFrame(reqId)
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      if (volumeHandleRef.current) {
        volumeHandleRef.current.dispose()
        volumeHandleRef.current = null
      }
      if (cageMeshRef.current) {
        cageMeshRef.current.geo.dispose()
        cageMeshRef.current.edges.dispose()
        cageMeshRef.current.mat.dispose()
        cageMeshRef.current = null
      }
      if (sharedPlaneGeoRef.current) {
        sharedPlaneGeoRef.current.dispose()
        sharedPlaneGeoRef.current = null
      }
      if (sharedBorderGeoRef.current) {
        sharedBorderGeoRef.current.dispose()
        sharedBorderGeoRef.current = null
      }
      sliceRecordsRef.current.forEach((r) => {
        r.texture.dispose()
        r.planeMat.dispose()
        r.borderMat.dispose()
      })
      sliceRecordsRef.current = []
      if (currentsMeshRef.current) {
        currentsMeshRef.current.geo.dispose()
        currentsMeshRef.current.mat.dispose()
        currentsMeshRef.current = null
      }
      if (isoMeshRef.current) {
        if (isoMeshRef.current.mesh.geometry) isoMeshRef.current.mesh.geometry.dispose()
        isoMeshRef.current.mat.dispose()
        isoMeshRef.current.wireMat.dispose()
        isoMeshRef.current = null
      }
      if (sharedObsGeoRef.current) {
        sharedObsGeoRef.current.dispose()
        sharedObsGeoRef.current = null
      }
      if (sharedClusterGeoRef.current) {
        sharedClusterGeoRef.current.dispose()
        sharedClusterGeoRef.current = null
      }
      if (obsMaterialsRef.current) {
        Object.values(obsMaterialsRef.current).forEach((m) => m.dispose())
        obsMaterialsRef.current = null
      }
      if (clusterMaterialRef.current) {
        clusterMaterialRef.current.dispose()
        clusterMaterialRef.current = null
      }
      if (obsInstancedMeshesRef.current) {
        Object.values(obsInstancedMeshesRef.current).forEach((m) => {
          m.dispose()
        })
        obsInstancedMeshesRef.current = {}
      }
      if (clusterInstancedMeshRef.current) {
        clusterInstancedMeshRef.current.dispose()
        clusterInstancedMeshRef.current = null
      }
      if (selectedHighlightMeshRef.current) {
        selectedHighlightMeshRef.current.geometry.dispose()
        ;(selectedHighlightMeshRef.current.material as THREE.Material).dispose()
        selectedHighlightMeshRef.current = null
      }
      if (modelLayerGroupRef.current && sceneRef.current) {
        sceneRef.current.remove(modelLayerGroupRef.current)
        modelLayerGroupRef.current = null
      }
      const canvas = renderer.domElement
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      renderer.dispose()
    }
  }, [])

  // Build & update 3D Model Depth Planes, Currents Vectors, Isosurfaces, 3D Volume, and Depth Cage with GPU resource reuse
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (!modelLayerGroupRef.current) {
      const rootGroup = new THREE.Group()
      rootGroup.name = "model3d_layer"
      scene.add(rootGroup)
      modelLayerGroupRef.current = rootGroup
    }
    const rootGroup = modelLayerGroupRef.current

    // 3D Scene Scaling: X = Lon [-6, +6], Z = Lat [-4, +4], Y = -Depth [0, -maxZDepth]
    const planeW = 12
    const planeH = 8
    const maxZDepth = verticalExaggeration // Dynamic vertical exaggeration scale (1 to 10)
    const lut = buildLut(palette, 256)

    // 1. Reusable Bounding Volume Grid & Depth Axis Reference Cage (Allocated once, scaled in-place)
    if (!cageMeshRef.current) {
      const cageGeo = new THREE.BoxGeometry(1, 1, 1)
      const cageEdges = new THREE.EdgesGeometry(cageGeo)
      const cageMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.35 })
      const cageMesh = new THREE.LineSegments(cageEdges, cageMat)
      rootGroup.add(cageMesh)
      cageMeshRef.current = { mesh: cageMesh, geo: cageGeo, edges: cageEdges, mat: cageMat }
    }
    cageMeshRef.current.mesh.scale.set(planeW, maxZDepth, planeH)
    cageMeshRef.current.mesh.position.set(0, -maxZDepth / 2, 0)

    // 2. Render Real Depth Slices with Plane Geometry & Canvas Texture Reuse
    if (!sharedPlaneGeoRef.current) {
      sharedPlaneGeoRef.current = new THREE.PlaneGeometry(1, 1)
      sharedBorderGeoRef.current = new THREE.EdgesGeometry(sharedPlaneGeoRef.current)
    }

    if (!isCurrents && depthStack.length > 0) {
      const slicesToRender = modelState.showDepthSlices
        ? depthStack
        : resolvedSlice
        ? [resolvedSlice]
        : [depthStack[0]]

      slicesToRender.forEach((slice, sIdx) => {
        if (!slice.values || slice.values.length === 0) return

        const depthMeters = slice.depth ?? 0
        const yPos = -Math.min(1.0, depthMeters / 1000) * maxZDepth
        const width = slice.width
        const height = slice.height
        const isSelected = Math.abs(depthMeters - resolvedDepth) < 1.0

        let record = sliceRecordsRef.current[sIdx]
        if (!record) {
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")!
          const texture = new THREE.CanvasTexture(canvas)
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter

          const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
          const planeMesh = new THREE.Mesh(sharedPlaneGeoRef.current!, planeMat)
          planeMesh.rotation.x = -Math.PI / 2

          const borderMat = new THREE.LineBasicMaterial({
            transparent: true,
          })
          const borderMesh = new THREE.LineSegments(sharedBorderGeoRef.current!, borderMat)
          borderMesh.rotation.x = -Math.PI / 2

          rootGroup.add(planeMesh)
          rootGroup.add(borderMesh)

          record = {
            planeMesh,
            borderMesh,
            canvas,
            ctx,
            texture,
            planeMat,
            borderMat,
            depthMeters,
          }
          sliceRecordsRef.current[sIdx] = record
        }

        record.depthMeters = depthMeters

        if (record.canvas.width !== width || record.canvas.height !== height) {
          record.canvas.width = width
          record.canvas.height = height
        }

        const imgData = record.ctx.createImageData(width, height)
        const data = imgData.data
        const minV = slice.min_value ?? 0
        const maxV = slice.max_value ?? 1
        const span = maxV - minV || 1

        for (let r = 0; r < height; r++) {
          const latIdx = height - 1 - r
          const row = slice.values[latIdx]
          if (!row) continue

          for (let c = 0; c < width; c++) {
            const val = row[c]
            const pxIdx = (r * width + c) * 4

            if (val === null || val === undefined || isNaN(val)) {
              data[pxIdx + 3] = 0 // Transparent land/missing
            } else {
              const t = Math.max(0, Math.min(1, (val - minV) / span))
              const lutIdx = Math.min(255, Math.floor(t * 255))
              data[pxIdx] = lut[lutIdx * 3]
              data[pxIdx + 1] = lut[lutIdx * 3 + 1]
              data[pxIdx + 2] = lut[lutIdx * 3 + 2]
              data[pxIdx + 3] = modelState.show3DVolume
                ? 80
                : modelState.showIsosurfaces
                ? 160
                : 230
            }
          }
        }
        record.ctx.putImageData(imgData, 0, 0)
        record.texture.needsUpdate = true

        record.planeMesh.position.set(0, yPos, 0)
        record.planeMesh.scale.set(planeW, planeH, 1)
        record.planeMat.opacity = isSelected ? (modelState.show3DVolume ? 0.75 : 0.98) : (modelState.show3DVolume ? 0.35 : 0.65)
        record.planeMesh.visible = true

        record.borderMesh.position.set(0, yPos, 0)
        record.borderMesh.scale.set(planeW, planeH, 1)
        record.borderMat.color.setHex(isSelected ? 0x38bdf8 : 0x0369a1)
        record.borderMat.opacity = isSelected ? 0.95 : 0.35
        record.borderMat.linewidth = isSelected ? 2 : 1
        record.borderMesh.visible = true
      })

      for (let i = slicesToRender.length; i < sliceRecordsRef.current.length; i++) {
        sliceRecordsRef.current[i].planeMesh.visible = false
        sliceRecordsRef.current[i].borderMesh.visible = false
      }
    } else {
      sliceRecordsRef.current.forEach((r) => {
        r.planeMesh.visible = false
        r.borderMesh.visible = false
      })
    }

    // 3. Render 3D Current Velocity Vectors (uo + vo) with Buffer Attribute Reuse
    if (isCurrents && modelState.showCurrentVectors && uDepthStack.length > 0 && vDepthStack.length > 0) {
      const turboLut = buildLut("turbo", 256)
      const density = modelState.vectorDensity || 60
      const step = Math.max(1, Math.round(7 - (density / 100) * 5))

      const indicesToRender = modelState.showDepthSlices
        ? uDepthStack.map((_, i) => i)
        : [
            uDepthStack.findIndex((u) => Math.abs((u.depth ?? 0) - resolvedDepth) < 1.0) !== -1
              ? uDepthStack.findIndex((u) => Math.abs((u.depth ?? 0) - resolvedDepth) < 1.0)
              : 0,
          ]

      const linePositions: number[] = []
      const lineColors: number[] = []

      indicesToRender.forEach((idx) => {
        const uSlice = uDepthStack[idx]
        const vSlice = vDepthStack[idx]
        if (!uSlice || !vSlice || !uSlice.values || !vSlice.values) return

        const depthMeters = uSlice.depth ?? 0
        const yPos = -Math.min(1.0, depthMeters / 1000) * maxZDepth

        const uVals = uSlice.values
        const vVals = vSlice.values
        const gridH = uVals.length
        const gridW = uVals[0]?.length || 0
        if (gridH === 0 || gridW === 0) return

        for (let r = 0; r < gridH; r += step) {
          const latIdx = gridH - 1 - r
          const uRow = uVals[latIdx]
          const vRow = vVals[latIdx]
          if (!uRow || !vRow) continue

          const zCoord = (r / gridH - 0.5) * planeH

          for (let c = 0; c < gridW; c += step) {
            const u = uRow[c]
            const v = vRow[c]
            if (u === null || v === null || isNaN(u) || isNaN(v)) continue

            const xCoord = (c / gridW - 0.5) * planeW
            const speed = Math.sqrt(u * u + v * v)
            if (speed < 0.01) continue

            const len = Math.max(0.22, Math.min(1.2, speed * 1.5))
            const angle = Math.atan2(-v, u)

            const dx = Math.cos(angle) * len
            const dz = Math.sin(angle) * len

            const tipX = xCoord + dx
            const tipZ = zCoord + dz

            const headSize = len * 0.28
            const fin1X = tipX + Math.cos(angle + 2.5) * headSize
            const fin1Z = tipZ + Math.sin(angle + 2.5) * headSize
            const fin2X = tipX + Math.cos(angle - 2.5) * headSize
            const fin2Z = tipZ + Math.sin(angle - 2.5) * headSize

            const t = Math.max(0, Math.min(1, speed / 1.0))
            const lutIdx = Math.min(255, Math.floor(t * 255))
            const cr = turboLut[lutIdx * 3] / 255
            const cg = turboLut[lutIdx * 3 + 1] / 255
            const cb = turboLut[lutIdx * 3 + 2] / 255

            // Main arrow shaft
            linePositions.push(xCoord, yPos, zCoord)
            linePositions.push(tipX, yPos, tipZ)
            lineColors.push(cr, cg, cb, cr, cg, cb)

            // Arrowhead fin 1
            linePositions.push(tipX, yPos, tipZ)
            linePositions.push(fin1X, yPos, fin1Z)
            lineColors.push(cr, cg, cb, cr, cg, cb)

            // Arrowhead fin 2
            linePositions.push(tipX, yPos, tipZ)
            linePositions.push(fin2X, yPos, fin2Z)
            lineColors.push(cr, cg, cb, cr, cg, cb)
          }
        }
      })

      if (linePositions.length > 0) {
        const numVerts = linePositions.length / 3
        if (currentsMeshRef.current) {
          const { geo, capacity } = currentsMeshRef.current
          if (capacity >= numVerts) {
            const posAttr = geo.attributes.position as THREE.BufferAttribute
            const colAttr = geo.attributes.color as THREE.BufferAttribute
            posAttr.copyArray(new Float32Array(linePositions))
            colAttr.copyArray(new Float32Array(lineColors))
            posAttr.needsUpdate = true
            colAttr.needsUpdate = true
            geo.setDrawRange(0, numVerts)
          } else {
            geo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3))
            geo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3))
            geo.setDrawRange(0, numVerts)
            currentsMeshRef.current.capacity = numVerts
          }
          currentsMeshRef.current.mesh.visible = true
        } else {
          const linesGeo = new THREE.BufferGeometry()
          linesGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3))
          linesGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3))
          const linesMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
          })
          const linesMesh = new THREE.LineSegments(linesGeo, linesMat)
          rootGroup.add(linesMesh)
          currentsMeshRef.current = {
            mesh: linesMesh,
            geo: linesGeo,
            mat: linesMat,
            capacity: numVerts,
          }
        }
      } else if (currentsMeshRef.current) {
        currentsMeshRef.current.mesh.visible = false
      }
    } else if (currentsMeshRef.current) {
      currentsMeshRef.current.mesh.visible = false
    }

    // 4. REAL 3D MARCHING CUBES ISOSURFACE EXTRACTION with Geometry Replacement
    if (modelState.showIsosurfaces) {
      let grid3D: (number | null | undefined)[][][] = []
      let depthLevels: number[] = []

      if (!isCurrents && depthStack.length >= 2) {
        grid3D = depthStack.map((s) => s.values)
        depthLevels = depthStack.map((s) => s.depth ?? 0)
      } else if (isCurrents && uDepthStack.length >= 2 && vDepthStack.length >= 2) {
        grid3D = uDepthStack.map((uSlice, dIdx) => {
          const vSlice = vDepthStack[dIdx]
          const uVals = uSlice.values || []
          const vVals = vSlice?.values || []
          return uVals.map((uRow, rIdx) => {
            const vRow = vVals[rIdx] || []
            return uRow.map((uVal, cIdx) => {
              const vVal = vRow[cIdx]
              if (uVal === null || vVal === null || uVal === undefined || vVal === undefined || isNaN(uVal) || isNaN(vVal)) {
                return null
              }
              return Math.sqrt(uVal * uVal + vVal * vVal)
            })
          })
        })
        depthLevels = uDepthStack.map((s) => s.depth ?? 0)
      }

      if (grid3D.length >= 2) {
        const isoGeo = extractIsosurface(
          grid3D,
          depthLevels,
          activeIsovalue,
          planeW,
          planeH,
          maxZDepth
        )

        if (isoGeo) {
          let col = 0x38bdf8
          if (modelState.variable === "temperature") {
            const t = Math.max(0, Math.min(1, (activeIsovalue - 15) / 17))
            const idx = Math.min(255, Math.floor(t * 255))
            col = (lut[idx * 3] << 16) | (lut[idx * 3 + 1] << 8) | lut[idx * 3 + 2]
          } else if (modelState.variable === "salinity") {
            const t = Math.max(0, Math.min(1, (activeIsovalue - 33.0) / 3.5))
            const idx = Math.min(255, Math.floor(t * 255))
            col = (lut[idx * 3] << 16) | (lut[idx * 3 + 1] << 8) | lut[idx * 3 + 2]
          } else if (modelState.variable === "chlorophyll") {
            const t = Math.max(0, Math.min(1, (activeIsovalue - 0.02) / 1.98))
            const idx = Math.min(255, Math.floor(t * 255))
            col = (lut[idx * 3] << 16) | (lut[idx * 3 + 1] << 8) | lut[idx * 3 + 2]
          } else if (isCurrents) {
            const t = Math.max(0, Math.min(1, activeIsovalue / 1.0))
            const idx = Math.min(255, Math.floor(t * 255))
            col = (lut[idx * 3] << 16) | (lut[idx * 3 + 1] << 8) | lut[idx * 3 + 2]
          }

          if (isoMeshRef.current) {
            const oldGeo = isoMeshRef.current.mesh.geometry
            isoMeshRef.current.mesh.geometry = isoGeo
            isoMeshRef.current.wireMesh.geometry = isoGeo
            isoMeshRef.current.mat.color.setHex(col)
            isoMeshRef.current.mesh.visible = true
            isoMeshRef.current.wireMesh.visible = true
            if (oldGeo) oldGeo.dispose()
          } else {
            const isoMat = new THREE.MeshStandardMaterial({
              color: col,
              roughness: 0.35,
              metalness: 0.15,
              transparent: true,
              opacity: 0.84,
              side: THREE.DoubleSide,
              depthWrite: true,
            })
            const wireMat = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              wireframe: true,
              transparent: true,
              opacity: 0.18,
            })
            const isoMesh = new THREE.Mesh(isoGeo, isoMat)
            const wireMesh = new THREE.Mesh(isoGeo, wireMat)
            rootGroup.add(isoMesh)
            rootGroup.add(wireMesh)
            isoMeshRef.current = { mesh: isoMesh, wireMesh, mat: isoMat, wireMat }
          }
        } else if (isoMeshRef.current) {
          isoMeshRef.current.mesh.visible = false
          isoMeshRef.current.wireMesh.visible = false
        }
      } else if (isoMeshRef.current) {
        isoMeshRef.current.mesh.visible = false
        isoMeshRef.current.wireMesh.visible = false
      }
    } else if (isoMeshRef.current) {
      isoMeshRef.current.mesh.visible = false
      isoMeshRef.current.wireMesh.visible = false
    }

    // 5. TRUE 3D VOLUMETRIC RAY-MARCHING RENDERING with Texture / Shader Reuse
    if (modelState.show3DVolume) {
      let stackForVolume: ModelFieldResponse[] = []
      if (!isCurrents && depthStack.length >= 2) {
        stackForVolume = depthStack
      } else if (isCurrents && uDepthStack.length >= 2 && vDepthStack.length >= 2) {
        stackForVolume = uDepthStack.map((uSlice, dIdx) => {
          const vSlice = vDepthStack[dIdx]
          const uVals = uSlice.values || []
          const vVals = vSlice?.values || []
          let sliceMin = Infinity
          let sliceMax = -Infinity
          const speedVals = uVals.map((uRow, rIdx) => {
            const vRow = vVals[rIdx] || []
            return uRow.map((uVal, cIdx) => {
              const vVal = vRow[cIdx]
              if (uVal === null || vVal === null || uVal === undefined || vVal === undefined || isNaN(uVal) || isNaN(vVal)) {
                return null
              }
              const speed = Math.sqrt(uVal * uVal + vVal * vVal)
              if (speed < sliceMin) sliceMin = speed
              if (speed > sliceMax) sliceMax = speed
              return speed
            })
          })
          return {
            ...uSlice,
            values: speedVals,
            min_value: isFinite(sliceMin) ? sliceMin : 0.0,
            max_value: isFinite(sliceMax) ? sliceMax : 1.0,
            unit: "m/s",
          }
        })
      }

      if (stackForVolume.length >= 2) {
        const vol = createVolumeMesh(
          stackForVolume,
          palette,
          planeW,
          planeH,
          maxZDepth,
          volumeHandleRef.current
        )
        if (vol) {
          volumeHandleRef.current = vol
          if (vol.mesh.parent !== rootGroup) {
            rootGroup.add(vol.mesh)
          }
          vol.mesh.visible = true
          if (cameraRef.current) {
            vol.updateCameraPos(cameraRef.current.position)
          }
        }
      } else if (volumeHandleRef.current) {
        volumeHandleRef.current.mesh.visible = false
      }
    } else if (volumeHandleRef.current) {
      volumeHandleRef.current.mesh.visible = false
    }

    // 6. In-Situ Observation Markers with InstancedMesh, Camera-Aware Dynamic LOD & Spatial Clustering
    const updateObservationLOD = (camDist?: number) => {
      const dist = camDist !== undefined ? camDist : controlsRef.current.distance
      const totalObs = validObservations.length

      if (!sharedObsGeoRef.current) {
        sharedObsGeoRef.current = new THREE.SphereGeometry(0.24, 12, 12)
        obsMaterialsRef.current = {
          argo: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
          glider: new THREE.MeshBasicMaterial({ color: 0x06b6d4 }),
          ctd: new THREE.MeshBasicMaterial({ color: 0xf97316 }),
          bgc: new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
        }
      }

      if (!sharedClusterGeoRef.current) {
        sharedClusterGeoRef.current = new THREE.SphereGeometry(0.38, 14, 14)
        clusterMaterialRef.current = new THREE.MeshStandardMaterial({
          color: 0x6366f1,
          roughness: 0.3,
          metalness: 0.2,
          emissive: 0x312e81,
          emissiveIntensity: 0.45,
        })
      }

      // Compute LOD level and partition into singles and clusters
      let lodLevel = 2
      let singles: { obs: ObservationItem; x: number; y: number; z: number }[] = []
      let clusters: ObservationCluster[] = []

      if (totalObs === 0) {
        lodLevel = 2
      } else if (totalObs <= 80 || dist <= 15) {
        // LOD 2: Close-up / Detailed view - 100% individual markers rendered!
        lodLevel = 2
        singles = validObservations.map((obs) => {
          const xRel = (obs.longitude - bounds.lonMin) / lonSpan - 0.5
          const zRel = (bounds.latMax - obs.latitude) / latSpan - 0.5
          return {
            obs,
            x: xRel * planeW,
            y: 0.08,
            z: zRel * planeH,
          }
        })
      } else {
        // LOD 0 (dist > 24) or LOD 1 (15 < dist <= 24)
        const isCoarse = dist > 24
        lodLevel = isCoarse ? 0 : 1
        const gridCols = isCoarse ? 12 : 24
        const gridRows = isCoarse ? 12 : 24

        const bins = new Map<string, ObservationItem[]>()
        for (let i = 0; i < validObservations.length; i++) {
          const obs = validObservations[i]
          const u = Math.max(0, Math.min(1, (obs.longitude - bounds.lonMin) / lonSpan))
          const v = Math.max(0, Math.min(1, (bounds.latMax - obs.latitude) / latSpan))
          const c = Math.min(gridCols - 1, Math.floor(u * gridCols))
          const r = Math.min(gridRows - 1, Math.floor(v * gridRows))
          const key = `${c}_${r}`

          let b = bins.get(key)
          if (!b) {
            b = []
            bins.set(key, b)
          }
          b.push(obs)
        }

        for (const [key, items] of bins.entries()) {
          if (items.length === 1) {
            const obs = items[0]
            const xRel = (obs.longitude - bounds.lonMin) / lonSpan - 0.5
            const zRel = (bounds.latMax - obs.latitude) / latSpan - 0.5
            singles.push({
              obs,
              x: xRel * planeW,
              y: 0.08,
              z: zRel * planeH,
            })
          } else {
            let sumLat = 0
            let sumLon = 0
            let sumX = 0
            let sumZ = 0
            const countsByType = { argo: 0, glider: 0, ctd: 0, bgc: 0 }

            for (const obs of items) {
              sumLat += obs.latitude
              sumLon += obs.longitude
              const xRel = (obs.longitude - bounds.lonMin) / lonSpan - 0.5
              const zRel = (bounds.latMax - obs.latitude) / latSpan - 0.5
              sumX += xRel * planeW
              sumZ += zRel * planeH
              if (countsByType[obs.type as keyof typeof countsByType] !== undefined) {
                countsByType[obs.type as keyof typeof countsByType]++
              }
            }

            const count = items.length
            clusters.push({
              id: `cluster_${key}`,
              centroidX: sumX / count,
              centroidY: 0.14,
              centroidZ: sumZ / count,
              lat: sumLat / count,
              lon: sumLon / count,
              count,
              countsByType,
              items,
            })
          }
        }
      }

      setActiveLod(lodLevel)
      setRenderedMarkerCount(singles.length + clusters.length)

      // 1. Update 4 Type InstancedMeshes (argo, glider, ctd, bgc)
      const byType: Record<string, typeof singles> = { argo: [], glider: [], ctd: [], bgc: [] }
      for (const s of singles) {
        const t = s.obs.type in byType ? s.obs.type : "argo"
        byType[t].push(s)
      }

      for (const type of ["argo", "glider", "ctd", "bgc"] as const) {
        const items = byType[type]
        let mesh = obsInstancedMeshesRef.current[type]
        const neededCap = Math.max(32, items.length + 16)

        if (!mesh || mesh.geometry !== sharedObsGeoRef.current || mesh.instanceMatrix.count < items.length) {
          if (mesh) {
            rootGroup.remove(mesh)
            mesh.dispose()
          }
          const mat = obsMaterialsRef.current?.[type] || obsMaterialsRef.current!.argo
          mesh = new THREE.InstancedMesh(sharedObsGeoRef.current!, mat, neededCap)
          mesh.name = type
          mesh.userData = { type }
          rootGroup.add(mesh)
          obsInstancedMeshesRef.current[type] = mesh
        }

        obsInstanceMapRef.current[type] = items.map((s) => s.obs)

        for (let i = 0; i < items.length; i++) {
          _tempPos.set(items[i].x, items[i].y, items[i].z)
          _tempScale.set(1, 1, 1)
          _tempMatrix.compose(_tempPos, _tempQuat, _tempScale)
          mesh.setMatrixAt(i, _tempMatrix)
        }
        mesh.count = items.length
        mesh.instanceMatrix.needsUpdate = true
        mesh.visible = items.length > 0
      }

      // 2. Update Cluster InstancedMesh
      let clusterMesh = clusterInstancedMeshRef.current
      const neededClusterCap = Math.max(16, clusters.length + 16)

      if (!clusterMesh || clusterMesh.geometry !== sharedClusterGeoRef.current || clusterMesh.instanceMatrix.count < clusters.length) {
        if (clusterMesh) {
          rootGroup.remove(clusterMesh)
          clusterMesh.dispose()
        }
        clusterMesh = new THREE.InstancedMesh(sharedClusterGeoRef.current!, clusterMaterialRef.current!, neededClusterCap)
        clusterMesh.name = "cluster"
        rootGroup.add(clusterMesh)
        clusterInstancedMeshRef.current = clusterMesh
      }

      clusterMapRef.current = clusters

      for (let i = 0; i < clusters.length; i++) {
        _tempPos.set(clusters[i].centroidX, clusters[i].centroidY, clusters[i].centroidZ)
        const scaleVal = Math.min(1.6, 1.0 + Math.log2(clusters[i].count) * 0.1)
        _tempScale.set(scaleVal, scaleVal, scaleVal)
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale)
        clusterMesh.setMatrixAt(i, _tempMatrix)
      }
      clusterMesh.count = clusters.length
      clusterMesh.instanceMatrix.needsUpdate = true
      clusterMesh.visible = clusters.length > 0

      // 3. Update Selected Observation Highlight Ring
      if (!selectedHighlightMeshRef.current) {
        const ringGeo = new THREE.RingGeometry(0.32, 0.44, 32)
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
        const ringMesh = new THREE.Mesh(ringGeo, ringMat)
        ringMesh.rotation.x = -Math.PI / 2
        rootGroup.add(ringMesh)
        selectedHighlightMeshRef.current = ringMesh
      }

      if (selectedObsId) {
        const selObs = validObservations.find((o) => o.id === selectedObsId)
        if (selObs) {
          const xRel = (selObs.longitude - bounds.lonMin) / lonSpan - 0.5
          const zRel = (bounds.latMax - selObs.latitude) / latSpan - 0.5
          selectedHighlightMeshRef.current.position.set(xRel * planeW, 0.15, zRel * planeH)
          selectedHighlightMeshRef.current.visible = true
        } else {
          selectedHighlightMeshRef.current.visible = false
        }
      } else {
        selectedHighlightMeshRef.current.visible = false
      }
    }

    updateObservationLODRef.current = updateObservationLOD
    updateObservationLOD()
  }, [
    depthStack,
    uDepthStack,
    vDepthStack,
    isCurrents,
    palette,
    resolvedDepth,
    modelState.showDepthSlices,
    modelState.show3DVolume,
    modelState.showIsosurfaces,
    modelState.showCurrentVectors,
    activeIsovalue,
    modelState.vectorDensity,
    verticalExaggeration,
    validObservations,
    selectedObsId,
    bounds,
    latSpan,
    lonSpan,
  ])

  // Mouse / Pointer Event Handling for 3D Navigation vs Instrument Selection
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    if (isNavActive) {
      notifyInteraction()
      if (e.button === 2) {
        controlsRef.current.isRightDragging = true
      } else {
        controlsRef.current.isDragging = true
      }
      controlsRef.current.prevX = e.clientX
      controlsRef.current.prevY = e.clientY
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = mountRef.current
    const camera = cameraRef.current
    if (!container || !camera) return

    // 1. Check Raycasting against observation markers & clusters for hover tooltip (in selection mode)
    if (!isNavActive) {
      const rect = container.getBoundingClientRect()
      const xNdc = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const yNdc = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      mouseVecRef.current.set(xNdc, yNdc)
      raycasterRef.current.setFromCamera(mouseVecRef.current, camera)

      const targets: THREE.InstancedMesh[] = []
      if (clusterInstancedMeshRef.current && clusterInstancedMeshRef.current.count > 0 && clusterInstancedMeshRef.current.visible) {
        targets.push(clusterInstancedMeshRef.current)
      }
      for (const m of Object.values(obsInstancedMeshesRef.current)) {
        if (m.count > 0 && m.visible) targets.push(m)
      }

      const intersects = raycasterRef.current.intersectObjects(targets)

      if (intersects.length > 0) {
        const hit = intersects[0]
        const hitMesh = hit.object as THREE.InstancedMesh
        const instanceId = hit.instanceId

        if (instanceId !== undefined) {
          if (hitMesh === clusterInstancedMeshRef.current) {
            const cluster = clusterMapRef.current[instanceId]
            if (cluster) {
              setHoveredCluster(cluster)
              setHoveredObs(null)
              setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
            }
          } else {
            const type = (hitMesh.userData?.type || hitMesh.name) as string
            const obs = obsInstanceMapRef.current[type]?.[instanceId]
            if (obs) {
              setHoveredObs(obs)
              setHoveredCluster(null)
              setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
            }
          }
        }
      } else {
        setHoveredObs(null)
        setHoveredCluster(null)
        setTooltipPos(null)
      }
    } else {
      setHoveredObs(null)
      setHoveredCluster(null)
      setTooltipPos(null)
    }

    // 2. Camera Orbit / Pan Navigation (in Hand navigation mode)
    if (isNavActive) {
      const { isDragging, isRightDragging, prevX, prevY } = controlsRef.current
      if (!isDragging && !isRightDragging) return

      notifyInteraction()
      const dx = e.clientX - prevX
      const dy = e.clientY - prevY
      controlsRef.current.prevX = e.clientX
      controlsRef.current.prevY = e.clientY

      if (isDragging) {
        controlsRef.current.rotY += dx * 0.008
        controlsRef.current.rotX = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, controlsRef.current.rotX + dy * 0.008))
      } else if (isRightDragging) {
        controlsRef.current.panX -= dx * 0.02
        controlsRef.current.panY += dy * 0.02
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (controlsRef.current.isDragging || controlsRef.current.isRightDragging) {
      if (volumeHandleRef.current) {
        volumeHandleRef.current.setInteractive(false)
      }
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
    }
    controlsRef.current.isDragging = false
    controlsRef.current.isRightDragging = false

    const down = pointerDownRef.current
    const distMoved = Math.hypot(e.clientX - down.x, e.clientY - down.y)

    // In Marker Selection mode (when hand tool is deselected)
    if (!isNavActive && distMoved < 6) {
      const container = mountRef.current
      const camera = cameraRef.current
      if (!container || !camera) return

      const rect = container.getBoundingClientRect()
      const xNdc = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const yNdc = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      mouseVecRef.current.set(xNdc, yNdc)
      raycasterRef.current.setFromCamera(mouseVecRef.current, camera)

      const targets: THREE.InstancedMesh[] = []
      if (clusterInstancedMeshRef.current && clusterInstancedMeshRef.current.count > 0 && clusterInstancedMeshRef.current.visible) {
        targets.push(clusterInstancedMeshRef.current)
      }
      for (const m of Object.values(obsInstancedMeshesRef.current)) {
        if (m.count > 0 && m.visible) targets.push(m)
      }

      const intersects = raycasterRef.current.intersectObjects(targets)

      if (intersects.length > 0) {
        const hit = intersects[0]
        const hitMesh = hit.object as THREE.InstancedMesh
        const instanceId = hit.instanceId

        if (instanceId !== undefined) {
          if (hitMesh === clusterInstancedMeshRef.current) {
            const cluster = clusterMapRef.current[instanceId]
            if (cluster) {
              // Zoom camera smoothly into cluster centroid and expand to LOD 2 (all individual markers)
              controlsRef.current.panX = cluster.centroidX
              controlsRef.current.panY = cluster.centroidZ * 0.4
              controlsRef.current.distance = 12 // Detailed LOD 2 view
              updateObservationLODRef.current(12)
              setHoveredCluster(null)
              setTooltipPos(null)
            }
          } else {
            const type = (hitMesh.userData?.type || hitMesh.name) as string
            const obs = obsInstanceMapRef.current[type]?.[instanceId]
            if (obs) {
              onSelectObservation?.(obs)
            }
          }
        }
      }
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (isNavActive) {
      notifyInteraction()
      controlsRef.current.distance = Math.max(8, Math.min(50, controlsRef.current.distance + e.deltaY * 0.03))
      updateObservationLODRef.current(controlsRef.current.distance)
    }
  }

  const setCameraPreset = (preset: "3d" | "top" | "side") => {
    notifyInteraction()
    setViewMode(preset)
    if (preset === "3d") {
      controlsRef.current.rotX = 0.55
      controlsRef.current.rotY = -0.65
      controlsRef.current.distance = 24
      controlsRef.current.panX = 0
      controlsRef.current.panY = 0
    } else if (preset === "top") {
      controlsRef.current.rotX = Math.PI / 2 - 0.02
      controlsRef.current.rotY = 0
      controlsRef.current.distance = 20
      controlsRef.current.panX = 0
      controlsRef.current.panY = 0
    } else if (preset === "side") {
      controlsRef.current.rotX = 0.1
      controlsRef.current.rotY = -Math.PI / 2
      controlsRef.current.distance = 22
      controlsRef.current.panX = 0
      controlsRef.current.panY = -2
    }
    updateObservationLODRef.current(controlsRef.current.distance)
  }

  const activeLabel =
    modelState.variable === "salinity"
      ? "Salinity"
      : modelState.variable === "chlorophyll"
      ? "Chlorophyll"
      : modelState.variable === "currents"
      ? "Current Speed"
      : "Temperature"

  const activeUnit = isCurrents ? "m/s" : primarySlice?.unit || ""

  return (
    <div
      className="relative w-full h-full min-h-[480px] flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-3.5 select-none"
    >
      {/* ─── Top Header: Selected Region & Synchronized Model Coordinates ─── */}
      <div className="relative z-20 flex flex-col gap-1 pb-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-sky-500 shadow-xs flex items-center justify-center text-[10px] text-white">
              🌐
            </div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 tracking-tight">
              Selected Region — 3D Depth-Resolved View
            </h2>
          </div>

          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {modelState.show3DVolume
              ? "3D VOLUMETRIC RAY MARCHING"
              : modelState.showIsosurfaces
              ? `ISOSURFACE (${activeIsovalue.toFixed(modelState.variable === "chlorophyll" ? 2 : 1)} ${activeUnit})`
              : modelState.showDepthSlices
              ? "3D DEPTH SLICES"
              : "SINGLE DEPTH SLICE"}{" "}
            - {verticalExaggeration}x VE
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 flex-wrap">
          <span>Lat: {formatCoord(bounds.latMin, true)} → {formatCoord(bounds.latMax, true)}</span>
          <span className="text-slate-300">|</span>
          <span>Lon: {formatCoord(bounds.lonMin, false)} → {formatCoord(bounds.lonMax, false)}</span>
          <span className="text-slate-300">|</span>
          <span>
            Selected Depth: <strong className="text-slate-800 font-semibold">{modelState.depth} m</strong> (Resolved: {resolvedDepth.toFixed(0)} m)
          </span>
        </div>

        {/* Centered Large Date */}
        <div className="text-center font-bold text-slate-800 text-sm md:text-base tracking-wide pt-0.5">
          {getDateStr(modelState.timeStepIndex)}
        </div>
      </div>

      {/* ─── Center: 3D Depth-Resolved WebGL Viewport ─── */}
      <div
        className={`relative flex-1 w-full h-full min-h-[320px] my-1 rounded-xl border border-slate-100 bg-white flex items-center justify-center overflow-hidden ${
          isNavActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* WebGL Canvas Mount */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-auto" />

        {/* Loading Indicator */}
        {modelLoading && (
          <div className="absolute top-4 left-14 z-30 px-3 py-1.5 rounded-lg bg-white/95 border border-sky-300 text-sky-700 text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md">
            <LoadingSpinner size="sm" color="#0284c7" label={`Loading 3D CMEMS ${modelState.variable} depth planes`} />
            <span>Loading 3D CMEMS {modelState.variable} depth planes…</span>
          </div>
        )}

        {/* Error Indicator */}
        {modelError && (
          <div className="absolute top-4 left-14 z-30 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 text-[11px] font-mono font-bold shadow-lg">
            {modelError}
          </div>
        )}

        {/* Tiny Hand Navigation Tool (Top-Left) */}
        <div className="absolute top-3 left-3 z-30">
          <button
            type="button"
            onClick={() => setIsNavActive((prev) => !prev)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border shadow-xs backdrop-blur-md ${
              isNavActive
                ? "bg-[#0284c7] border-sky-400 text-white shadow-sky-500/30"
                : "bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
            title={
              isNavActive
                ? "Hand Tool Active (Drag to Orbit/Pan, Scroll to Zoom). Click to switch to Marker Selection."
                : "Marker Selection Mode (Click markers to inspect profiles). Click to enable 3D Orbit/Zoom."
            }
          >
            ✋
          </button>
        </div>

        {/* Maximize / Minimize Fullpage Toggle Button (Bottom-Left) */}
        <div className="absolute bottom-3 left-3 z-30">
          <button
            type="button"
            onClick={toggleMaximize}
            className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm backdrop-blur-sm transition active:scale-95 cursor-pointer"
            title={isMaximized ? "Minimize to original space" : "Maximize 3D model to full page"}
          >
            <span className="text-[#0284c7] text-xs font-bold">{isMaximized ? "🗗" : "⛶"}</span>
            <span>{isMaximized ? "Minimize" : "Maximize"}</span>
          </button>
        </div>

        {/* Camera Perspective Switcher Buttons (Bottom-Right) */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-xl p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setCameraPreset("3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === "3d" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            3D Oblique
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset("top")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === "top" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Top Surface
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset("side")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === "side" ? "bg-[#0284c7] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Side Profile
          </button>
        </div>

        {/* Synchronized Vertical Depth Reference Axis (Left side of 3D Scene) */}
        <div className="absolute top-12 left-3 z-20 pointer-events-none flex flex-col justify-between h-64 border-l border-slate-300 pl-2 font-mono text-[10px] text-slate-500">
          {[0, 200, 400, 800, 1200, 1600, 2000].map((depthTick) => {
            const nearestTick = [0, 200, 400, 800, 1200, 1600, 2000].reduce((prev, curr) =>
              Math.abs(curr - modelState.depth) < Math.abs(prev - modelState.depth) ? curr : prev
            )
            const isSelected = depthTick === nearestTick
            return (
              <div
                key={depthTick}
                className={`flex items-center gap-1.5 transition-colors ${
                  isSelected ? "text-emerald-600 font-bold" : "text-slate-400"
                }`}
              >
                <span className={`h-0.5 ${isSelected ? "w-3 bg-emerald-500 shadow-xs" : "w-1.5 bg-slate-300"}`} />
                <span>
                  {depthTick} m {isSelected ? "(Selected)" : ""}
                </span>
              </div>
            )
          })}
        </div>

        {/* Dynamic Floating Colorbar Scale (Top-Right inside map) */}
        {primarySlice || (isCurrents && uDepthStack.length > 0) ? (
          <div className="absolute top-3 right-3 z-20 bg-white/95 border border-slate-200/90 rounded-xl p-2.5 shadow-md flex flex-col gap-1 w-48 backdrop-blur-md">
            <div className="text-[11px] font-bold text-slate-800 text-center">
              {activeLabel} {activeUnit && `(${activeUnit})`}
            </div>
            <div
              className="w-full h-2.5 rounded-sm shadow-inner border border-slate-200"
              style={{ background: gradient }}
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 font-medium">
              <span>{isCurrents ? "0.0" : primarySlice?.min_value?.toFixed(1)}</span>
              <span>
                {isCurrents
                  ? "0.5"
                  : ((primarySlice?.min_value! + primarySlice?.max_value!) / 2).toFixed(1)}
              </span>
              <span>
                {isCurrents ? "1.0 m/s" : `${primarySlice?.max_value?.toFixed(1)}`}
              </span>
            </div>
          </div>
        ) : null}

        {/* Live Observation Marker Tooltip */}
        {hoveredObs && tooltipPos && (
          <div
            style={{
              left: `${Math.min(window.innerWidth - 220, tooltipPos.x + 12)}px`,
              top: `${Math.max(10, tooltipPos.y - 45)}px`,
            }}
            className="absolute z-50 pointer-events-none bg-white/95 border border-slate-200 rounded-xl px-3 py-2 shadow-2xl text-[10px] font-mono backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
              <span className="uppercase text-[#0284c7]">{hoveredObs.type}</span>
              <span>#{hoveredObs.platform_id || hoveredObs.id}</span>
            </div>
            <div className="text-slate-600">
              {formatCoord(hoveredObs.latitude, true)}, {formatCoord(hoveredObs.longitude, false)}
            </div>
            <div className="text-emerald-600 text-[9px] font-semibold mt-0.5">
              Click to inspect vertical profile graph
            </div>
          </div>
        )}

        {/* Live Observation Cluster Tooltip */}
        {hoveredCluster && tooltipPos && (
          <div
            style={{
              left: `${Math.min(window.innerWidth - 240, tooltipPos.x + 12)}px`,
              top: `${Math.max(10, tooltipPos.y - 50)}px`,
            }}
            className="absolute z-50 pointer-events-none bg-white/95 border border-slate-200 rounded-xl px-3 py-2 shadow-2xl text-[10px] font-mono backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
              <span className="uppercase text-indigo-600">OBSERVATION CLUSTER</span>
              <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 text-[9px]">
                {hoveredCluster.count} profiles
              </span>
            </div>
            <div className="text-slate-600 text-[9px] mt-0.5">
              {Object.entries(hoveredCluster.countsByType)
                .filter(([_, c]) => c > 0)
                .map(([t, c]) => `${t.toUpperCase()}: ${c}`)
                .join(" · ")}
            </div>
            <div className="text-indigo-600 text-[9px] font-semibold mt-0.5">
              Click to zoom into cluster ({formatCoord(hoveredCluster.lat, true)}, {formatCoord(hoveredCluster.lon, false)})
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
