"use client"

import React, { useState } from "react"
import { DATA_LAYERS, DataLayerItem } from "./page3Config"

interface DataLayerSelectorProps {
  activeLayerId: string | null
  onSelectLayer: (layer: DataLayerItem | null) => void
  layerVisibility: Record<string, boolean>
  onToggleVisibility: (layerId: string) => void
  onToggleObsTab?: (tab: "model" | "observations") => void
  showEEZ?: boolean
  onToggleEEZ?: () => void
}

export default function DataLayerSelector({
  activeLayerId,
  onSelectLayer,
  layerVisibility,
  onToggleVisibility,
  onToggleObsTab,
  showEEZ = true,
  onToggleEEZ,
}: DataLayerSelectorProps) {
  const [activeTab, setActiveTab] = useState<"model" | "observations">("model")

  const handleTabClick = (tab: "model" | "observations") => {
    setActiveTab(tab)
    onToggleObsTab?.(tab)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-2.5 select-none">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10.5px] font-bold tracking-[0.14em] text-slate-800 uppercase">
          DATA LAYERS
        </h3>
      </div>

      {/* Pill Segmented Control: Model Data | Observations */}
      <div className="flex items-center p-0.5 bg-slate-100 rounded-full mb-1.5">
        <button
          type="button"
          onClick={() => handleTabClick("model")}
          className={`flex-1 py-0.5 px-2.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
            activeTab === "model"
              ? "bg-[#0284c7] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Model Data
        </button>
        <button
          type="button"
          onClick={() => handleTabClick("observations")}
          className={`flex-1 py-0.5 px-2.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
            activeTab === "observations"
              ? "bg-[#0284c7] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Observations
        </button>
      </div>

      {/* Layers Radio List */}
      <div className="space-y-0.5">
        {/* Base Ocean (No Layer) */}
        <div
          onClick={() => onSelectLayer(null)}
          className={`flex items-center justify-between py-1 px-2.5 rounded-lg border cursor-pointer transition-all ${
            activeLayerId === null
              ? "bg-sky-50/80 border-sky-300 text-[#0a2540] shadow-2xs"
              : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs select-none">🌍</span>
            <span className="text-[11.5px] font-semibold">Base Ocean (No Layer)</span>
          </div>

          {/* Radio Indicator */}
          <div
            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
              activeLayerId === null
                ? "border-[#0284c7] bg-[#0284c7]"
                : "border-slate-300 bg-white"
            }`}
          >
            {activeLayerId === null && (
              <span className="w-1.5 h-1.5 rounded-full bg-white block" />
            )}
          </div>
        </div>

        {/* Dynamic Model Layers */}
        {DATA_LAYERS.map((layer) => {
          const isActive = layer.id === activeLayerId

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer)}
              className={`flex items-center justify-between py-1 px-2.5 rounded-lg border cursor-pointer transition-all ${
                isActive
                  ? "bg-sky-50/80 border-sky-300 text-[#0a2540] shadow-2xs"
                  : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs select-none">{layer.icon}</span>
                <span className="text-[11.5px] font-semibold">{layer.label}</span>
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isActive
                    ? "border-[#0284c7] bg-[#0284c7]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Geospatial Overlays */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between px-0.5 mb-1">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            GEOSPATIAL OVERLAYS
          </span>
        </div>
        <div
          onClick={() => onToggleEEZ?.()}
          className={`flex items-center justify-between py-1 px-2 rounded-lg border cursor-pointer transition-all ${
            showEEZ
              ? "bg-sky-50/70 border-sky-300 text-sky-950 font-medium shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-600"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">🇮🇳</span>
            <span className="text-[11px] font-semibold">Indian EEZ Boundary</span>
          </div>
          <div
            className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
              showEEZ ? "bg-[#0284c7] justify-end" : "bg-slate-300 justify-start"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs block" />
          </div>
        </div>
      </div>
    </div>
  )
}
