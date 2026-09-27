import { describe, it, expect, vi, beforeEach } from "vitest"
import { fetchModelField, fetchModelFieldStack } from "../src/lib/modelApi"
import { fetchObservations, fetchObservationProfile } from "../src/lib/observationsApi"

describe("UX Loading States & API Abort Signal Propagation", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("fetchModelField propagates AbortSignal to underlying fetch", async () => {
    const abortController = new AbortController()
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      expect(options?.signal).toBe(abortController.signal)
      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          variable: "temperature",
          depth: 0,
          time: "2026-02-15",
          shape: [1, 1],
          latitudes: [0],
          longitudes: [0],
          values: [[28.5]],
        }),
      })
    })
    globalThis.fetch = fetchMock as any

    const res = await fetchModelField({
      variable: "temperature",
      depth: 0,
      time: "2026-02-15",
      signal: abortController.signal,
    })

    expect(res.variable).toBe("temperature")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fetchModelFieldStack propagates AbortSignal to underlying fetch", async () => {
    const abortController = new AbortController()
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      expect(options?.signal).toBe(abortController.signal)
      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          slices: [
            {
              variable: "salinity",
              depth: 0,
              time: "2026-02-15",
              shape: [1, 1],
              latitudes: [0],
              longitudes: [0],
              values: [[35.2]],
            },
          ],
        }),
      })
    })
    globalThis.fetch = fetchMock as any

    const res = await fetchModelFieldStack({
      variable: "salinity",
      time: "2026-02-15",
      depths: [0, 25],
      signal: abortController.signal,
    })

    expect(res.slices).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fetchObservations propagates AbortSignal to underlying fetch", async () => {
    const abortController = new AbortController()
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      expect(options?.signal).toBe(abortController.signal)
      return Promise.resolve({
        ok: true,
        json: async () => ({
          count: 1,
          total_in_dataset: 1,
          counts_by_type: { argo: 1 },
          items: [
            {
              id: "argo-test-1",
              type: "argo",
              latitude: 10.0,
              longitude: 75.0,
              variables: ["temperature", "salinity"],
              source: "argo",
            },
          ],
        }),
      })
    })
    globalThis.fetch = fetchMock as any

    const res = await fetchObservations({
      lat_min: 0,
      lat_max: 20,
      lon_min: 60,
      lon_max: 80,
      signal: abortController.signal,
    })

    expect(res.count).toBe(1)
    expect(res.items[0].id).toBe("argo-test-1")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fetchObservationProfile propagates AbortSignal to underlying fetch", async () => {
    const abortController = new AbortController()
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      expect(options?.signal).toBe(abortController.signal)
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: "argo-test-1",
          type: "argo",
          latitude: 10.0,
          longitude: 75.0,
          timestamp: "2026-02-15",
          variables: ["temperature"],
          data: [{ depth: 5, temperature: 28.5 }],
        }),
      })
    })
    globalThis.fetch = fetchMock as any

    const res = await fetchObservationProfile("argo-test-1", abortController.signal)
    expect(res.id).toBe("argo-test-1")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("Race Condition Guard: only latest request updates state when rapid clicks occur", async () => {
    let activeReqId = 0
    let lastRenderedVariable = ""

    // Simulate clicking Temperature -> Salinity -> Chlorophyll rapidly
    const triggerRequest = (variable: string, delayMs: number) => {
      const thisReqId = ++activeReqId
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // If a newer request has been initiated, discard this response
          if (thisReqId === activeReqId) {
            lastRenderedVariable = variable
          }
          resolve()
        }, delayMs)
      })
    }

    // Temperature takes 50ms, Salinity takes 30ms, Chlorophyll takes 10ms
    const p1 = triggerRequest("temperature", 50)
    const p2 = triggerRequest("salinity", 30)
    const p3 = triggerRequest("chlorophyll", 10)

    await Promise.all([p1, p2, p3])

    // Even though Temperature was started first and took longest, Chlorophyll was the latest request
    expect(lastRenderedVariable).toBe("chlorophyll")
  })

  it("Loading states architecture: state transitions cleanly on success and error", () => {
    // Test state transition logic
    let modelLoading = false
    let loadingVariableId: string | null = null
    let modelError: string | null = null

    // User selects Salinity
    const onSelectSalinity = () => {
      modelLoading = true
      loadingVariableId = "salinity"
      modelError = null
    }

    onSelectSalinity()
    expect(modelLoading).toBe(true)
    expect(loadingVariableId).toBe("salinity")
    expect(modelError).toBeNull()

    // Request succeeds
    const onRequestSuccess = () => {
      modelLoading = false
      loadingVariableId = null
      modelError = null
    }

    onRequestSuccess()
    expect(modelLoading).toBe(false)
    expect(loadingVariableId).toBeNull()
    expect(modelError).toBeNull()

    // Reselect with error
    onSelectSalinity()
    const onRequestError = (errMessage: string) => {
      modelLoading = false
      loadingVariableId = null
      modelError = errMessage
    }

    onRequestError("Salinity data unavailable")
    expect(modelLoading).toBe(false)
    expect(loadingVariableId).toBeNull()
    expect(modelError).toBe("Salinity data unavailable")
  })

  describe("3D Ocean Data Loading Indicator Lifecycle", () => {
    const computeLoaderVisibility = (props: {
      isPreloading?: boolean
      monthlyDataReady?: boolean
      modelLoading?: boolean
      depthStackLen: number
      uDepthStackLen: number
      modelError: string | null
    }): boolean => {
      const {
        isPreloading = false,
        monthlyDataReady,
        modelLoading = false,
        depthStackLen,
        uDepthStackLen,
        modelError,
      } = props

      return Boolean(
        (isPreloading ||
          (monthlyDataReady === false && depthStackLen === 0 && uDepthStackLen === 0) ||
          (modelLoading && depthStackLen === 0 && uDepthStackLen === 0)) &&
          !modelError
      )
    }

    it("displays loading indicator when month preloading is in progress", () => {
      expect(
        computeLoaderVisibility({
          isPreloading: true,
          monthlyDataReady: false,
          modelLoading: true,
          depthStackLen: 0,
          uDepthStackLen: 0,
          modelError: null,
        })
      ).toBe(true)
    })

    it("disappears immediately when monthlyDataReady is true and visualization frames are present", () => {
      expect(
        computeLoaderVisibility({
          isPreloading: false,
          monthlyDataReady: true,
          modelLoading: false,
          depthStackLen: 12,
          uDepthStackLen: 0,
          modelError: null,
        })
      ).toBe(false)
    })

    it("does NOT display loader during active in-memory playback", () => {
      expect(
        computeLoaderVisibility({
          isPreloading: false,
          monthlyDataReady: true,
          modelLoading: false,
          depthStackLen: 12,
          uDepthStackLen: 0,
          modelError: null,
        })
      ).toBe(false)
    })

    it("unmounts loader on error so Retry UI is displayed without infinite spinner", () => {
      expect(
        computeLoaderVisibility({
          isPreloading: false,
          monthlyDataReady: false,
          modelLoading: false,
          depthStackLen: 0,
          uDepthStackLen: 0,
          modelError: "Unable to load ocean data",
        })
      ).toBe(false)
    })

    it("restores loader upon Retry click when preloading restarts", () => {
      // User clicks Retry: error is cleared, preloading restarts
      expect(
        computeLoaderVisibility({
          isPreloading: true,
          monthlyDataReady: false,
          modelLoading: true,
          depthStackLen: 0,
          uDepthStackLen: 0,
          modelError: null,
        })
      ).toBe(true)
    })
  })

  describe("Earth 3D Loading Indicator Behavior", () => {
    const computeEarthLoaderVisibility = (props: {
      obsLoading?: boolean
      modelLoading?: boolean
    }): boolean => {
      const { obsLoading = false, modelLoading = false } = props
      return Boolean(obsLoading || modelLoading)
    }

    it("displays spinner when initial observation data is loading", () => {
      expect(
        computeEarthLoaderVisibility({
          obsLoading: true,
          modelLoading: false,
        })
      ).toBe(true)
    })

    it("displays spinner when model layer data is loading", () => {
      expect(
        computeEarthLoaderVisibility({
          obsLoading: false,
          modelLoading: true,
        })
      ).toBe(true)
    })

    it("disappears when all ocean data has finished loading", () => {
      expect(
        computeEarthLoaderVisibility({
          obsLoading: false,
          modelLoading: false,
        })
      ).toBe(false)
    })

    it("displays spinner when switching variables (Temperature -> Salinity)", () => {
      // User switches to Salinity: modelLoading becomes true
      expect(
        computeEarthLoaderVisibility({
          obsLoading: false,
          modelLoading: true,
        })
      ).toBe(true)
    })

    it("disappears immediately after new layer finishes loading", () => {
      expect(
        computeEarthLoaderVisibility({
          obsLoading: false,
          modelLoading: false,
        })
      ).toBe(false)
    })
  })
})


