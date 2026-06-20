/**
 * build-sw.mjs — Phase 4.8 (P4.8.2)
 *
 * Injects the build version into the service worker template, replacing
 * __SW_VERSION__ with a real value so cache names are unique per release.
 *
 * Version resolution order:
 *   1. package.json "version" field  (e.g. "1.0.0")
 *   2. git commit SHA (short)        (e.g. "a37601e")
 *   3. "unknown"
 *
 * Single source of truth: package.json version, consistent with VERSION
 * constant in src/lib/version.ts. No second version system is created.
 *
 * Output: public/sw.js (replaces in place)
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SW_TOKEN = '__SW_VERSION__'

function getVersion() {
  // 1. package.json version
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    if (pkg.version) return String(pkg.version)
  } catch {
    // ignore
  }

  // 2. git SHA
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim()
    if (sha) return sha
  } catch {
    // ignore
  }

  return 'unknown'
}

const version = getVersion()
const templatePath = join(__dirname, 'sw-source.js')
const outputPath = join(ROOT, 'public', 'sw.js')

const source = readFileSync(templatePath, 'utf-8')

if (!source.includes(SW_TOKEN)) {
  console.warn(`[build-sw] Warning: ${SW_TOKEN} token not found in sw-source.js`)
}

// Replace the __SW_VERSION__ token everywhere (SW_VERSION variable), then
// inline the template-literal cache names to static strings so the built
// public/sw.js contains literal 'savor-cache-v1.0.0' instead of a runtime
// expression — required for version verification during update detection.
const output = source
  .replaceAll(SW_TOKEN, version)
  .replace(/`savor-cache-v\$\{SW_VERSION\}`/, `'savor-cache-v${version}'`)
  .replace(/`savor-api-v\$\{SW_VERSION\}`/, `'savor-api-v${version}'`)
writeFileSync(outputPath, output, 'utf-8')

console.log(`[build-sw] Generated public/sw.js  version=${version}`)
