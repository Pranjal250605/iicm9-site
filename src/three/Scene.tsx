import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { cups } from '../data/cups'
import { CAM_PROGRESS, journey, quantize } from '../journey/store'
import { smoothstep } from '../lib/motion'
import { Bonfire, ChimneySmoke, MOON_DIR, Sky, Snow } from './Particles'
import { cupSign, gateSign, stageScreen } from './textures'

type Rig = {
  cam: THREE.CatmullRomCurve3
  look: THREE.CatmullRomCurve3
  lamps: THREE.Vector3[]
  chimneys: THREE.Vector3[]
  fire: THREE.Vector3
  cupWin: { mat: THREE.MeshStandardMaterial; signMat: THREE.MeshStandardMaterial; center: THREE.Vector3 }[]
}

const FOG = new THREE.Color('#1f3566')

function useVillage(url: string) {
  const gltf = useGLTF(url, '/draco/')
  return useMemo<Rig>(() => {
    const scene = gltf.scene
    scene.updateMatrixWorld(true)
    const byName = (n: string) => scene.getObjectByName(n)
    const wp = (n: string) => byName(n)!.getWorldPosition(new THREE.Vector3())

    const cam: THREE.Vector3[] = []
    const look: THREE.Vector3[] = []
    for (let i = 0; i < CAM_PROGRESS.length; i++) {
      const k = String(i).padStart(2, '0')
      cam.push(wp(`Cam_${k}`))
      look.push(wp(`Look_${k}`))
    }

    const lamps: THREE.Vector3[] = []
    const chimneys: THREE.Vector3[] = []
    scene.traverse((o) => {
      if (o.name.startsWith('Lamp_')) lamps.push(o.getWorldPosition(new THREE.Vector3()))
      if (o.name.startsWith('Chimney_')) chimneys.push(o.getWorldPosition(new THREE.Vector3()))
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if ((mats[0] as THREE.Material).name === 'Bulb') {
        // festoon bulbs: unlit, vertex-coloured, pushed past 1.0 so bloom picks them up
        mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.3, 2.2), toneMapped: false })
        return
      }
      const big = mesh.name === 'Terrain' || mesh.name === 'Mountains'
      const lit = !['Window', 'Lamp'].includes((mats[0] as THREE.Material).name)
      mesh.castShadow = lit && !big
      mesh.receiveShadow = lit
      for (const m of mats as THREE.MeshStandardMaterial[]) {
        // the GLB ships without normals; facets come from screen-space derivatives
        m.flatShading = true
        m.side = THREE.DoubleSide
        m.roughness = 1
        m.metalness = 0
        m.needsUpdate = true
        if (m.name === 'Window') {
          m.emissive.set('#ffa04a')
          m.emissiveIntensity = 2.2
          m.color.set('#ffb35c')
        } else if (m.name === 'Lamp') {
          m.emissive.set('#ffd08a')
          m.emissiveIntensity = 3.2
        }
      }
    })

    const plate = (name: string, tex: THREE.Texture, glow: number) => {
      const mesh = byName(name) as THREE.Mesh | undefined
      if (!mesh) return null
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: glow, roughness: 0.9, flatShading: true })
      mesh.material = m
      return m
    }
    plate('GateSign', gateSign(), 0.9)
    plate('StageScreen', stageScreen(), 1.4)

    const cupWin = cups.map((c, i) => {
      const k = String(i + 1).padStart(2, '0')
      const win = byName(`CupWin_${k}`) as THREE.Mesh
      const mat = (win.material as THREE.MeshStandardMaterial).clone()
      win.material = mat
      const sign = byName(`Sign_${k}`) as THREE.Mesh
      const signMat = plate(`Sign_${k}`, cupSign(i + 1, c.short), 0.5)!
      sign.geometry.computeBoundingBox()
      const center = sign.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(sign.matrixWorld)
      return { mat, signMat, center }
    })

    return {
      cam: new THREE.CatmullRomCurve3(cam, false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(look, false, 'centripetal'),
      lamps,
      chimneys,
      fire: wp('FireAnchor'),
      cupWin,
    }
  }, [gltf])
}

function progressToT(p: number) {
  const n = CAM_PROGRESS.length
  for (let i = 0; i < n - 1; i++) {
    const a = CAM_PROGRESS[i]
    const b = CAM_PROGRESS[i + 1]
    if (p <= b) return (i + (p - a) / (b - a)) / (n - 1)
  }
  return 1
}

const SHADOW_DIR = new THREE.Vector3(-0.45, 0.82, 0.38).normalize()

