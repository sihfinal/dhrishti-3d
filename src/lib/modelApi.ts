"use client"

export interface ModelFieldResponse {
  variable: string
  time: string
  depth: number
  lat_min: number
  lat_max: number
  lon_min: number
  lon_max: number
  width: number
  height: number
  latitudes: number[]
  longitudes: number[]
  values: (number | null)[][]
  min_value: number | null
  max_value: number | null
  unit: string
}

import { API_BASE } from "./apiBase"

// In-memory LRU cache to prevent redundant requests
const fieldCache = new Map<string, ModelFieldResponse>()
const MAX_CACHE_SIZE = 40

/**
 * Decodes a Sagar Netra 3D (SD3D) binary envelope containing a 16-byte fixed header,
 * UTF-8 JSON metadata, and contiguous Little-Endian Float32 values.
 */
function decodeBinaryEnvelope(arrayBuffer: ArrayBuffer): {
  formatType: number
  metadata: any
  floatArray: Float32Array
} {
  const dataView = new DataView(arrayBuffer)
  // Check magic "SD3D" (0x53, 0x44, 0x33, 0x44)
  const m0 = dataView.getUint8(0)
  const m1 = dataView.getUint8(1)
  const m2 = dataView.getUint8(2)
  const m3 = dataView.getUint8(3)
  if (m0 !== 0x53 || m1 !== 0x44 || m2 !== 0x33 || m3 !== 0x44) {
    throw new Error("Invalid SD3D binary format magic header")
  }
  const version = dataView.getUint16(4, true)
  if (version !== 1) {
    throw new Error(`Unsupported SD3D binary format version: ${version}`)
  }
  const formatType = dataView.getUint16(6, true)
  const metaLen = dataView.getUint32(8, true)
  const dataLen = dataView.getUint32(12, true)

  const metaBytes = new Uint8Array(arrayBuffer, 16, metaLen)
  const metaJson = new TextDecoder("utf-8").decode(metaBytes)
  const metadata = JSON.parse(metaJson)

  const padLen = (4 - ((16 + metaLen) % 4)) % 4
  const dataOffset = 16 + metaLen + padLen
  const floatCount = dataLen / 4
  const floatArray = new Float32Array(arrayBuffer, dataOffset, floatCount)

  return { formatType, metadata, floatArray }
}

/**
 * Reconstructs a 2D row/column grid (values: (number | null)[][]) from a contiguous Float32Array slice.
 */
function reconstruct2DValues(
  floatArray: Float32Array,
  startOffset: number,
  width: number,
  height: number
): (number | null)[][] {
  const grid: (number | null)[][] = new Array(height)
  for (let r = 0; r < height; r++) {
    const row: (number | null)[] = new Array(width)
    const rowOffset = startOffset + r * width
    for (let c = 0; c < width; c++) {
      const v = floatArray[rowOffset + c]
      row[c] = Number.isNaN(v) ? null : v
    }
    grid[r] = row
  }
  return grid
}

