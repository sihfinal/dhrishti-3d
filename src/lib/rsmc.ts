/**
 * src/lib/rsmc.ts
 * ---------------
 * Client-side integration bridge between the Phase 1 FastAPI backend and
 * the existing Sagar Netra 3D 3D rendering pipeline.
 *
 * This file is the ONLY new file needed for integration.  No renderer,
 * shader, fieldCache, DepthSlices, or scene file is changed.
 *
 * ── Data flow ──────────────────────────────────────────────────────────────
 *
 *   FastAPI GET /api/v1/model/field?variable=TEMP&depth=0&timestamp=...
 *     │   (returns: 2D Uint8 blob  +  X-Scale / X-Offset / X-Width / X-Height
 *     │              X-Actual-Time / X-Actual-Depth headers)
 *     ▼
 *   fetchRsmcFieldBinary()               ← called by api.ts fetchFieldBinary()
 *     │   fetches all (nTime × nDepth) slices in parallel
 *     │   re-normalises every slice to one shared global uint8 encoding
 *     │   assembles output[nTime × nDepth × nLat × nLon] in TIME-major order
 *     ▼
 *   fieldCache.ts getFieldData()         (unchanged)
 *     │   caches the assembled blob by meta.id
 *     ▼
 *   DepthSlices.tsx                       (unchanged)
 *     │   reads frame = timeIdx * nDepth * nLat * nLon
 *     │   reads slice = frame + depthIdx * nLat * nLon
 *     │   builds DataTexture → ColormapShader → THREE.Mesh on sphere
 *     ▼
 *   Globe / Volume renderer              (unchanged)
 *
 * ── Encoding contract ──────────────────────────────────────────────────────
 *
 *   The backend returns per-slice uint8 bytes with per-request scale/offset
 *   in X-Scale and X-Offset headers.  To be consistent across all depths and
 *   time steps (so the colormap LUT maps to the same physical scale
 *   everywhere), we decode each slice to physical values then re-encode
 *   them with a shared GLOBAL scale derived from VAR_RANGES:
 *
 *     physical = x_offset + byte_value × x_scale
 *     global_q = round((physical − gMin) × 254 / (gMax − gMin))
 *     fill byte (255) → stays 255
 *
 *   The FieldMeta in the manifest carries globalMin/globalMax/encoding that
 *   match VAR_RANGES.  The ColormapShader reads these to build the LUT.
 *
 * ── Performance ────────────────────────────────────────────────────────────
 *
 *   At FETCH_STRIDE = 2 and the ROI (−35…30°N, 40…100°E):
 *     ~540 × 510 ≈ 275 K nodes per slice
 *     28 time steps × 6 depths = 168 parallel requests to localhost
 *     Total payload: ~47 MB assembled in RAM, transferred in ~1–2 s localhost.
 *
 *   All requests are fired in parallel via Promise.all. The backend serves
 *   them lazily from the NetCDF without loading the full 9.8 GB file.
 */

import type { FieldMeta, Manifest } from "@/types"

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * The ROI used for all RSMC field requests.
 * Must match the existing static manifest roi so the globe geometry is aligned.
 */
const RSMC_ROI = {
  latMin: -35.0,
  latMax:  30.0,
  lonMin:  40.0,
  lonMax: 100.0,
} as const

/**
 * Grid stride for all RSMC field requests.
 * stride=2 gives ~275 K nodes per slice for the ROI.
 * Increase to 3 or 4 if initial load is too slow.
 */
const FETCH_STRIDE = 2

/**
 * Physical (conservative) bounds for each RSMC variable.
 * These become the globalMin / globalMax in the manifest FieldMeta and the
 * shared encoding range for all depth/time slices.
 */
export const VAR_RANGES: Record<string, {
  min: number; max: number; unit: string; name: string
}> = {
  TEMP: { min: -2.0, max: 35.0, unit: "°C",  name: "Temperature (RSMC)" },
  SALN: { min:  0.0, max: 42.0, unit: "PSU", name: "Salinity (RSMC)"    },
  UVEL: { min: -3.0, max:  3.0, unit: "m/s", name: "U Current (RSMC)"   },
  VVEL: { min: -3.0, max:  3.0, unit: "m/s", name: "V Current (RSMC)"   },
}

// ── Internal types ────────────────────────────────────────────────────────────

interface RsmcMeta {
  times:   string[]   // ISO-8601 UTC — 28 × 6-hourly steps
  depthsM: number[]   // [0, 10, 50, 100, 250, 500]
  latMin:  number
  latMax:  number
  lonMin:  number
  lonMax:  number
}

