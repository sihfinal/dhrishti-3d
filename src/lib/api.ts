/**
 * src/lib/api.ts
 * --------------
 * Dual-mode data layer.
 *
 * MODE A — Static (default, NEXT_PUBLIC_API_URL is absent):
 *   Fetches from /public/data/ exactly as before.
 *   All three functions behave identically to the original implementation.
 *
 * MODE B — FastAPI (NEXT_PUBLIC_API_URL is set, e.g. http://localhost:8000/api/v1):
 *   fetchManifest()      → static manifest + RSMC variables merged on top
 *   fetchFieldBinary()   → for RSMC vars: all depth/time slices assembled via rsmc.ts
 *                          for static vars: /data/{file}.bin (unchanged)
 *   fetchProfiles()      → always /data/profiles.json (Phase 1, unchanged)
 *
 * Nothing in fieldCache.ts, DepthSlices.tsx, ColormapShader.ts, or any
 * renderer is modified.
 */

import type { FieldMeta, InstrumentPlatform, Manifest } from "@/types"
import { buildRsmcManifest, fetchRsmcFieldBinary } from "./rsmc"

// ── Configuration ─────────────────────────────────────────────────────────────

const rawApiUrl: string =
  typeof process !== "undefined"
    ? ((process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL) ?? "").trim()
    : ""

const API_BASE: string = rawApiUrl
  ? (rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`)
  : ""

export const USE_API = API_BASE.length > 0

// ── Manifest ──────────────────────────────────────────────────────────────────

export async function fetchManifest(): Promise<Manifest> {
  // The static manifest is always loaded — it is the authoritative source for
  // WOA23/HYCOM variables, profiles metadata, ROI, and grid layout.
  const staticRes = await fetch("/data/manifest.json")
  if (!staticRes.ok) throw new Error(`manifest ${staticRes.status}`)
  const staticManifest: Manifest = await staticRes.json()

  if (!USE_API) {
    return staticManifest   // MODE A: return as-is
  }

  // MODE B: extend with live RSMC variables (RSMC variables appear first in dropdown)
  try {
    return await buildRsmcManifest(API_BASE, staticManifest)
  } catch (err) {
    console.warn("[api] RSMC manifest build failed — using static manifest only.\n", err)
    return staticManifest
  }
}

// ── Field binary ──────────────────────────────────────────────────────────────

/**
 * Accept the full FieldMeta so the RSMC assembler can read dims, globalMin,
 * globalMax, and the variable name from meta.file.
 *
 * For non-RSMC (static) variables the extra fields are ignored and only
 * meta.file is used to build the /data/{file} URL — identical to the
 * original implementation.
 */
export async function fetchFieldBinary(meta: FieldMeta): Promise<ArrayBuffer> {
  if (USE_API && meta.file.startsWith("__api__/")) {
    // RSMC variable → assemble 3D blob from the FastAPI backend
    try {
      return await fetchRsmcFieldBinary(API_BASE, meta)
    } catch (err) {
      console.error("[api] RSMC field fetch failed:", err)
      throw err   // no static .bin fallback for RSMC variables
    }
  }

  // Static variable (WOA23, HYCOM currents) — original behaviour unchanged
  const res = await fetch(`/data/${meta.file}`)
  if (!res.ok) throw new Error(`field ${meta.file}: ${res.status}`)
  return res.arrayBuffer()
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function fetchProfiles(): Promise<{
  platforms: InstrumentPlatform[]
}> {
  const res = await fetch("/data/profiles.json")
  if (!res.ok) throw new Error(`profiles ${res.status}`)
  const data = await res.json()
  
  // Filter out any platforms that fall outside the user's custom shaded boundary
  const filtered = data.platforms.filter((p: InstrumentPlatform) => {
    return (p.lat >= -8.0 && p.lat <= 30.0 && p.lon >= 61.0 && p.lon <= 98.0)
  })

  return { platforms: filtered }
}
