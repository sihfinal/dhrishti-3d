/**
 * src/lib/apiBase.ts
 * ------------------
 * Centralized resolution of the backend API Base URL.
 * Supports configurable Render URLs in production via NEXT_PUBLIC_API_URL or
 * NEXT_PUBLIC_API_BASE_URL, defaulting to http://localhost:8000/api/v1 for local development.
 */

export function getApiBaseUrl(): string {
  const rawApiUrl =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim()
      : ""

  if (!rawApiUrl) {
    return "http://localhost:8000/api/v1"
  }

  return rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`
}

export const API_BASE: string = getApiBaseUrl()