/** Result of fetching one 2D slice from the backend. */
interface SliceResponse {
  bytes:      Uint8Array
  xScale:     number
  xOffset:    number
  xFill:      number
  nLat:       number
  nLon:       number
  actualTime: string
  actualDepth: number
}

// ── Meta cache ────────────────────────────────────────────────────────────────

let _metaCache: RsmcMeta | null = null

export function clearRsmcMetaCache(): void {
  _metaCache = null
}

export async function fetchRsmcMeta(apiBase: string): Promise<RsmcMeta> {
  if (_metaCache) return _metaCache

  const [timesRes, datasetRes] = await Promise.all([
    fetch(`${apiBase}/model/times`),
    fetch(`${apiBase}/datasets/incois_rsmc_daily/metadata`),
  ])
  if (!timesRes.ok)   throw new Error(`RSMC /model/times ${timesRes.status}`)
  if (!datasetRes.ok) throw new Error(`RSMC /metadata ${datasetRes.status}`)

  const timesJson   = await timesRes.json()
  const datasetJson = await datasetRes.json()

  _metaCache = {
    times:   timesJson.times     as string[],
    depthsM: datasetJson.depthsM as number[],
    latMin:  datasetJson.lat_min as number,
    latMax:  datasetJson.lat_max as number,
    lonMin:  datasetJson.lon_min as number,
    lonMax:  datasetJson.lon_max as number,
  }
  return _metaCache
}

// ── Manifest builder ──────────────────────────────────────────────────────────

/**
 * Builds a merged Manifest that prepends live RSMC variables to the existing
 * static manifest's variable list.
 *
 * The grid dimensions (nLat, nLon) are discovered by probing one small slice.
 * If the probe fails (backend offline), the static manifest is returned as-is.
 */
export async function buildRsmcManifest(
  apiBase:        string,
  staticManifest: Manifest
): Promise<Manifest> {
  const rsmcMeta = await fetchRsmcMeta(apiBase)

  // Probe a single slice to learn nLat / nLon for the ROI at our stride
  let nLat = 0
  let nLon = 0
  try {
    const probe = await fetchOneSlice(
      apiBase, "TEMP", rsmcMeta.times[0], 0, FETCH_STRIDE
    )
    nLat = probe.nLat
    nLon = probe.nLon
  } catch {
    console.warn("[rsmc] probe slice failed — nLat/nLon will be set on first real fetch")
  }

  const rsmc_times  = rsmcMeta.times
  const rsmc_depths = rsmcMeta.depthsM

  function makeField(varId: string): FieldMeta {
    const { min, max, unit, name } = VAR_RANGES[varId]
    const scale = (max - min) / 254.0
    return {
      id:        `rsmc_${varId.toLowerCase()}`,
      name,
      unit,
      source:    "INCOIS RSMC daily ocean forecast (RSMC_hycom_20260830.nc, HYCOM-based)",
      depthsM:   rsmc_depths,
      globalMin: min,
      globalMax: max,
      encoding: {
        dtype:    "uint8",
        scale,
        offset:   min,
        fillByte: 255,
      },
      // "__api__/model/field?variable=TEMP" → triggers fetchRsmcFieldBinary()
      file: `__api__/model/field?variable=${varId}`,
      provenance: {
        url:      "https://las.incois.gov.in/thredds/",
        citation: "Indian National Centre for Ocean Information Services (INCOIS)",
      },
      dims: {
        nDepth: rsmc_depths.length,
        nLat,
        nLon,
        nTime:  rsmc_times.length,
      },
      times: rsmc_times,  // exposes the time slider in ControlPanel
    }
  }

  const rsmcVars: FieldMeta[] = ["TEMP", "SALN", "UVEL", "VVEL"].map(makeField)

  return {
    ...staticManifest,
    // RSMC variables first; WOA23/HYCOM variables follow unchanged.
    variables: [...rsmcVars, ...staticManifest.variables],
    // Keep the existing ROI so globe geometry is aligned.
    roi: RSMC_ROI,
  }
}

// ── Field binary fetcher ──────────────────────────────────────────────────────

/**
 * Fetch ALL time steps × ALL depth levels for one RSMC variable and assemble
 * them into a single Uint8Array shaped [nTime × nDepth × nLat × nLon].
 *
 * Layout (TIME-major, then DEPTH-major):
 *   index = t * nDepth * nLat * nLon
 *         + d * nLat * nLon
 *         + row * nLon
 *         + col
 *
 * This exactly matches how DepthSlices.tsx addresses the blob:
 *   frame = timeIdx * nDepth * nLat * nLon
 *   slice = bytes.subarray(frame + k * nLat * nLon, frame + (k+1) * nLat * nLon)
 *
 * Each slice is re-encoded with the SHARED global uint8 scale so that all
 * depth levels and time steps lie in the same physical colour space.
 */
