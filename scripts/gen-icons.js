/**
 * One-off: generate the PWA / app icons from the Umbrix mark (a cream "U" with
 * the brand's accent dot on dark ink), rasterised with sharp. Writes PNGs to
 * public/. Re-run if the mark changes.  node scripts/gen-icons.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const INK = "#1c1917";
const CREAM = "#f6f3ec";
const ACCENT = "#8fb89b"; // accent-on-dark (readable green on the ink bg)

/** SVG of the mark. `contentScale` shrinks the mark for maskable safe-zone padding. */
function svg(size, contentScale) {
  const c = size / 2;
  const half = (size * contentScale) / 2;
  const uW = half * 0.82; // half-width of the U
  const top = c - half * 0.72;
  const bottom = c + half * 0.18;
  const stroke = size * 0.088;
  const dotR = size * 0.045;
  const dotY = top - stroke * 1.15;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${INK}"/>
    <circle cx="${c}" cy="${dotY}" r="${dotR}" fill="${ACCENT}"/>
    <path d="M ${c - uW} ${top} L ${c - uW} ${bottom} A ${uW} ${uW} 0 0 0 ${c + uW} ${bottom} L ${c + uW} ${top}"
      fill="none" stroke="${CREAM}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

const OUT = path.join(__dirname, "..", "public");
const targets = [
  { file: "icon-192.png", size: 192, scale: 0.8 },
  { file: "icon-512.png", size: 512, scale: 0.8 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.62 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.78 },
  { file: "favicon-32.png", size: 32, scale: 0.82 },
];

(async () => {
  for (const t of targets) {
    await sharp(Buffer.from(svg(t.size, t.scale))).png().toFile(path.join(OUT, t.file));
    console.log(`wrote public/${t.file} (${t.size}px)`);
  }
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
