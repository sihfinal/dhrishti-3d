import * as THREE from "three"
import { ModelFieldResponse } from "./modelApi"
import { buildLut, PaletteId } from "./colormaps"

const volumeVertexShader = `
varying vec3 vPosition;
varying vec3 vLocalPos;

void main() {
  vLocalPos = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const volumeFragmentShader = `
precision highp float;
precision highp sampler3D;
precision highp sampler2D;

varying vec3 vPosition;
varying vec3 vLocalPos;

uniform sampler3D u_data;
uniform sampler2D u_colormap;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform vec3 u_invBoxSize;
uniform vec3 u_cameraPos;
uniform float u_opacity;
uniform int u_steps;

vec2 hitBox(vec3 orig, vec3 dir) {
  vec3 inv_dir = 1.0 / dir;
  vec3 tmin_tmp = (u_boxMin - orig) * inv_dir;
  vec3 tmax_tmp = (u_boxMax - orig) * inv_dir;
  vec3 tmin = min(tmin_tmp, tmax_tmp);
  vec3 tmax = max(tmin_tmp, tmax_tmp);
  float t0 = max(tmin.x, max(tmin.y, tmin.z));
  float t1 = min(tmax.x, min(tmax.y, tmax.z));
  return vec2(t0, t1);
}

void main() {
  vec3 rayDir = normalize(vPosition - u_cameraPos);
  vec2 bounds = hitBox(u_cameraPos, rayDir);

  if (bounds.x > bounds.y || bounds.y < 0.0) {
    discard;
  }

  bounds.x = max(bounds.x, 0.0);
  vec3 pStart = u_cameraPos + rayDir * bounds.x;

  // Invariant optimization: Total distance is directly (bounds.y - bounds.x) since rayDir is normalized
  float totalDist = bounds.y - bounds.x;
  if (totalDist <= 0.001) {
    discard;
  }

  int steps = u_steps;
  float stepSize = totalDist / float(steps);
  vec3 stepVec = rayDir * stepSize;

  // Optimized: March directly in UV texture space [0, 1]^3 using precomputed inverse box size
  vec3 uvStep = stepVec * u_invBoxSize;
  vec3 texCoord = (pStart + stepVec * 0.5 - u_boxMin) * u_invBoxSize;

  vec4 accColor = vec4(0.0);

  for (int i = 0; i < 96; i++) {
    if (i >= steps || accColor.a >= 0.92) break;

    vec4 sampleVal = texture(u_data, texCoord);
    float validMask = sampleVal.a;

    // Fast-path: Only valid ocean voxels require colormap lookup and alpha accumulation
    if (validMask > 0.5) {
      float scalar = sampleVal.r;
      vec4 col = texture(u_colormap, vec2(scalar, 0.5));
      float sampleAlpha = u_opacity * 0.06 * (0.3 + 0.7 * scalar);
      
      accColor.rgb += (1.0 - accColor.a) * col.rgb * sampleAlpha;
      accColor.a += (1.0 - accColor.a) * sampleAlpha;
    }

    texCoord += uvStep;
  }

  if (accColor.a <= 0.02) {
    discard;
  }

  gl_FragColor = accColor;
}
`

export interface VolumeMeshHandle {
  mesh: THREE.Mesh
  updateCameraPos: (camPos: THREE.Vector3) => void
  updateData: (depthStack: ModelFieldResponse[], palette?: PaletteId) => boolean
  updatePalette: (palette: PaletteId) => void
  updateOpacity: (opacity: number) => void
  updateBounds: (planeW: number, planeH: number, maxZDepth: number) => void
  setInteractive: (interactive: boolean) => void
  dispose: () => void
  width: number
  height: number
  depthCount: number
}

/**
 * Creates or updates a GPU Ray-Marching 3D Volume Mesh from real multi-depth NetCDF model slices.
 * Reuses Data3DTexture and shader allocations in place whenever grid dimensions match.
 */
export function createVolumeMesh(
  depthStack: ModelFieldResponse[],
  palette: PaletteId,
  planeW: number,
  planeH: number,
  maxZDepth: number,
  existingHandle?: VolumeMeshHandle | null
): VolumeMeshHandle | null {
  if (!depthStack || depthStack.length < 2) {
    if (existingHandle) existingHandle.dispose()
    return null
  }

  const dCount = depthStack.length
  const hCount = depthStack[0]?.height || 0
  const wCount = depthStack[0]?.width || 0
  if (hCount === 0 || wCount === 0) {
    if (existingHandle) existingHandle.dispose()
    return null
  }

  // Reuse compatible existing volume allocation
  if (
    existingHandle &&
    existingHandle.width === wCount &&
    existingHandle.height === hCount &&
    existingHandle.depthCount === dCount
  ) {
    existingHandle.updateBounds(planeW, planeH, maxZDepth)
    existingHandle.updateData(depthStack, palette)
    return existingHandle
  }

  // If existing handle has incompatible dimensions, dispose old resources safely
  if (existingHandle) {
    existingHandle.dispose()
  }

  // 1. Build 3D Data Texture from actual scalar values
  let globalMin = Infinity
  let globalMax = -Infinity
  for (const slice of depthStack) {
    if (slice.min_value != null && slice.min_value < globalMin) globalMin = slice.min_value
    if (slice.max_value != null && slice.max_value > globalMax) globalMax = slice.max_value
  }
  if (!isFinite(globalMin)) globalMin = 0
  if (!isFinite(globalMax)) globalMax = 1
  const span = globalMax - globalMin || 1

  // 3D Texture array (RGBA format: R = normalized scalar, A = 255 valid / 0 invalid)
  const texData = new Uint8Array(wCount * hCount * dCount * 4)

  const populateTexData = (stack: ModelFieldResponse[], gMin: number, gSpan: number) => {
    for (let z = 0; z < dCount; z++) {
      const sliceIdx = z
      const slice = stack[sliceIdx]
      const vals = slice?.values || []

      for (let r = 0; r < hCount; r++) {
        const latIdx = hCount - 1 - r
        const row = vals[latIdx] || []

        for (let c = 0; c < wCount; c++) {
          const val = row[c]
          const pxIdx = (z * (hCount * wCount) + r * wCount + c) * 4

          if (val === null || val === undefined || isNaN(val)) {
            texData[pxIdx] = 0
            texData[pxIdx + 1] = 0
            texData[pxIdx + 2] = 0
            texData[pxIdx + 3] = 0 // Land / NaN
          } else {
            const norm = Math.max(0, Math.min(1, (val - gMin) / gSpan))
            texData[pxIdx] = Math.round(norm * 255)
            texData[pxIdx + 1] = 0
            texData[pxIdx + 2] = 0
            texData[pxIdx + 3] = 255 // Valid ocean
          }
        }
      }
    }
  }

  populateTexData(depthStack, globalMin, span)

  const data3DTexture = new THREE.Data3DTexture(texData, wCount, hCount, dCount)
  data3DTexture.format = THREE.RGBAFormat
  data3DTexture.type = THREE.UnsignedByteType
  data3DTexture.minFilter = THREE.NearestFilter
  data3DTexture.magFilter = THREE.NearestFilter
  data3DTexture.generateMipmaps = false
  data3DTexture.wrapS = THREE.ClampToEdgeWrapping
  data3DTexture.wrapT = THREE.ClampToEdgeWrapping
  data3DTexture.wrapR = THREE.ClampToEdgeWrapping
  data3DTexture.needsUpdate = true

  // 2. Build Colormap 2D Texture (256x1 RGBA)
  const cmapData = new Uint8Array(256 * 4)
  const populateCmap = (pal: PaletteId | string) => {
    const safePal = (pal === "viridis" || pal === "plasma" ? pal : "turbo") as PaletteId
    const lut = buildLut(safePal, 256)
    for (let i = 0; i < 256; i++) {
      cmapData[i * 4] = lut[i * 3]
      cmapData[i * 4 + 1] = lut[i * 3 + 1]
      cmapData[i * 4 + 2] = lut[i * 3 + 2]
      cmapData[i * 4 + 3] = 255
    }
  }
  populateCmap(palette)

  let activePalette = palette
  const colormapTexture = new THREE.DataTexture(cmapData, 256, 1, THREE.RGBAFormat)
  colormapTexture.minFilter = THREE.LinearFilter
  colormapTexture.magFilter = THREE.LinearFilter
  colormapTexture.needsUpdate = true

  // 3. Create Persistent Unit Bounding Volume Geometry and Shader Material
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)

  const uniforms = {
    u_data: { value: data3DTexture },
    u_colormap: { value: colormapTexture },
    u_boxMin: { value: new THREE.Vector3(-planeW / 2, -maxZDepth, -planeH / 2) },
    u_boxMax: { value: new THREE.Vector3(planeW / 2, 0, planeH / 2) },
    u_invBoxSize: { value: new THREE.Vector3(1 / planeW, 1 / maxZDepth, 1 / planeH) },
    u_cameraPos: { value: new THREE.Vector3(0, 0, 20) },
    u_opacity: { value: 0.75 },
    u_steps: { value: 64 },
  }

  const shaderMat = new THREE.ShaderMaterial({
    vertexShader: volumeVertexShader,
    fragmentShader: volumeFragmentShader,
    uniforms: uniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(boxGeo, shaderMat)
  mesh.scale.set(planeW, maxZDepth, planeH)
  mesh.position.set(0, -maxZDepth / 2, 0)

  const updateCameraPos = (camPos: THREE.Vector3) => {
    uniforms.u_cameraPos.value.copy(camPos)
  }

  const updatePalette = (newPalette: PaletteId) => {
    if (newPalette === activePalette) return
    activePalette = newPalette
    populateCmap(newPalette)
    colormapTexture.needsUpdate = true
  }

  const updateOpacity = (opacity: number) => {
    uniforms.u_opacity.value = opacity
  }

  const updateBounds = (newW: number, newH: number, newDepth: number) => {
    uniforms.u_boxMin.value.set(-newW / 2, -newDepth, -newH / 2)
    uniforms.u_boxMax.value.set(newW / 2, 0, newH / 2)
    uniforms.u_invBoxSize.value.set(1 / newW, 1 / newDepth, 1 / newH)
    mesh.scale.set(newW, newDepth, newH)
    mesh.position.set(0, -newDepth / 2, 0)
  }

  const setInteractive = (interactive: boolean) => {
    uniforms.u_steps.value = interactive ? 32 : 64
  }

  const updateData = (newStack: ModelFieldResponse[], newPalette?: PaletteId): boolean => {
    let gMin = Infinity
    let gMax = -Infinity
    for (const slice of newStack) {
      if (slice.min_value != null && slice.min_value < gMin) gMin = slice.min_value
      if (slice.max_value != null && slice.max_value > gMax) gMax = slice.max_value
    }
    if (!isFinite(gMin)) gMin = 0
    if (!isFinite(gMax)) gMax = 1
    const gSpan = gMax - gMin || 1

    populateTexData(newStack, gMin, gSpan)
    data3DTexture.needsUpdate = true

    if (newPalette) {
      updatePalette(newPalette)
    }
    return true
  }

  const dispose = () => {
    boxGeo.dispose()
    shaderMat.dispose()
    data3DTexture.dispose()
    colormapTexture.dispose()
  }

  return {
    mesh,
    updateCameraPos,
    updateData,
    updatePalette,
    updateOpacity,
    updateBounds,
    setInteractive,
    dispose,
    width: wCount,
    height: hCount,
    depthCount: dCount,
  }
}