export async function fetchModelField(params: {
  variable: string
  time?: string
  depth?: number
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  stride?: number
}): Promise<ModelFieldResponse> {
  const variable = params.variable || "temperature"
  const time = params.time || "2026-02-15"
  const depth = params.depth !== undefined ? params.depth : 75.0
  const stride = params.stride || 4
  const lat_min = params.lat_min ?? -35.0
  const lat_max = params.lat_max ?? 30.0
  const lon_min = params.lon_min ?? 40.0
  const lon_max = params.lon_max ?? 100.0

  const cacheKey = `${variable}_${time}_${depth}_${stride}_${lat_min}_${lat_max}_${lon_min}_${lon_max}`
  if (fieldCache.has(cacheKey)) {
    return fieldCache.get(cacheKey)!
  }

  const query = new URLSearchParams({
    variable,
    time,
    depth: depth.toString(),
    stride: stride.toString(),
    lat_min: lat_min.toString(),
    lat_max: lat_max.toString(),
    lon_min: lon_min.toString(),
    lon_max: lon_max.toString(),
  })

  const res = await fetch(`${API_BASE}/model/field?${query.toString()}`, {
    method: "GET",
    headers: { Accept: "application/octet-stream, application/json;q=0.9" },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch model field (${variable}): HTTP ${res.status}`)
  }

  let data: ModelFieldResponse
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/octet-stream")) {
    const buf = await res.arrayBuffer()
    const { metadata, floatArray } = decodeBinaryEnvelope(buf)
    data = {
      variable: metadata.variable,
      time: metadata.time,
      depth: metadata.depth,
      lat_min: metadata.lat_min,
      lat_max: metadata.lat_max,
      lon_min: metadata.lon_min,
      lon_max: metadata.lon_max,
      width: metadata.width,
      height: metadata.height,
      latitudes: metadata.latitudes,
      longitudes: metadata.longitudes,
      values: reconstruct2DValues(floatArray, 0, metadata.width, metadata.height),
      min_value: metadata.min_value,
      max_value: metadata.max_value,
      unit: metadata.unit || "",
    }
  } else {
    data = await res.json()
  }

  // Evict oldest if full
  if (fieldCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = fieldCache.keys().next().value
    if (oldestKey) fieldCache.delete(oldestKey)
  }
  fieldCache.set(cacheKey, data)

  return data
}

export interface ModelFieldSlice {
  depth: number
  requested_depth: number
  actual_depth: number
  values: (number | null)[][]
  min_value: number | null
  max_value: number | null
}

export interface ModelFieldStackResponse {
  variable: string
  time: string
  depths: number[]
  requested_depths: number[]
  lat_min: number
  lat_max: number
  lon_min: number
  lon_max: number
  width: number
  height: number
  latitudes: number[]
  longitudes: number[]
  unit: string
  slices: ModelFieldSlice[]
  u_slices?: ModelFieldSlice[]
  v_slices?: ModelFieldSlice[]
}

/**
 * Step 4 Batch optimization & Step 10 Binary Streaming:
 * Fetch all requested depth slices in a single optimized HTTP request using SD3D binary Float32 streaming.
 * For 'currents', returns both uo and vo components for the entire depth stack.
 */
export async function fetchModelFieldStack(params: {
  variable: string
  time?: string
  depths?: number[]
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  stride?: number
}): Promise<{
  slices: ModelFieldResponse[]
  uSlices?: ModelFieldResponse[]
  vSlices?: ModelFieldResponse[]
}> {
  const variable = params.variable || "temperature"
  const time = params.time || "2026-02-15"
  const depths = params.depths || [0, 25, 50, 100, 250, 500, 1000]
  const stride = params.stride || 2
  const lat_min = params.lat_min ?? -35.0
  const lat_max = params.lat_max ?? 30.0
  const lon_min = params.lon_min ?? 40.0
  const lon_max = params.lon_max ?? 100.0

  const query = new URLSearchParams({
    variable,
    time,
    depths: depths.join(","),
    stride: stride.toString(),
    lat_min: lat_min.toString(),
    lat_max: lat_max.toString(),
    lon_min: lon_min.toString(),
    lon_max: lon_max.toString(),
  })

  const res = await fetch(`${API_BASE}/model/field-stack?${query.toString()}`, {
    method: "GET",
    headers: { Accept: "application/octet-stream, application/json;q=0.9" },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch model field stack (${variable}): HTTP ${res.status}`)
  }

  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/octet-stream")) {
    const buf = await res.arrayBuffer()
    const { formatType, metadata, floatArray } = decodeBinaryEnvelope(buf)
    const w = metadata.width
    const h = metadata.height
    const sliceElements = w * h

    if (formatType === 3) {
      // Currents (U and V stacks)
      const uSlicesMeta = metadata.u_slices || []
      const vSlicesMeta = metadata.v_slices || []
      const numDepths = uSlicesMeta.length

      const uSlices: ModelFieldResponse[] = uSlicesMeta.map((s: any, dIdx: number) => ({
        variable: "u_velocity",
        time: metadata.time,
        depth: s.actual_depth,
        lat_min: metadata.lat_min,
        lat_max: metadata.lat_max,
        lon_min: metadata.lon_min,
        lon_max: metadata.lon_max,
        width: w,
        height: h,
        latitudes: metadata.latitudes,
        longitudes: metadata.longitudes,
        values: reconstruct2DValues(floatArray, dIdx * sliceElements, w, h),
        min_value: s.min_value,
        max_value: s.max_value,
        unit: "m/s",
      }))

      const vBaseOffset = numDepths * sliceElements
      const vSlices: ModelFieldResponse[] = vSlicesMeta.map((s: any, dIdx: number) => ({
        variable: "v_velocity",
        time: metadata.time,
        depth: s.actual_depth,
        lat_min: metadata.lat_min,
        lat_max: metadata.lat_max,
        lon_min: metadata.lon_min,
        lon_max: metadata.lon_max,
        width: w,
        height: h,
        latitudes: metadata.latitudes,
        longitudes: metadata.longitudes,
        values: reconstruct2DValues(floatArray, vBaseOffset + dIdx * sliceElements, w, h),
        min_value: s.min_value,
        max_value: s.max_value,
        unit: "m/s",
      }))

      return { slices: [], uSlices, vSlices }
    } else {
      // Scalar stack (temperature, salinity, chlorophyll, etc.)
      const slicesMeta = metadata.slices || []
      const slices: ModelFieldResponse[] = slicesMeta.map((s: any, dIdx: number) => ({
        variable: metadata.variable,
        time: metadata.time,
        depth: s.actual_depth,
        lat_min: metadata.lat_min,
        lat_max: metadata.lat_max,
        lon_min: metadata.lon_min,
        lon_max: metadata.lon_max,
        width: w,
        height: h,
        latitudes: metadata.latitudes,
        longitudes: metadata.longitudes,
        values: reconstruct2DValues(floatArray, dIdx * sliceElements, w, h),
        min_value: s.min_value,
        max_value: s.max_value,
        unit: metadata.unit || "",
      }))

      return { slices }
    }
  } else {
    // Standard JSON fallback
    const stack: ModelFieldStackResponse = await res.json()

    const mapSlice = (slice: ModelFieldSlice, varName: string, unitStr: string): ModelFieldResponse => ({
      variable: varName,
      time: stack.time,
      depth: slice.actual_depth,
      lat_min: stack.lat_min,
      lat_max: stack.lat_max,
      lon_min: stack.lon_min,
      lon_max: stack.lon_max,
      width: stack.width,
      height: stack.height,
      latitudes: stack.latitudes,
      longitudes: stack.longitudes,
      values: slice.values,
      min_value: slice.min_value,
      max_value: slice.max_value,
      unit: unitStr,
    })

    const slices = (stack.slices || []).map((s) => mapSlice(s, stack.variable, stack.unit))
    const uSlices = stack.u_slices ? stack.u_slices.map((s) => mapSlice(s, "u_velocity", "m/s")) : undefined
    const vSlices = stack.v_slices ? stack.v_slices.map((s) => mapSlice(s, "v_velocity", "m/s")) : undefined

    return { slices, uSlices, vSlices }
  }
}

