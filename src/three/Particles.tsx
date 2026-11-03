import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { flame, puff } from './textures'

/* ───────────── falling snow that always surrounds the camera (wrapped in a shader) ───────────── */
const snowVert = /* glsl */ `
  uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform float uSize; uniform float uDpr; uniform float uWind;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y -= uTime * (1.4 + aSeed * 1.8);
    p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.9 + uTime * uWind;
    p.z += cos(uTime * 0.5 + aSeed * 23.0) * 0.7;
    vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = modelViewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.001, -mv.z);
    gl_PointSize = uSize * (0.5 + aSeed) * uDpr * (36.0 / dist);
    vAlpha = smoothstep(uBox * 0.5, uBox * 0.25, length(rel)) * smoothstep(0.4, 2.5, dist);
  }`
const snowFrag = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.93, 0.96, 1.0, a * 0.95);
  }`

export function Snow({ count }: { count: number }) {
  const { camera, gl } = useThree()
  const mat = useRef<THREE.ShaderMaterial>(null)
  const box = 70
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * box
      pos[i * 3 + 1] = Math.random() * box
      pos[i * 3 + 2] = Math.random() * box
      seed[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uSize: { value: 3.2 }, uDpr: { value: gl.getPixelRatio() }, uWind: { value: 0.6 } }),
    [gl],
  )
  useFrame((_, dt) => {
    if (!mat.current) return
    mat.current.uniforms.uTime.value += Math.min(dt, 0.05)
    mat.current.uniforms.uCam.value.copy(camera.position)
  })
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={10}>
      <shaderMaterial ref={mat} vertexShader={snowVert} fragmentShader={snowFrag} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  )
}

/* ───────────── generic rising particles (embers, smoke) with per-particle life ───────────── */
const lifeVert = /* glsl */ `
  attribute float aLife; attribute float aSize;
  uniform float uDpr; uniform float uGrow;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (1.0 + aLife * uGrow) * uDpr * (220.0 / max(0.001, -mv.z));
  }`
const lifeFrag = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
  varying float vLife;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * uOpacity * smoothstep(0.0, 0.15, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor * t.rgb, a);
  }`

type Emitter = { origins: THREE.Vector3[]; perOrigin: number; rise: number; spread: number; life: number; size: number }

function useLifeParticles({ origins, perOrigin, rise, spread, life, size }: Emitter) {
  return useMemo(() => {
    const n = origins.length * perOrigin
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const lifeA = new Float32Array(n)
    const sizeA = new Float32Array(n)
    const vel = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      lifeA[i] = Math.random()
      sizeA[i] = size * (0.6 + Math.random() * 0.8)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aLife', new THREE.BufferAttribute(lifeA, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizeA, 1))
    const respawn = (i: number) => {
      const o = origins[Math.floor(i / perOrigin)]
      pos[i * 3] = o.x + (Math.random() - 0.5) * 0.3
      pos[i * 3 + 1] = o.y
      pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * 0.3
      vel[i * 3] = (Math.random() - 0.5) * spread
      vel[i * 3 + 1] = rise * (0.6 + Math.random() * 0.8)
      vel[i * 3 + 2] = (Math.random() - 0.5) * spread
    }
    for (let i = 0; i < n; i++) {
      respawn(i)
      // pre-age so the plume is already formed
      const age = lifeA[i] * life
      pos[i * 3] += vel[i * 3] * age
      pos[i * 3 + 1] += vel[i * 3 + 1] * age
      pos[i * 3 + 2] += vel[i * 3 + 2] * age
    }
    const step = (dt: number, windX: number) => {
      for (let i = 0; i < n; i++) {
        lifeA[i] += dt / life
        if (lifeA[i] >= 1) {
          lifeA[i] = 0
          respawn(i)
        }
        pos[i * 3] += (vel[i * 3] + windX) * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      }
      g.attributes.position.needsUpdate = true
      g.attributes.aLife.needsUpdate = true
    }
    return { geometry: g, step }
  }, [origins, perOrigin, rise, spread, life, size])
}

export function ChimneySmoke({ origins }: { origins: THREE.Vector3[] }) {
  const { gl } = useThree()
  const { geometry, step } = useLifeParticles({ origins, perOrigin: 7, rise: 1.3, spread: 0.5, life: 6, size: 1.6 })
  const uniforms = useMemo(() => ({ uMap: { value: puff('rgba(200,212,235,1)') }, uColor: { value: new THREE.Color('#aab6cc') }, uOpacity: { value: 0.32 }, uDpr: { value: gl.getPixelRatio() }, uGrow: { value: 2.2 } }), [gl])
  useFrame((_, dt) => step(Math.min(dt, 0.05), 0.35))
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial vertexShader={lifeVert} fragmentShader={lifeFrag} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  )
}

