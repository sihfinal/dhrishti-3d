/**
 * src/lib/comparisonApi.ts
 * ------------------------
 * Client-side API library for Model vs Observation vertical sounding comparison.
 */

export interface ComparisonPoint {
  depth: number
  obs_value: number
  model_value: number
  residual: number
  abs_error: number
  model_depth: number
  depth_diff: number
}

export interface ModelFullProfilePoint {
  depth: number
  value: number
}

export interface SupportedVariable {
  id: string
  label: string
  unit: string
  nc_variable: string
}

export interface ComparisonMetrics {
  valid_points_count: number
  mean_residual: number | null
  mean_absolute_error: number | null
  root_mean_square_difference: number | null
  min_residual: number | null
  max_residual: number | null
  formula: string
}

export interface ModelMatchMetadata {
  dataset: string
  nearest_latitude: number
  nearest_longitude: number
  spatial_distance_km: number
  model_date: string
  obs_date: string | null
  time_difference_days: number | null
  variable: string
  nc_variable: string
  unit: string
  label: string
}

export interface ComparisonResponse {
  status: "success" | "out_of_bounds" | "error"
  message?: string
  observation: {
    id: string
    type: string
    platform_id?: string | number
    latitude: number
    longitude: number
    timestamp?: string | null
    max_depth?: number
    source?: string
  }
  model_match?: ModelMatchMetadata
  metrics?: ComparisonMetrics
  supported_variables?: SupportedVariable[]
  profile_comparison?: ComparisonPoint[]
  model_full_profile?: ModelFullProfilePoint[]
}

import { API_BASE } from "./apiBase"

/**
 * Fetch Model vs Observation profile comparison for a specific observation and variable.
 */
export async function fetchModelObsComparison(
  obsId: string,
  variable: string = "temperature",
  modelDate?: string
): Promise<ComparisonResponse> {
  const params = new URLSearchParams({
    obs_id: obsId,
    variable,
  })
  if (modelDate) {
    params.append("model_date", modelDate)
  }

  const url = `${API_BASE}/compare/model-observation?${params.toString()}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(errJson.detail || `Server returned ${res.status}: ${res.statusText}`)
    }
    return await res.json()
  } catch (err: any) {
    console.error("fetchModelObsComparison failed:", err)
    throw err
  }
}
