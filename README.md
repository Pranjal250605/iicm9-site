# IICM 9.0 website

Inter IIT Cultural Meet 9.0 · IIT Mandi · 25–29 Dec 2026.
Vite + React + TypeScript, with a React Three Fiber scroll journey through a Blender-generated snow village.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```

## Editing content (no code changes needed)

Everything visitors read lives in `src/data/`:

| File | What it holds |
|---|---|
| `site.ts` | dates, email, socials, fee, about copy, convener's message, contacts, **`rulebookUrl`** (set it and every Rulebook link goes live) |
| `team.ts` | committees + members. Replace `Name TBA` placeholders; drop square photos in `public/images/team/` and set `photo` |
| `schedule.ts` | Day 0–4 slots. Replace `TBA` time/venue as the plan locks |
| `cups.ts` | the 13 cups, taglines, events (order = cabins on the 3D street) |
| `sponsors.ts` | 9.0 partner slots: fill `name` / `logo` when confirmed |
| `venues.ts`, `nights.ts` | venue and pro-night cards |

## The 3D village

`blender/build_village.py` generates the whole scene (terrain, cabins, the 13 cup cabins, the gate, the bonfire square, the forest and the camera rail) and exports `public/models/village.glb`.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_village.py -- --out public/models/village.glb
```

The script also renders `blender/preview_*.png` and saves `blender/village.blend`.
To retune the camera flight, move the `Cam_XX` / `Look_XX` empties (or edit `CAM_RAIL` in the script).
Their timing along the scroll is `CAM_PROGRESS` in `src/journey/store.ts`.

Images in `public/images/` were extracted from the proposal + sponsor brochure with `scripts/extract-assets.mjs`.

## Deploy

Static site. `vercel.json` handles SPA routes. `npx vercel` (after `vercel login`) or drag `dist/` into any static host.
