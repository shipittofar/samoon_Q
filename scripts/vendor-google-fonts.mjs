/**
 * Downloads the latin variable woff2 files used by next/font/google for
 * Playfair Display and DM Sans into src/fonts/ so Turbopack does not need to
 * fetch Google Fonts at compile time (avoids Rust TLS fetch failures).
 */
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'src', 'fonts')

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers, timeout: 30000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location, headers).then(resolve, reject)
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            buf: Buffer.concat(chunks),
          }),
        )
      })
      .on('error', reject)
  })
}

/** Pick the basic-latin @font-face woff2 URL from a Google Fonts CSS response. */
function pickLatinWoff2(cssText) {
  const faces = cssText.split('@font-face').slice(1)
  for (const face of faces) {
    const isBasicLatin = /unicode-range:\s*U\+0000-00FF/i.test(face)
    const urlMatch = face.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)
    if (isBasicLatin && urlMatch) return urlMatch[1]
  }
  const any = cssText.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)
  return any?.[1] ?? null
}

const families = [
  {
    name: 'Playfair Display',
    file: 'PlayfairDisplay-latin-variable.woff2',
    css: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap',
  },
  {
    name: 'DM Sans',
    file: 'DMSans-latin-variable.woff2',
    css: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap',
  },
]

fs.mkdirSync(outDir, { recursive: true })

const chromeHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/css,*/*;q=0.1',
}

for (const family of families) {
  const css = await get(family.css, chromeHeaders)
  const text = css.buf.toString('utf8')
  const latin = pickLatinWoff2(text)
  if (!latin) {
    throw new Error(`No woff2 URL for ${family.name}. CSS snippet: ${text.slice(0, 500)}`)
  }
  const font = await get(latin, { 'User-Agent': chromeHeaders['User-Agent'] })
  if (font.status !== 200) {
    throw new Error(`Download failed ${latin} status=${font.status}`)
  }
  const dest = path.join(outDir, family.file)
  fs.writeFileSync(dest, font.buf)
  console.log(`${family.name} -> ${path.relative(root, dest)} (${font.buf.length} bytes)`)
  console.log(`  source: ${latin}`)
}
