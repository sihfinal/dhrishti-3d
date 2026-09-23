"use client"

/**
 * Shared cinematic globe (landing hero + explore globe view).
 * Rotating earth with fresnel atmosphere rim, starfield, and a pulsing
 * marker over the Indian Ocean ROI.
 *
 * Dive animation: while `diving` is true the camera swoops from orbit down
 * into the ROI marker; onDiveComplete fires when it reaches the surface so
 * the host can crossfade to the volumetric view.
 */
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Stars, useTexture } from "@react-three/drei"
import { useOcean } from "@/lib/store"

const EARTH_TEXTURE = "/textures/earth_4k_v3.jpg"

// Indian Ocean ROI center
const ROI_LAT = -2.5
const ROI_LON = 70

function roiToVec3(radius: number): THREE.Vector3 {
  const phi = (90 - ROI_LAT) * (Math.PI / 180)
  const theta = (ROI_LON + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

const ATMO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ATMO_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    float fres = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
    gl_FragColor = vec4(uColor, clamp(fres * uIntensity, 0.0, 1.0));
  }
`

export default function GlobeCanvas({
  onSelectRoi,
  onDiveComplete,
  diving = false,
  cameraZ = 5.6,
}: {
  onSelectRoi?: () => void
  onDiveComplete?: () => void
  /** start the cinematic dive into the ROI */
  diving?: boolean
  cameraZ?: number
}) {
  const theme = useOcean((s) => s.theme)
  return (
    <Canvas
      camera={{ position: [0, 0.55, cameraZ], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={theme === "dark" ? 0.25 : 0.55} />
      <directionalLight position={[5, 3, 5]} intensity={theme === "dark" ? 1.6 : 1.7} color="#cfe8ff" />
      {theme === "dark" ? (
        /* Night starfield — original dark mode */
        <Stars radius={70} depth={35} count={2800} factor={3} fade speed={0.6} />
      ) : (
        /* Ocean sparkle / atmospheric depth particles for light mode */
        <Stars radius={80} depth={25} count={900} factor={1.4} fade speed={0.25} />
      )}
      <Suspense fallback={null}>
        <TexturedGlobe
          onSelectRoi={onSelectRoi}
          onDiveComplete={onDiveComplete}
          diving={diving}
        />
      </Suspense>
    </Canvas>
  )
}

/** ease-in-out cubic */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function TexturedGlobe({
  onSelectRoi,
  onDiveComplete,
  diving,
}: {
  onSelectRoi?: () => void
  onDiveComplete?: () => void
  diving: boolean
}) {
  const theme = useOcean((s) => s.theme)
  const tex = useTexture(EARTH_TEXTURE, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
  })
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const diveRef = useRef({ active: false, t: 0 })
  const camStartRef = useRef(new THREE.Vector3())
  const doneRef = useRef(false)
  const camera = useThree((s) => s.camera)

  useFrame(({ camera }, dt) => {
    if (groupRef.current && !diveRef.current.active)
      groupRef.current.rotation.y += dt * 0.05

    // freeze ring pulse at max glow during the dive
    const ring = ringRef.current
    if (ring) {
      const t = Date.now() * 0.004
      ring.scale.setScalar(1 + Math.sin(t) * (diveRef.current.active ? 0.05 : 0.28))
      ;(ring.material as THREE.MeshBasicMaterial).opacity =
        0.5 + Math.sin(t) * (diveRef.current.active ? 0 : 0.4)
    }

    // ── dive animation ──
    const dive = diveRef.current
    if (dive.active && groupRef.current) {
      dive.t = Math.min(1, dive.t + dt / 1.5) // 1.5 s sweep
      const k = ease(dive.t)

      const markerWorld = roiToVec3(2.02)
      groupRef.current.localToWorld(markerWorld)

      // arc the camera toward the marker and plunge just above the surface
      const goal = markerWorld.clone().multiplyScalar(1.14)
      camera.position.lerpVectors(camStartRef.current, goal, k)
      camera.lookAt(markerWorld)

      // accelerate the globe spin slightly during descent for drama
      if (groupRef.current) groupRef.current.rotation.y += dt * 0.12 * k

      if (dive.t >= 1 && !doneRef.current) {
        doneRef.current = true
        onDiveComplete?.()
      }
    }
  })

  useEffect(() => {
    if (diving) {
      // capture the orbit position where the dive begins
      camStartRef.current = camStartRef.current.copy(camera.position)
      diveRef.current = { active: true, t: 0 }
      doneRef.current = false
    }
  }, [diving, camera])

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={tex}
          roughness={theme === "dark" ? 0.75 : 0.55}
          metalness={theme === "dark" ? 0.08 : 0.15}
          emissive={theme === "dark" ? "#000000" : "#0f2b4c"}
        />
      </mesh>
      {/* atmosphere rim */}
      <mesh scale={1.035}>
        <sphereGeometry args={[2, 48, 48]} />
        <shaderMaterial
          vertexShader={ATMO_VERTEX}
          fragmentShader={ATMO_FRAGMENT}
          uniforms={{
            uColor: { value: new THREE.Color(theme === "dark" ? "#3ec6ff" : "#5bb8ff") },
            uIntensity: { value: theme === "dark" ? (diving ? 2.0 : 1.25) : (diving ? 1.4 : 0.8) },
          }}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <RoiMarker onSelectRoi={onSelectRoi} ringRef={ringRef} />
    </group>
  )
}

function RoiMarker({
  onSelectRoi,
  ringRef,
}: {
  onSelectRoi?: () => void
  ringRef: React.RefObject<THREE.Mesh | null>
}) {
  const pos = useMemo(() => roiToVec3(2.02), [])
  const lookRef = useRef<THREE.Group>(null)

  // face the marker outward along the sphere normal
  useEffect(() => {
    lookRef.current?.lookAt(0, 0, 0)
  }, [])

  return (
    <group position={pos}>
      <group
        ref={lookRef}
        onClick={(e) => {
          e.stopPropagation()
          onSelectRoi?.()
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh ref={ringRef}>
          <ringGeometry args={[0.16, 0.24, 32]} />
          <meshBasicMaterial color="#f59e0b" transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.1, 24]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        {/* generous invisible hit area */}
        <mesh visible={false}>
          <circleGeometry args={[0.7, 16]} />
          <meshBasicMaterial side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
