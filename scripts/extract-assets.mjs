// Usage: node scripts/extract-assets.mjs <proposalImagesDir> <brochureImagesDir> <conceptImage>
// Expects output of `pdfimages -png -p` (proposal) and `pdfimages -j -p` (brochure).
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const [prop, broc, concept] = process.argv.slice(2);
const out = path.resolve('public/images');
fs.mkdirSync(out, { recursive: true });

const photos = {
  'campus-aerial': 'p-001-000.png',
  'venue-auditorium': 'p-016-002.png',
  'venue-basketball': 'p-016-003.png',
  'venue-peepal-mess': 'p-016-004.png',
  'venue-south-ground': 'p-016-005.png',
  'venue-village-square': 'p-016-006.png',
  'venue-oat': 'p-017-012.png',
  'venue-a18': 'p-017-013.png',
  'venue-a11-a13': 'p-017-014.png',
  'night-jam': 'p-019-032.png',
  'night-bonfire': 'p-019-033.png',
  'night-food': 'p-019-034.png',
  'night-sufi': 'p-019-045.png',
  'night-dj': 'p-019-046.png',
  'campus-snow-wide': 'p-023-063.png',
};
// Grade every photo into the site's night palette: desaturate, cool the whites, lift blacks to navy.
// strength 0 = untouched, 1 = full grade. Daytime venue shots need more than the already-dark night shots.
const NAVY = [11, 20, 38];
function grade(img, strength) {
  const sat = 1 - 0.78 * strength;
  const k = (c) => 1 - (c / 255) * strength * 0.9;
  return img
    .modulate({ saturation: sat, brightness: 1 - 0.24 * strength })
    .recomb([
      [1 - 0.2 * strength, 0.05 * strength, 0.02 * strength],
      [0.0, 1 - 0.1 * strength, 0.08 * strength],
      [0.04 * strength, 0.1 * strength, 1 + 0.06 * strength],
    ])
    .linear([k(NAVY[0]), k(NAVY[1]), k(NAVY[2])], NAVY.map((c) => c * strength * 0.9));
}
const strengthFor = (name) => (name.startsWith('night-') ? 0.4 : name.startsWith('campus-snow') ? 0.35 : 0.85);

for (const [name, file] of Object.entries(photos)) {
  await grade(sharp(path.join(prop, file)).resize({ width: 1400, withoutEnlargement: true }), strengthFor(name))
    .webp({ quality: 80 })
    .toFile(path.join(out, `${name}.webp`));
}

// Brochure pages are 3840x2160 renders; crop the photo regions.
const crops = {
  'campus-snow-hill': ['b-001-000.jpg', { left: 2250, top: 235, width: 1480, height: 1690 }],
  'campus-snow-street': ['b-003-004.jpg', { left: 1966, top: 278, width: 1810, height: 1724 }],
  'sponsors-previous': ['b-007-012.jpg', { left: 826, top: 610, width: 2188, height: 1452 }],
};
for (const [name, [file, box]] of Object.entries(crops)) {
  // sponsor logos keep their brand colours; campus photos get the light grade
  let img = sharp(path.join(broc, file)).extract(box).resize({ width: 1600, withoutEnlargement: true });
  if (!name.startsWith('sponsors')) img = grade(img, strengthFor(name));
  await img.webp({ quality: 82 }).toFile(path.join(out, `${name}.webp`));
}

// Logo: knock the white background out to alpha.
const { data, info } = await sharp(path.join(prop, 'p-001-001.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const m = Math.min(data[i], data[i + 1], data[i + 2]);
  if (m > 235) data[i + 3] = 0;
  else if (m > 200) data[i + 3] = Math.round(255 * (235 - m) / 35);
}
await sharp(data, { raw: info }).png().toFile(path.join(out, 'iit-mandi-logo.png'));

await sharp(concept).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(out, 'concept-village.webp'));
console.log(fs.readdirSync(out).map((f) => `${f} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)}KB`).join('\n'));
