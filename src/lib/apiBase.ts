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

  // In browser on localhost or 127.0.0.1, prioritize the local FastAPI backend (:8000)
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10.")
    if (isLocalhost) {
      if (rawApiUrl && !rawApiUrl.includes("onrender.com")) {
        return rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`
      }
      return `http://${window.location.hostname}:8000/api/v1`
    }
  }

  if (!rawApiUrl) {
    // When loaded in a browser on a cloud domain (e.g. Render), default to the live production backend
    if (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && window.location.hostname !== "127.0.0.1") {
      return "https://sagar-netra-backend-pnpk.onrender.com/api/v1"
    }
    return "http://localhost:8000/api/v1"
  }

  return rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`
}

export const API_BASE: string = getApiBaseUrl()