export async function fetchRsmcFieldBinary(
  apiBase: string,
  meta:    FieldMeta
): Promise<ArrayBuffer> {
  // Parse variable name from meta.file  (e.g. "__api__/model/field?variable=TEMP")
  const varMatch = meta.file.match(/variable=([A-Z]+)/)
  if (!varMatch) throw new Error(`Cannot parse variable from meta.file: "${meta.file}"`)
  const variable = varMatch[1]

  const rsmcMeta = await fetchRsmcMeta(apiBase)
  const depths   = rsmcMeta.depthsM   // [0, 10, 50, 100, 250, 500]
  const times    = rsmcMeta.times      // 28 × ISO strings

  const { min: gMin, max: gMax } = VAR_RANGES[variable] ?? { min: 0, max: 1 }
  const gRange = (gMax - gMin) || 1

  // ── Fire all (nTime × nDepth) requests in parallel ────────────────────────
  const allFetches: Promise<SliceResponse>[] = []
  for (const timestamp of times) {
    for (const depth of depths) {
      allFetches.push(fetchOneSlice(apiBase, variable, timestamp, depth, FETCH_STRIDE))
    }
  }

  console.info(
    `[rsmc] Fetching ${allFetches.length} slices for ${variable} ` +
    `(${times.length} times × ${depths.length} depths) …`
  )

  const results = await Promise.all(allFetches)

  // ── Extract grid dimensions from first result ─────────────────────────────
  const { nLat, nLon } = results[0]
  if (nLat === 0 || nLon === 0) {
    throw new Error(`[rsmc] backend returned empty grid for ${variable}`)
  }

  // Update manifest dims in-place so DepthSlices reads the correct nLat/nLon
  meta.dims.nLat = nLat
  meta.dims.nLon = nLon

  const nTime  = times.length
  const nDepth = depths.length
  const total  = nTime * nDepth * nLat * nLon

  const output = new Uint8Array(total)
  output.fill(255)  // pre-fill with fillByte = land / NaN

  // ── Assemble: decode to physical → re-encode with global scale ────────────
  let idx = 0  // index into results array (TIME-major then DEPTH-major)
  for (let t = 0; t < nTime; t++) {
    for (let d = 0; d < nDepth; d++) {
      const { bytes, xScale, xOffset, xFill } = results[idx++]
      const base = (t * nDepth + d) * nLat * nLon
      const len  = Math.min(bytes.length, nLat * nLon)

      for (let i = 0; i < len; i++) {
        const raw = bytes[i]
        if (raw === xFill) {
          output[base + i] = 255  // fill → fill
          continue
        }
        // Decode: physical = xOffset + raw × xScale
        const physical = xOffset + raw * xScale
        // Re-encode with global range
        let gq = Math.round((physical - gMin) * 254.0 / gRange)
        if (gq < 0)   gq = 0
        if (gq > 254) gq = 254
        output[base + i] = gq
      }
    }
  }

  console.info(
    `[rsmc] ${variable} assembled: ${nTime}×${nDepth}×${nLat}×${nLon} = ` +
    `${total.toLocaleString()} bytes`
  )

  return output.buffer
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function fetchOneSlice(
  apiBase:   string,
  variable:  string,
  timestamp: string,
  depth:     number,
  stride:    number
): Promise<SliceResponse> {
  const params = new URLSearchParams({
    variable,
    timestamp,
    depth:         String(depth),
    latitude_min:  String(RSMC_ROI.latMin),
    latitude_max:  String(RSMC_ROI.latMax),
    longitude_min: String(RSMC_ROI.lonMin),
    longitude_max: String(RSMC_ROI.lonMax),
    stride:        String(stride),
  })

  const res = await fetch(`${apiBase}/model/field?${params}`)
  if (!res.ok) {
    throw new Error(
      `RSMC slice fetch failed: ${variable} @ ${timestamp} depth=${depth} → ${res.status}`
    )
  }

  const xScale  = parseFloat(res.headers.get("x-scale")       ?? "1")
  const xOffset = parseFloat(res.headers.get("x-offset")      ?? "0")
  const xFill   = parseInt  (res.headers.get("x-fill-value")  ?? "255", 10)
  const nLon    = parseInt  (res.headers.get("x-width")        ?? "0",   10)
  const nLat    = parseInt  (res.headers.get("x-height")       ?? "0",   10)
  const actualTime  = res.headers.get("x-actual-time")  ?? timestamp
  const actualDepth = parseFloat(res.headers.get("x-actual-depth") ?? String(depth))

  const buf   = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)

  return { bytes, xScale, xOffset, xFill, nLat, nLon, actualTime, actualDepth }
}
