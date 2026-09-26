"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { ModelFieldResponse } from "@/lib/modelApi"
import ScalarModelLayer from "./ScalarModelLayer"
import CurrentsVectorLayer from "./CurrentsVectorLayer"

interface ModelLayerManagerProps {
  activeLayerId?: string | null
  isVisible: boolean
  scalarFieldData?: ModelFieldResponse | null
  uFieldData?: ModelFieldResponse | null
  vFieldData?: ModelFieldResponse | null
  vectorDensity?: "low" | "medium" | "high"
  isModelLoading?: boolean
}

class ModelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Model layer render error caught safely:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default function ModelLayerManager({
  activeLayerId,
  isVisible,
  scalarFieldData,
  uFieldData,
  vFieldData,
  vectorDensity = "medium",
  isModelLoading = false,
}: ModelLayerManagerProps) {
  if (!activeLayerId || !isVisible) return null

  return (
    <ModelErrorBoundary>
      <group>
        {/* Scalar Layer: Temperature, Salinity, Chlorophyll */}
        {activeLayerId !== "currents" && scalarFieldData && (
          <ScalarModelLayer
            fieldData={scalarFieldData}
            radius={2.004}
            opacity={isModelLoading ? 0.35 : 0.88}
          />
        )}

        {/* Vector Layer: Currents (uo, vo) */}
        {activeLayerId === "currents" && uFieldData && vFieldData && (
          <CurrentsVectorLayer
            uField={uFieldData}
            vField={vFieldData}
            vectorDensity={vectorDensity}
            radius={2.006}
            opacity={isModelLoading ? 0.35 : 1.0}
          />
        )}
      </group>
    </ModelErrorBoundary>
  )
}
