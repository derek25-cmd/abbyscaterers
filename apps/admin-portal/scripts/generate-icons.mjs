// One-off generator for the PWA app icons — run with `node scripts/generate-icons.mjs`
// whenever the monogram design changes. Not part of the app bundle.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const DARK_BROWN = '#3b3030';
const CREAM = '#fcf7e3';
const GOLD = '#e8b84b';

// Rounded-square badge with a cream "A" monogram and a small gold steam
// swirl accent (echoing the wordmark's coffee-steam flourish) so the icon
// still reads as "Abby's" at a glance, unlike the illegible-at-small-sizes
// script wordmark in public/logo.png.
function svgMonogram({ size, padding }) {
  const r = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = size * 0.52;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}" rx="${r}" fill="${DARK_BROWN}" />
  <text x="${cx}" y="${cy + fontSize * 0.36}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="${CREAM}" text-anchor="middle">A</text>
  <path d="M ${cx + size * 0.12} ${size * 0.24} q ${size * 0.06} -${size * 0.05} 0 -${size * 0.1} q -${size * 0.06} -${size * 0.05} 0 -${size * 0.1}"
        stroke="${GOLD}" stroke-width="${Math.max(2, size * 0.018)}" fill="none" stroke-linecap="round" />
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = new Set([192, 512]);

for (const size of sizes) {
  // Maskable icons need extra safe-area padding so Android's circular/
  // squircle crop mask doesn't clip the glyph.
  const padding = maskableSizes.has(size) ? size * 0.1 : 0;
  const svg = Buffer.from(svgMonogram({ size, padding }));
  await sharp(svg).png().toFile(path.join(outDir, `icon-${size}x${size}.png`));
  console.log(`icon-${size}x${size}.png`);
}

// Apple touch icon — no maskable crop concerns on iOS, but Apple applies
// its own rounded-corner mask, so keep a small margin.
const appleSvg = Buffer.from(svgMonogram({ size: 180, padding: 10 }));
await sharp(appleSvg).png().toFile(path.join(outDir, 'apple-touch-icon-180x180.png'));
console.log('apple-touch-icon-180x180.png');
