"use client"

import React from "react"

export interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg"
  color?: string
  trackColor?: string
  className?: string
  label?: string
}

export default function LoadingSpinner({
  size = "sm",
  color = "#0284c7",
  trackColor,
  className = "",
  label,
}: LoadingSpinnerProps) {
  // Exact size classes ensuring no layout shift
  const sizeMap = {
    xs: "w-3 h-3 border-[1.5px]",
    sm: "w-3.5 h-3.5 border-2",
    md: "w-4 h-4 border-2",
    lg: "w-6 h-6 border-2",
  }

  const defaultTrack =
    trackColor !== undefined
      ? trackColor
      : color === "#ffffff"
      ? "rgba(255, 255, 255, 0.25)"
      : "rgba(2, 132, 199, 0.18)"

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      role="status"
      aria-label={label || "Loading"}
    >
      <span
        className={`${sizeMap[size]} rounded-full animate-spin`}
        style={{
          borderColor: defaultTrack,
          borderTopColor: color,
        }}
      />
      <span className="sr-only">{label || "Loading…"}</span>
    </span>
  )
}