function MoonShadow({ enabled }: { enabled: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const { camera, scene } = useThree()
  const fwd = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    if (light.current) scene.add(light.current.target)
  }, [scene])
  useFrame(() => {
    const L = light.current
    if (!L) return
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    // keep the shadow frustum centred just ahead of the camera, on the ground
    const c = L.target.position.copy(camera.position).addScaledVector(fwd, 26)
    c.y = 0
    L.position.copy(c).addScaledVector(SHADOW_DIR, 140)
    L.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      color="#b9c9ff"
      intensity={1.15}
      castShadow={enabled}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0006}
      shadow-camera-left={-55}
      shadow-camera-right={55}
      shadow-camera-top={55}
      shadow-camera-bottom={-55}
      shadow-camera-near={10}
      shadow-camera-far={320}
    />
  )
}

function CameraRig({ rig }: { rig: Rig }) {
  const { camera, scene } = useThree()
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tgt = useMemo(() => new THREE.Vector3(), [])
  const sway = useRef({ x: 0, y: 0 })
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const fog = useMemo(() => new THREE.FogExp2(FOG, 0.003), [])

  useEffect(() => {
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, fog])

  useFrame(({ clock }) => {
    const raw = journey.progress
    const p = journey.reduced ? quantize(raw) : raw
    const t = progressToT(p)
    rig.cam.getPoint(t, pos)
    rig.look.getPoint(t, tgt)

    if (!journey.reduced) {
      sway.current.x += (journey.pointer.x - sway.current.x) * 0.04
      sway.current.y += (journey.pointer.y - sway.current.y) * 0.04
      const amt = 0.6 + smoothstep(0.3, 0, p) * 3
      tgt.x -= sway.current.x * amt
      tgt.y -= sway.current.y * amt * 0.5
      pos.y += Math.sin(clock.elapsedTime * 0.6) * 0.06
    }
    camera.position.copy(pos)
    camera.lookAt(tgt)

    // fog: thin up high, thicker in the street, lifts again for the aerial
    fog.density = 0.0024 + smoothstep(0.12, 0.3, p) * 0.0085 - smoothstep(0.86, 1, p) * 0.0072

    // cup cabins glow as the camera walks past
    for (const c of rig.cupWin) {
      const ahead = c.center.z - pos.z
      const near = Math.max(0, 1 - Math.abs(ahead - 7) / 15)
      const k = smoothstep(0, 1, near)
      c.mat.emissiveIntensity = 1.4 + k * 4.5
      c.signMat.emissiveIntensity = 0.35 + k * 1.1
    }

    // 4 travelling point lights borrow the nearest lamp positions
    const sorted = rig.lamps.map((l) => [l.distanceToSquared(pos), l] as const).sort((a, b) => a[0] - b[0])
    lights.current.forEach((L, i) => {
      if (!L) return
      const s = sorted[i]
      if (!s) return
      L.position.copy(s[1])
      L.intensity = 16 * (1 - smoothstep(900, 3600, s[0])) * smoothstep(4, 30, s[0])
    })
  })

  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <pointLight key={i} ref={(el) => { lights.current[i] = el }} color="#ffc27a" intensity={0} distance={22} decay={1.4} />
      ))}
    </>
  )
}

function World({ url, mobile, onReady }: { url: string; mobile: boolean; onReady: () => void }) {
  const gltf = useGLTF(url, '/draco/')
  const rig = useVillage(url)
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady))
    return () => cancelAnimationFrame(id)
  }, [onReady])
  return (
    <>
      <primitive object={gltf.scene} />
      <CameraRig rig={rig} />
      <hemisphereLight args={['#9db6ff', '#26365e', 1.05]} />
      <MoonShadow enabled={!mobile} />
      <directionalLight color="#8fa6e6" intensity={0.25} position={MOON_DIR.clone().multiplyScalar(300).setY(200)} />
      <ambientLight intensity={0.18} color="#9fb6ff" />
      <Sky />
      <Snow count={mobile ? 1800 : 6000} />
      <ChimneySmoke origins={rig.chimneys} />
      <Bonfire at={rig.fire} />
    </>
  )
}

export default function Scene({ url, mobile, onReady }: { url: string; mobile: boolean; onReady: () => void }) {
  return (
    <Canvas
      shadows={mobile ? false : 'soft'}
      dpr={mobile ? [1, 1.25] : [1, 1.6]}
      gl={{ antialias: mobile, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: mobile ? 62 : 50, near: 0.3, far: 3000, position: [0, 110, -230] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.3
      }}
    >
      <color attach="background" args={['#0b1426']} />
      <World url={url} mobile={mobile} onReady={onReady} />
      {!mobile && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.62} luminanceSmoothing={0.2} radius={0.7} />
          <Vignette offset={0.25} darkness={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
