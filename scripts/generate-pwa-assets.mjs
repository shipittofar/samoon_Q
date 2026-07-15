/**
 * PWA Asset Generator — Phase 3 (P3.4)
 *
 * Generates all icon and screenshot assets referenced in public/manifest.json
 * and the Next.js metadata configuration. Uses sharp (bundled with Next.js) to
 * produce production-safe raster images from the Samoon brand identity:
 *
 *   Brand color:  #f97316  (orange-500 — matches theme_color in manifest.json)
 *   Brand letter: S
 *
 * Generated assets:
 *   public/icons/icon-{72,96,128,144,152,192,384,512}.png   (maskable + any)
 *   public/screenshots/menu.png                              (1280×720 wide)
 *   public/og-image.jpg                                      (1200×630 OpenGraph)
 *
 * Usage:
 *   node scripts/generate-pwa-assets.mjs
 */

import { createRequire } from 'module'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

mkdirSync(join(PUBLIC, 'icons'), { recursive: true })
mkdirSync(join(PUBLIC, 'screenshots'), { recursive: true })

// ── Brand constants ────────────────────────────────────────────────────────────
const BRAND_ORANGE   = '#f97316'
const BRAND_ORANGE_D = '#ea580c'  // slightly darker for gradient stop
const WHITE          = '#ffffff'
const BG_DARK        = '#1c0a00'  // very dark warm brown for screenshot bg

// ── SVG helpers ────────────────────────────────────────────────────────────────

/**
 * Builds an SVG icon with a circular orange gradient background and the
 * centred brand letter "S". The safe-zone inset (12.5 % per side per the
 * maskable icon spec) keeps the letter visible when the UA applies a mask.
 */
function iconSvg(size) {
  const r = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${BRAND_ORANGE}"/>
      <stop offset="100%" stop-color="${BRAND_ORANGE_D}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r * 0.24}" fill="url(#bg)"/>
  <text
    x="${r}" y="${r}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${Math.round(size * 0.48)}"
    font-weight="700"
    fill="${WHITE}"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-1"
  >S</text>
</svg>`
}

/**
 * Builds a 1280×720 screenshot SVG (wide form factor).
 * Renders a minimal menu-page mockup using the brand palette.
 */
function screenshotSvg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND_ORANGE}"/>
      <stop offset="100%" stop-color="${BRAND_ORANGE_D}"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${w}" height="${h}" fill="#fafaf9"/>
  <!-- Header bar -->
  <rect width="${w}" height="56" fill="url(#hdr)"/>
  <!-- Logo text in header -->
  <text x="32" y="36" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="${WHITE}">Samoon</text>
  <!-- Nav items -->
  <text x="200" y="36" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.85)">Menu</text>
  <text x="280" y="36" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.85)">Reservation</text>
  <text x="400" y="36" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.85)">Restaurant</text>
  <!-- Hero area -->
  <rect y="56" width="${w}" height="160" fill="#fff7ed"/>
  <text x="${w/2}" y="130" font-family="system-ui,sans-serif" font-size="36" font-weight="800" fill="#1c1917" text-anchor="middle">Our Full Menu</text>
  <text x="${w/2}" y="168" font-family="system-ui,sans-serif" font-size="16" fill="#78716c" text-anchor="middle">Discover handcrafted dishes made with the finest ingredients</text>
  <!-- Card grid (3 cards) -->
  ${[0,1,2].map(i => {
    const cx = 120 + i * 360
    const cy = 260
    const cw = 300
    const ch = 320
    return `
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="16" fill="${WHITE}" stroke="#e7e5e4" stroke-width="1.5"/>
  <rect x="${cx}" y="${cy}" width="${cw}" height="160" rx="16" fill="#fed7aa"/>
  <rect x="${cx}" y="${cy+144}" width="${cw}" height="16" fill="#fff7ed"/>
  <text x="${cx+16}" y="${cy+188}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#1c1917">Menu Item ${i+1}</text>
  <text x="${cx+16}" y="${cy+210}" font-family="system-ui,sans-serif" font-size="12" fill="#78716c">Fresh ingredients · 25 min</text>
  <text x="${cx+16}" y="${cy+248}" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="${BRAND_ORANGE}">$${(12 + i * 5).toFixed(2)}</text>
  <rect x="${cx+cw-80}" y="${cy+232}" width="64" height="32" rx="8" fill="${BRAND_ORANGE}"/>
  <text x="${cx+cw-48}" y="${cy+253}" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${WHITE}" text-anchor="middle">Add</text>`
  }).join('')}
</svg>`
}

/**
 * Builds a 1200×630 OpenGraph image SVG.
 */
function ogSvg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_ORANGE}"/>
      <stop offset="100%" stop-color="${BRAND_ORANGE_D}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <!-- Decorative circles -->
  <circle cx="${w-100}" cy="100" r="180" fill="rgba(255,255,255,0.08)"/>
  <circle cx="80" cy="${h-80}" r="120" fill="rgba(255,255,255,0.06)"/>
  <!-- Logo mark -->
  <rect x="80" y="${h/2-80}" width="100" height="100" rx="20" fill="rgba(255,255,255,0.25)"/>
  <text x="130" y="${h/2-16}" font-family="system-ui,sans-serif" font-size="64" font-weight="800" fill="${WHITE}" text-anchor="middle">S</text>
  <!-- Brand name -->
  <text x="210" y="${h/2-30}" font-family="system-ui,sans-serif" font-size="56" font-weight="800" fill="${WHITE}">Samoon</text>
  <text x="210" y="${h/2+28}" font-family="system-ui,sans-serif" font-size="22" fill="rgba(255,255,255,0.85)">Fine Dining &amp; Delivery</text>
  <!-- Tagline -->
  <text x="${w/2}" y="${h-60}" font-family="system-ui,sans-serif" font-size="16" fill="rgba(255,255,255,0.7)" text-anchor="middle">Order online · Reserve a table · Track in real time</text>
</svg>`
}

// ── Generate icons ─────────────────────────────────────────────────────────────
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

console.log('[P3.4] Generating PWA icons...')
for (const size of ICON_SIZES) {
  const svg = Buffer.from(iconSvg(size))
  await sharp(svg)
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, 'icons', `icon-${size}.png`))
  console.log(`  ✓ icon-${size}.png`)
}

// ── Generate screenshot ────────────────────────────────────────────────────────
console.log('[P3.4] Generating screenshot...')
{
  const svg = Buffer.from(screenshotSvg(1280, 720))
  await sharp(svg)
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, 'screenshots', 'menu.png'))
  console.log('  ✓ screenshots/menu.png')
}

// ── Generate OG image ──────────────────────────────────────────────────────────
console.log('[P3.4] Generating OG image...')
{
  const svg = Buffer.from(ogSvg(1200, 630))
  await sharp(svg)
    .jpeg({ quality: 90 })
    .toFile(join(PUBLIC, 'og-image.jpg'))
  console.log('  ✓ og-image.jpg')
}

console.log('[P3.4] All PWA assets generated successfully.')
