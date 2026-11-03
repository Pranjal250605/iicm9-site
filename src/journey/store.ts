import { cups } from '../data/cups'

/** Shared, mutation-only state between the scroll driver, overlays and the 3D rig (no React re-renders). */
export const journey = {
  /** raw 0..1 scroll progress through the journey track */
  target: 0,
  /** damped progress used by camera + overlays */
  progress: 0,
  pointer: { x: 0, y: 0 },
  reduced: false,
}

/** Progress value at which the camera reaches each Cam_XX empty from the GLB (13 keys). */
export const CAM_PROGRESS = [0, 0.07, 0.16, 0.225, 0.29, 0.351, 0.465, 0.578, 0.7, 0.77, 0.84, 0.92, 1]

/** [fadeInStart, fullyIn, fadeOutStart, gone] for each overlay chapter. */
export const CHAPTERS = {
  hero: [-1, -0.5, 0.045, 0.075],
  intro: [0.08, 0.1, 0.175, 0.198],
  gate: [0.202, 0.218, 0.262, 0.278],
  cups: [0.276, 0.292, 0.684, 0.702],
  nights: [0.716, 0.736, 0.846, 0.866],
  finale: [0.878, 0.905, 2, 3],
} as const satisfies Record<string, readonly [number, number, number, number]>

export type ChapterKey = keyof typeof CHAPTERS

/** Progress at which cup i is best framed while dollying down the street (matches the Blender layout). */
export const cupProgress = (i: number) => 0.2824 + 0.03113 * i

export function cupIndexAt(p: number) {
  const [a, , , d] = CHAPTERS.cups
  if (p < a || p > d) return -1
  const i = Math.round((p - 0.2824) / 0.03113)
  return Math.max(0, Math.min(cups.length - 1, i))
}

/** Reduced motion: hold the camera at one framing per chapter instead of flying continuously. */
export function quantize(p: number) {
  const holds: [number, number][] = [
    [CHAPTERS.intro[0], 0.0], [CHAPTERS.gate[0], 0.16], [CHAPTERS.cups[0], 0.225],
    [CHAPTERS.nights[0], cupProgress(12)], [CHAPTERS.finale[0], 0.8], [2, 1],
  ]
  if (p >= CHAPTERS.cups[0] && p < CHAPTERS.nights[0]) return cupProgress(Math.max(0, cupIndexAt(p)))
  for (const [until, value] of holds) if (p < until) return value
  return 1
}
