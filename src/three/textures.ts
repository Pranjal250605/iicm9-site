import * as THREE from 'three'

const DISPLAY = '"Anton", Impact, sans-serif'
const SERIF = 'italic 400 {s}px "Gelasio", Georgia, serif'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // glTF UVs are top-left origin, so canvas rows must not be flipped
  t.flipY = false
  t.anisotropy = 4
  return t
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, maxW: number, start: number) {
  let s = start
  ctx.font = font(s)
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 4
    ctx.font = font(s)
  }
  return s
}

/** Carved-wood sign for a cup cabin. */
export function cupSign(num: number, name: string) {
  const [c, ctx] = canvas(1024, 320)
  const g = ctx.createLinearGradient(0, 0, 0, 320)
  g.addColorStop(0, '#3a2416')
  g.addColorStop(1, '#24150c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 320)
  ctx.globalAlpha = 0.12
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 2 ? '#000' : '#5a3a22'
    ctx.fillRect(0, i * 13 + Math.random() * 4, 1024, 2)
  }
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#ffb35c'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, 988, 284)
  ctx.fillStyle = '#ffb35c'
  ctx.font = `64px ${DISPLAY}`
  ctx.textBaseline = 'middle'
  ctx.fillText(String(num).padStart(2, '0'), 56, 162)
  ctx.fillStyle = '#fff1dc'
  const label = name.toUpperCase()
  fitText(ctx, label, (s) => `${s}px ${DISPLAY}`, 780, 150)
  ctx.textAlign = 'right'
  ctx.shadowColor = 'rgba(255,179,92,.55)'
  ctx.shadowBlur = 24
  ctx.fillText(label, 980, 168)
  return finish(c)
}

/** Banner across the gate lintel. */
export function gateSign() {
  const [c, ctx] = canvas(1024, 200)
  ctx.fillStyle = '#2b1b11'
  ctx.fillRect(0, 0, 1024, 200)
  ctx.strokeStyle = '#ffb35c'
  ctx.lineWidth = 5
  ctx.strokeRect(12, 12, 1000, 176)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff1dc'
  ctx.shadowColor = 'rgba(255,179,92,.6)'
  ctx.shadowBlur = 20
  ctx.font = `104px ${DISPLAY}`
  ctx.fillText('IICM 9.0', 512, 92)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffb35c'
  ctx.font = `30px ${DISPLAY}`
  ctx.fillText('WELCOME TO IIT MANDI', 512, 162)
  return finish(c)
}

/** Glowing screen on the square's stage. */
export function stageScreen() {
  const [c, ctx] = canvas(1024, 440)
  const g = ctx.createRadialGradient(512, 220, 40, 512, 220, 620)
  g.addColorStop(0, '#2a3f7a')
  g.addColorStop(1, '#0b1426')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 440)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8664f'
  ctx.font = SERIF.replace('{s}', '52')
  ctx.fillText('Inter IIT Cultural Meet', 512, 110)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(160,200,255,.9)'
  ctx.shadowBlur = 30
  ctx.font = `200px ${DISPLAY}`
  ctx.fillText('9.0', 512, 245)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#bfd9f2'
  ctx.font = `40px ${DISPLAY}`
  ctx.fillText('25–29 DEC 2026 · IIT MANDI', 512, 375)
  return finish(c)
}

/** Soft round puff used by clouds and smoke. */
export function puff(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, ctx] = canvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.45)'))
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Flame sprite: hot core, orange body. */
export function flame() {
  const [c, ctx] = canvas(128, 256)
  const g = ctx.createRadialGradient(64, 180, 4, 64, 160, 120)
  g.addColorStop(0, 'rgba(255,250,220,1)')
  g.addColorStop(0.2, 'rgba(255,200,90,0.95)')
  g.addColorStop(0.5, 'rgba(255,110,30,0.55)')
  g.addColorStop(1, 'rgba(255,60,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(64, 0)
  ctx.bezierCurveTo(130, 120, 128, 250, 64, 252)
  ctx.bezierCurveTo(0, 250, -2, 120, 64, 0)
  ctx.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