export function Bonfire({ at }: { at: THREE.Vector3 }) {
  const { gl } = useThree()
  const light = useRef<THREE.PointLight>(null)
  const flames = useRef<THREE.Group>(null)
  const origins = useMemo(() => [at.clone().add(new THREE.Vector3(0, 0.6, 0))], [at])
  const embers = useLifeParticles({ origins, perOrigin: 70, rise: 2.6, spread: 1.2, life: 2.4, size: 0.12 })
  const emberUniforms = useMemo(() => ({ uMap: { value: puff() }, uColor: { value: new THREE.Color(3, 1.6, 0.6) }, uOpacity: { value: 1 }, uDpr: { value: gl.getPixelRatio() }, uGrow: { value: -0.6 } }), [gl])
  const flameMat = useMemo(() => new THREE.SpriteMaterial({ map: flame(), color: new THREE.Color(2.2, 1.5, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), [])
  const tongues = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: (i - 2) * 0.32, s: 1 + Math.random() * 0.6, ph: Math.random() * 10 })), [])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    embers.step(Math.min(dt, 0.05), 0.2)
    if (light.current) light.current.intensity = 140 + Math.sin(t * 13) * 18 + Math.sin(t * 7.3) * 26 + Math.random() * 14
    flames.current?.children.forEach((s, i) => {
      const k = tongues[i]
      const h = 2.4 * k.s * (0.85 + 0.2 * Math.sin(t * 9 + k.ph) + 0.1 * Math.sin(t * 23 + k.ph))
      s.scale.set(1.2 * k.s, h, 1)
      s.position.set(k.x + Math.sin(t * 5 + k.ph) * 0.06, h / 2 + 0.25, 0)
    })
  })
  return (
    <group position={at}>
      <pointLight ref={light} color="#ff8a3d" intensity={150} distance={42} decay={1.6} position={[0, 1.6, 0]} />
      <group ref={flames}>
        {tongues.map((_, i) => <sprite key={i} material={flameMat} />)}
      </group>
      <points geometry={embers.geometry} frustumCulled={false} position={[-at.x, -at.y, -at.z]}>
        <shaderMaterial vertexShader={lifeVert} fragmentShader={lifeFrag} uniforms={emberUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

/* ───────────── sky dome, stars, moon ───────────── */
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const skyFrag = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uMoonDir;
  void main() {
    float h = clamp(vDir.y * 1.1 + 0.05, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.7));
    float m = max(dot(normalize(vDir), normalize(uMoonDir)), 0.0);
    col += uGlow * pow(m, 18.0) * 0.55 + uGlow * pow(m, 280.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }`

export const MOON_DIR = new THREE.Vector3(-0.5, 0.07, 1).normalize()

export function Sky() {
  const uniforms = useMemo(() => ({
    uTop: { value: new THREE.Color('#0b1735') },
    uHorizon: { value: new THREE.Color('#1f3566') },
    uGlow: { value: new THREE.Color('#8fb2ff') },
    uMoonDir: { value: MOON_DIR },
  }), [])
  const stars = useMemo(() => {
    const n = 1600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(1500)
      pos.set([v.x, v.y, v.z], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const moonTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.36, 'rgba(240,246,255,1)')
    g.addColorStop(0.4, 'rgba(200,220,255,0.35)')
    g.addColorStop(1, 'rgba(160,190,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = 'rgba(180,195,225,0.35)'
    for (const [x, y, r] of [[110, 105, 12], [150, 140, 9], [120, 150, 6], [140, 108, 5]]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const { camera } = useThree()
  const group = useRef<THREE.Group>(null)
  useFrame(() => group.current?.position.copy(camera.position))
  return (
    <group ref={group}>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[1800, 32, 16]} />
        <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <points geometry={stars} renderOrder={-9}>
        <pointsMaterial size={2.1} sizeAttenuation={false} color="#dfe9ff" transparent opacity={0.85} fog={false} depthWrite={false} />
      </points>
      <sprite position={MOON_DIR.clone().multiplyScalar(1400)} scale={[95, 95, 1]} renderOrder={-8}>
        <spriteMaterial map={moonTex} color={new THREE.Color(1.6, 1.7, 1.9)} fog={false} toneMapped={false} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}
