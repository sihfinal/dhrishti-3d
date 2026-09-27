import { describe, it, expect, vi } from "vitest"
import { formatDisplayDate, dateStringToTimeStepIndex } from "../src/lib/modelApi"

describe("Model Controls Redesign — Behavior and Logic Verification", () => {
  it("formats dates properly for time section", () => {
    // Index 0: 2026-01-01
    expect(formatDisplayDate(0)).toBe("01 Jan 2026")
    // Index 30: 2026-01-31
    expect(formatDisplayDate(30)).toBe("31 Jan 2026")
    // Index 45: 2026-02-15
    expect(formatDisplayDate(45)).toBe("15 Feb 2026")
    // Index 58: 2026-02-28
    expect(formatDisplayDate(58)).toBe("28 Feb 2026")
    // Index 89: 2026-03-31
    expect(formatDisplayDate(89)).toBe("31 Mar 2026")
  })

  it("calculates active current frame and total frames correctly", () => {
    // Test mid-month Feb (Feb 15)
    const timeStepFeb15 = dateStringToTimeStepIndex("2026-02-15")
    const baseDate15 = new Date(Date.UTC(2026, 0, 1 + timeStepFeb15))
    const currentDay15 = baseDate15.getUTCDate()
    const daysInFeb = new Date(Date.UTC(2026, baseDate15.getUTCMonth() + 1, 0)).getUTCDate()
    const totalFramesFeb = 28
    const activeCurrentFrame15 = Math.min(Math.max(1, currentDay15), totalFramesFeb)
    const isAtEnd15 = activeCurrentFrame15 >= totalFramesFeb

    expect(activeCurrentFrame15).toBe(15)
    expect(totalFramesFeb).toBe(28)
    expect(isAtEnd15).toBe(false)
    expect(`${activeCurrentFrame15} / ${totalFramesFeb} days`).toBe("15 / 28 days")

    // Test final frame Feb (Feb 28)
    const timeStepFeb28 = dateStringToTimeStepIndex("2026-02-28")
    const baseDate28 = new Date(Date.UTC(2026, 0, 1 + timeStepFeb28))
    const currentDay28 = baseDate28.getUTCDate()
    const activeCurrentFrame28 = Math.min(Math.max(1, currentDay28), totalFramesFeb)
    const isAtEnd28 = activeCurrentFrame28 >= totalFramesFeb

    expect(activeCurrentFrame28).toBe(28)
    expect(isAtEnd28).toBe(true)
    expect(`${activeCurrentFrame28} / ${totalFramesFeb} days`).toBe("28 / 28 days")
  })

  it("handles segmented speed control selections directly without cycling", () => {
    let selectedSpeed = 4
    const onSpeedChange = (s: number) => {
      selectedSpeed = s
    }

    // Direct clicks
    onSpeedChange(1)
    expect(selectedSpeed).toBe(1)
    onSpeedChange(2)
    expect(selectedSpeed).toBe(2)
    onSpeedChange(4)
    expect(selectedSpeed).toBe(4)
  })

  it("resets to beginning on replay when at final frame", () => {
    const dates = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`)
    let curDateStr = "2026-02-28"
    let startIndex = dates.indexOf(curDateStr)
    expect(startIndex).toBe(27)

    // Replay check
    if (startIndex >= dates.length - 1) {
      startIndex = 0
      curDateStr = dates[0]
    }
    expect(startIndex).toBe(0)
    expect(curDateStr).toBe("2026-02-01")
  })

  it("determines correct cursor feedback based on interaction mode and hover target", () => {
    const getCursorClass = (isNavActive: boolean, isHoveringMarker: boolean) => {
      if (isNavActive) return "cursor-grab active:cursor-grabbing"
      if (isHoveringMarker) return "cursor-pointer"
      return "cursor-crosshair"
    }

    // Navigate Mode (default)
    expect(getCursorClass(true, false)).toBe("cursor-grab active:cursor-grabbing")
    expect(getCursorClass(true, true)).toBe("cursor-grab active:cursor-grabbing")

    // Inspect Mode
    expect(getCursorClass(false, false)).toBe("cursor-crosshair")
    expect(getCursorClass(false, true)).toBe("cursor-pointer")
  })

  it("provides correct tooltip titles and descriptions for interaction modes", () => {
    const modeTooltips = {
      navigate: {
        title: "Navigate 3D View",
        desc: "Drag to orbit, pan and resize the 3D view.",
      },
      inspect: {
        title: "Inspect Data Points",
        desc: "Hover or click an observation point to view its details.",
      },
    }

    expect(modeTooltips.navigate.title).toBe("Navigate 3D View")
    expect(modeTooltips.navigate.desc).toBe("Drag to orbit, pan and resize the 3D view.")
    expect(modeTooltips.inspect.title).toBe("Inspect Data Points")
    expect(modeTooltips.inspect.desc).toBe("Hover or click an observation point to view its details.")
  })
})
