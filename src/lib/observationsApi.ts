/**
 * src/lib/observationsApi.ts
 * --------------------------
 * Client for real in-situ ocean observation endpoints (Argo, Glider, CTD, BGC).
 */

export interface ObservationItem {
  id: string
  type: "argo" | "glider" | "ctd" | "bgc" | string
  platform_id?: string
  profile_id?: string
  timestamp?: string
  latitude: number
  longitude: number
  max_depth?: number
  variables: string[]
  qc?: number
  source: string
}

export interface ObservationListResponse {
  count: number
  total_in_dataset: number
  counts_by_type: Record<string, number>
  lat_bounds?: [number, number]
  lon_bounds?: [number, number]
  items: ObservationItem[]
}

export interface ObservationProfilePoint {
  depth: number
  pressure?: number
  temperature?: number
  salinity?: number
  chlorophyll?: number
  oxygen?: number
  nitrate?: number
  ph?: number
}

export interface ObservationProfileResponse {
  id: string
  type: string
  platform_id?: string
  timestamp?: string
  latitude: number
  longitude: number
  max_depth: number
  variables: string[]
  source: string
  data: ObservationProfilePoint[]
}

import { API_BASE } from "./apiBase"

export async function fetchObservations(params?: {
  type?: string
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  limit?: number
  signal?: AbortSignal
}): Promise<ObservationListResponse> {
  const query = new URLSearchParams()
  if (params?.type) query.set("type", params.type)
  if (params?.lat_min !== undefined) query.set("lat_min", params.lat_min.toString())
  if (params?.lat_max !== undefined) query.set("lat_max", params.lat_max.toString())
  if (params?.lon_min !== undefined) query.set("lon_min", params.lon_min.toString())
  if (params?.lon_max !== undefined) query.set("lon_max", params.lon_max.toString())
  if (params?.limit) query.set("limit", params.limit.toString())

  const url = `${API_BASE}/observations?${query.toString()}`
  const res = await fetch(url, { method: "GET", signal: params?.signal })
  if (!res.ok) {
    throw new Error(`Failed to fetch observations: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function fetchObservationProfile(obsId: string, signal?: AbortSignal): Promise<ObservationProfileResponse> {
  const url = `${API_BASE}/observations/${obsId}/profile`
  const res = await fetch(url, { method: "GET", signal })
  if (!res.ok) {
    throw new Error(`Failed to fetch profile for ${obsId}: HTTP ${res.status}`)
  }
  return await res.json()
}
