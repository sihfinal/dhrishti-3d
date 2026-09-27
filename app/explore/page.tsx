"use client"

import { useState, Suspense } from "react"
import Page3Workstation from "@/components/page3/Page3Workstation"
import Manual from "@/ui/Manual"

export default function ExplorePage() {
  const [manualOpen, setManualOpen] = useState(false)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#f0f6fc]">
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">Loading SAGAR NETRA 3D Explorer...</div>}>
        <Page3Workstation
          onOpenManual={() => setManualOpen(true)}
        />
      </Suspense>
      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  )
}


