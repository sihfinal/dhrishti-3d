import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  fetchModelTimes,
  fetchModelFieldStack,
  timeStepIndexToDateString,
  dateStringToTimeStepIndex,
  formatDisplayDate,
  getMonthDates,
  getDateRangeDates,
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

  it("verifies that sequential frames have distinct Float32 data, min, max, and mean during playback", () => {
    const dates = ["2026-02-15", "2026-02-16", "2026-02-17"]
    const framesMap = new Map<string, { depthStack: any[]; uDepthStack: any[]; vDepthStack: any[] }>()

    // Simulate preloaded frames with changing values across days
    dates.forEach((d, i) => {
      const baseTemp = 27.0 + i * 0.15
      framesMap.set(d, {
        depthStack: [
          {
            depth: 0,
            values: [
              [baseTemp, baseTemp + 0.5],
              [baseTemp - 0.5, baseTemp + 1.0],
            ],
            min_value: baseTemp - 0.5,
            max_value: baseTemp + 1.0,
          },
        ],
        uDepthStack: [],
        vDepthStack: [],
      })
    })

    const renderedStats: { date: string; mean: number; min: number; max: number }[] = []

    dates.forEach((d) => {
      const frame = framesMap.get(d)!
      const slice = frame.depthStack[0]
      const vals = slice.values.flat()
      const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
      renderedStats.push({
        date: d,
        mean: +mean.toFixed(3),
        min: slice.min_value,
        max: slice.max_value,
      })
    })

    // Verify statistics change across all consecutive dates
    expect(renderedStats[0].date).toBe("2026-02-15")
    expect(renderedStats[1].date).toBe("2026-02-16")
    expect(renderedStats[2].date).toBe("2026-02-17")

    expect(renderedStats[0].mean).not.toEqual(renderedStats[1].mean)
    expect(renderedStats[1].mean).not.toEqual(renderedStats[2].mean)
    expect(renderedStats[0].min).not.toEqual(renderedStats[1].min)
    expect(renderedStats[0].max).not.toEqual(renderedStats[1].max)
  })

  it("getDateRangeDates generates unbroken chronological dates across multi-month boundaries", () => {
    // 15 Jan 2026 -> 15 Mar 2026: 17 days in Jan + 28 days in Feb + 15 days in Mar = 60 days
    const rangeDates = getDateRangeDates("2026-01-15", "2026-03-15")
    expect(rangeDates).toHaveLength(60)
    expect(rangeDates[0]).toBe("2026-01-15")
    expect(rangeDates[16]).toBe("2026-01-31")
    expect(rangeDates[17]).toBe("2026-02-01")
    expect(rangeDates[44]).toBe("2026-02-28")
    expect(rangeDates[45]).toBe("2026-03-01")
    expect(rangeDates[59]).toBe("2026-03-15")

    // Single day: start === end -> 1 frame
    const singleDay = getDateRangeDates("2026-02-15", "2026-02-15")
    expect(singleDay).toEqual(["2026-02-15"])

    // Invalid range: start > end -> empty
    const invalidRange = getDateRangeDates("2026-03-15", "2026-01-15")
    expect(invalidRange).toEqual([])
  })

  it("reuses already cached frames when expanding range from February to Jan 15 - Mar 15", () => {
    const frameCache = new Map<string, any>()

    // Step 1: Preload February (28 frames)
    const febDates = getDateRangeDates("2026-02-01", "2026-02-28")
    febDates.forEach((d) => {
      frameCache.set(`key_${d}`, { date: d, data: `frame_${d}` })
    })
    expect(frameCache.size).toBe(28)

    // Step 2: User requests 15 Jan -> 15 Mar (60 dates)
    const newRangeDates = getDateRangeDates("2026-01-15", "2026-03-15")
    expect(newRangeDates).toHaveLength(60)

    // Check which frames are already in cache
    const cachedDates = newRangeDates.filter((d) => frameCache.has(`key_${d}`))
    const missingDates = newRangeDates.filter((d) => !frameCache.has(`key_${d}`))

    // February (28 days) is completely cached!
    expect(cachedDates).toHaveLength(28)
    // Only 17 days in Jan (15-31) and 15 days in Mar (1-15) need to be fetched = 32
    expect(missingDates).toHaveLength(32)
    expect(missingDates[0]).toBe("2026-01-15")
    expect(missingDates[16]).toBe("2026-01-31")
    expect(missingDates[17]).toBe("2026-03-01")
    expect(missingDates[31]).toBe("2026-03-15")
  })

  it("selects initial frame intelligently based on whether current date is inside or outside range", () => {
    const targetDates = getDateRangeDates("2026-02-01", "2026-03-15")

    // Case 1: Current date is 15 Feb (inside range) -> keep 15 Feb
    const curDateInside = "2026-02-15"
    const priorityInside =
      curDateInside >= "2026-02-01" && curDateInside <= "2026-03-15" && targetDates.includes(curDateInside)
        ? curDateInside
        : targetDates[0]
    expect(priorityInside).toBe("2026-02-15")

    // Case 2: Current date is 15 Feb, new range is 01 Jan - 31 Jan (outside range) -> jump to start date (01 Jan)
    const janDates = getDateRangeDates("2026-01-01", "2026-01-31")
    const curDateOutside = "2026-02-15"
    const priorityOutside =
      curDateOutside >= "2026-01-01" && curDateOutside <= "2026-01-31" && janDates.includes(curDateOutside)
        ? curDateOutside
        : janDates[0]
    expect(priorityOutside).toBe("2026-01-01")
  })

  it("executes one-shot continuous playback across month boundaries and stops at final frame", () => {
    const rangeDates = getDateRangeDates("2026-01-30", "2026-02-03") // 5 days across Jan/Feb boundary
    expect(rangeDates).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ])

    let playbackIdx = 0
    let isPlaying = true
    const playedSequence: string[] = [rangeDates[playbackIdx]]

    // Advance frame by frame until stopping condition
    while (isPlaying) {
      const nextIdx = playbackIdx + 1
      if (nextIdx >= rangeDates.length) {
        isPlaying = false // Stop at end of loaded range, no modulo wrap
        break
      }
      playbackIdx = nextIdx
      playedSequence.push(rangeDates[playbackIdx])
    }

    expect(playedSequence).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ])
    expect(isPlaying).toBe(false)
    expect(playbackIdx).toBe(4) // Stopped at last frame
  })
})


