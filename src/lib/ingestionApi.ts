/**
 * src/lib/ingestionApi.ts
 * -----------------------
 * Client API for automated NetCDF & delimited-text ingestion status.
 */

export interface IngestionStatusResponse {
  automated_ingestion_enabled: boolean
  incoming_directory: string
  last_scan_time: string | null
  supported_formats: string[]
  files_discovered: number
  files_ingested: number
  files_failed: number
  recent_jobs: {
    job_id: string
    file_name: string
    format: string
    file_size_bytes: number
    status: string
    discovered_at: string
    completed_at?: string
    valid_records: number
    total_records: number
    detected_variables: string[]
    errors: string[]
    warnings: string[]
  }[]
}

import { API_BASE } from "./apiBase"

export async function fetchIngestionStatus(): Promise<IngestionStatusResponse> {
  const res = await fetch(`${API_BASE}/ingestion/status`, { method: "GET", cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Failed to fetch ingestion status: HTTP ${res.status}`)
  }
  return await res.json()
}

export async function triggerIngestionScan(): Promise<{ status: string; scanned_jobs_count: number; ingestion_summary: IngestionStatusResponse }> {
  const res = await fetch(`${API_BASE}/ingestion/scan`, { method: "POST", cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Failed to trigger ingestion scan: HTTP ${res.status}`)
  }
  return await res.json()
}
