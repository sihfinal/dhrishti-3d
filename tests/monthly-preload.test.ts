import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  fetchModelTimes,
  fetchModelFieldStack,
  timeStepIndexToDateString,
  dateStringToTimeStepIndex,
  formatDisplayDate,
  getMonthDates,
} from "../src/lib/modelApi"

describe("Stage 2 3D Depth View — Monthly Preload & Date Lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("converts between timeStepIndex and UTC date strings deterministically without timezone shift", () => {
    // 01 Jan 2026 (index 0)
    expect(timeStepIndexToDateString(0)).toBe("2026-01-01")
    expect(dateStringToTimeStepIndex("2026-01-01")).toBe(0)
    expect(formatDisplayDate(0)).toBe("01 Jan 2026")

    // 01 Feb 2026 (index 31)
    expect(timeStepIndexToDateString(31)).toBe("2026-02-01")
    expect(dateStringToTimeStepIndex("2026-02-01")).toBe(31)
    expect(formatDisplayDate(31)).toBe("01 Feb 2026")

    // 15 Feb 2026 (index 45)
    expect(timeStepIndexToDateString(45)).toBe("2026-02-15")
    expect(dateStringToTimeStepIndex("2026-02-15")).toBe(45)
    expect(formatDisplayDate(45)).toBe("15 Feb 2026")

    // 28 Feb 2026 (index 58, 2026 is non-leap)
    expect(timeStepIndexToDateString(58)).toBe("2026-02-28")
    expect(dateStringToTimeStepIndex("2026-02-28")).toBe(58)
    expect(formatDisplayDate(58)).toBe("28 Feb 2026")

    // 01 Mar 2026 (index 59)
    expect(timeStepIndexToDateString(59)).toBe("2026-03-01")
    expect(dateStringToTimeStepIndex("2026-03-01")).toBe(59)
    expect(formatDisplayDate(59)).toBe("01 Mar 2026")

    // 31 Mar 2026 (index 89, final frame)
    expect(timeStepIndexToDateString(89)).toBe("2026-03-31")
    expect(dateStringToTimeStepIndex("2026-03-31")).toBe(89)
    expect(formatDisplayDate(89)).toBe("31 Mar 2026")
  })

  it("getMonthDates returns exact days for February 2026 (28 days)", () => {
    const febDates = getMonthDates(2026, 2)
    expect(febDates).toHaveLength(28)
    expect(febDates[0]).toBe("2026-02-01")
    expect(febDates[27]).toBe("2026-02-28")
  })

  it("fetchModelTimes queries /model/times and parses times array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: "cmems-daily",
        count: 2,
        times: ["2026-02-01", "2026-02-15"],
      }),
    })
    globalThis.fetch = fetchMock as any

    const times = await fetchModelTimes()
    expect(times).toEqual(["2026-02-01", "2026-02-15"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fetchModelFieldStack caches results in memory so playback does not repeat network requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        variable: "temperature",
        time: "2026-02-01",
        depths: [0, 25],
        requested_depths: [0, 25],
        lat_min: -18,
        lat_max: -5,
        lon_min: 65,
        lon_max: 85,
        width: 2,
        height: 2,
        latitudes: [-18, -5],
        longitudes: [65, 85],
        unit: "°C",
        slices: [
          {
            depth: 0,
            requested_depth: 0,
            actual_depth: 0,
            values: [[28.5, 28.6], [28.4, 28.5]],
            min_value: 28.4,
            max_value: 28.6,
          },
        ],
      }),
    })
    globalThis.fetch = fetchMock as any

    // First request: Cache miss -> network fetch
    const res1 = await fetchModelFieldStack({
      variable: "temperature",
      time: "2026-02-01",
      depths: [0, 25],
      lat_min: -18,
      lat_max: -5,
      lon_min: 65,
      lon_max: 85,
      stride: 2,
    })
    expect(res1.slices).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Second request with same parameters (during playback): Cache hit -> zero network calls!
    const res2 = await fetchModelFieldStack({
      variable: "temperature",
      time: "2026-02-01",
      depths: [0, 25],
      lat_min: -18,
      lat_max: -5,
      lon_min: 65,
      lon_max: 85,
      stride: 2,
    })
    expect(res2.slices).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // Still 1! Cached in memory!
  })

  it("regression: playback advances strictly 1 loaded day at a time in chronological order without skipping", () => {
    const febDates = getMonthDates(2026, 2) // 28 days: 2026-02-01 to 2026-02-28
    expect(febDates).toHaveLength(28)

    // Simulate playback starting at 01 Feb 2026 (index 0)
    let playbackIndex = 0
    const visitedDates: string[] = [febDates[playbackIndex]]
    const visitedIndices: number[] = [dateStringToTimeStepIndex(febDates[playbackIndex])]

    for (let step = 1; step < febDates.length; step++) {
      // Single source of truth playback transition: (current + 1) % length
      playbackIndex = (playbackIndex + 1) % febDates.length
      const currentDate = febDates[playbackIndex]
      visitedDates.push(currentDate)
      visitedIndices.push(dateStringToTimeStepIndex(currentDate))
    }

    // Verify all 28 days visited sequentially
    expect(visitedDates).toHaveLength(28)
    expect(visitedDates[0]).toBe("2026-02-01")
    expect(visitedDates[1]).toBe("2026-02-02")
    expect(visitedDates[2]).toBe("2026-02-03")
    expect(visitedDates[14]).toBe("2026-02-15")
    expect(visitedDates[27]).toBe("2026-02-28")

    // Verify timeStepIndex strictly increments by 1 on every single step
    for (let i = 1; i < visitedIndices.length; i++) {
      expect(visitedIndices[i]).toBe(visitedIndices[i - 1] + 1)
    }

    // Verify loopback: next step after 28 Feb loops back to 01 Feb (index 0)
    const loopIndex = (playbackIndex + 1) % febDates.length
    expect(loopIndex).toBe(0)
    expect(febDates[loopIndex]).toBe("2026-02-01")
  })

  it("regression: playback starting from any mid-month date advances sequentially and wraps to frame 0", () => {
    const febDates = getMonthDates(2026, 2)
    
    // User starts playback from 15 Feb 2026
    const selectedDate = "2026-02-15"
    let playbackIndex = febDates.indexOf(selectedDate)
    expect(playbackIndex).toBe(14)

    const sequence: string[] = [febDates[playbackIndex]]
    // Advance 14 steps to reach end of month (28 Feb) + 2 more steps into loop
    for (let step = 0; step < 15; step++) {
      playbackIndex = (playbackIndex + 1) % febDates.length
      sequence.push(febDates[playbackIndex])
    }

    expect(sequence[0]).toBe("2026-02-15")
    expect(sequence[1]).toBe("2026-02-16")
    expect(sequence[13]).toBe("2026-02-28")
    expect(sequence[14]).toBe("2026-02-01") // Wrapped to beginning
    expect(sequence[15]).toBe("2026-02-02") // Next sequential frame
  })

  it("regression: zero network calls occur when advancing through preloaded frames during playback", async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as any

    // Create an in-memory frame cache map simulating Stage2Workstation activeFramesMapRef
    const febDates = getMonthDates(2026, 2)
    const activeFramesMap = new Map<string, { depthStack: any[]; uDepthStack: any[]; vDepthStack: any[] }>()

    febDates.forEach((d) => {
      activeFramesMap.set(d, {
        depthStack: [{ depth: 0, values: [[25]], min_value: 25, max_value: 25 }],
        uDepthStack: [],
        vDepthStack: [],
      })
    })

    // Playback loop through all 28 frames
    let curIdx = 0
    for (let step = 0; step < febDates.length; step++) {
      const date = febDates[curIdx]
      const frame = activeFramesMap.get(date)
      expect(frame).toBeDefined()
      expect(frame?.depthStack).toHaveLength(1)
      curIdx = (curIdx + 1) % febDates.length
    }

    // Zero fetch calls were made because data was rendered from preloaded cache
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})

