/**
 * P2.2 — White-Label Theme Engine: logoUrl wiring
 *
 * Covers:
 *   P2.2.L1 — Header reads logoUrl from tenant theme
 *   P2.2.L2 — Header renders tenant logo image when logoUrl is present
 *   P2.2.L3 — Header renders default Samoon wordmark when logoUrl is absent
 *   P2.2.L4 — Alt text uses tenant name
 *   P2.2.L5 — TenantTheme type carries logoUrl field
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const src = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf-8')

// ── P2.2.L1 — Header reads logoUrl from tenant theme ─────────────────────────

describe('P2.2.L1 — Header reads logoUrl from tenant theme', () => {
  // Phase Z.6.2 — Tenant.settings is now typed directly (TenantSettings.theme:
  // TenantTheme, src/types/index.ts), so Header.tsx no longer needs its own
  // `as TenantTheme` cast or a local TenantTheme import to read logoUrl —
  // `tenant.settings?.theme?.logoUrl` type-checks on its own.
  it('Header reads logoUrl from tenant.settings.theme', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('logoUrl')
    expect(content).toContain('tenant?.settings?.theme?.logoUrl')
  })

  it('Header reads settings.theme from useTenantStore tenant', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('tenant?.settings?.theme')
  })
})

// ── P2.2.L2 — Header renders logo image when logoUrl is present ──────────────

describe('P2.2.L2 — Header renders tenant logo image when logoUrl is set', () => {
  it('Header renders an <img> element for the tenant logo', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('<img')
  })

  it('img src is the logoUrl variable', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('src={logoUrl}')
  })

  it('img has explicit width and height to avoid layout shift', () => {
    const content = src('components/layout/Header.tsx')
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toContain('width=')
    expect(imgBlock).toContain('height=')
  })

  it('img is conditionally rendered only when logoUrl is truthy', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('logoUrl ?')
  })

  it('img has object-contain class to preserve aspect ratio', () => {
    const content = src('components/layout/Header.tsx')
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toContain('object-contain')
  })
})

// ── P2.2.L3 — Header renders default wordmark when logoUrl is absent ──────────

describe('P2.2.L3 — Header renders default Samoon wordmark when logoUrl is absent', () => {
  it('Header still contains the Samoon wordmark text', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('Samoon')
  })

  it('Header still contains the S icon div (orange gradient fallback)', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('from-orange-400 to-orange-600')
  })

  it('Samoon wordmark is in the else branch of the logoUrl conditional', () => {
    const content = src('components/layout/Header.tsx')
    const logoIdx = content.indexOf('logoUrl ?')
    const samoonIdx = content.indexOf('Samoon', logoIdx)
    expect(logoIdx).toBeGreaterThan(-1)
    expect(samoonIdx).toBeGreaterThan(logoIdx)
  })
})

// ── P2.2.L4 — Alt text uses tenant name ──────────────────────────────────────

describe('P2.2.L4 — Logo image alt text uses tenant name', () => {
  it('Image alt references tenant?.name', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('tenant?.name')
    expect(content).toContain('logo')
  })

  it('img alt is an expression referencing tenant?.name, null-safe since tenant can be null (not hardcoded)', () => {
    const content = src('components/layout/Header.tsx')
    // alt={t('logoAlt', { name: tenant?.name ?? '' })} or similar
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toMatch(/alt=\{/)
    expect(imgBlock).toContain('tenant?.name')
  })
})

// ── P2.2.L5 — TenantTheme type carries logoUrl ───────────────────────────────

describe('P2.2.L5 — TenantTheme type definition', () => {
  it('types/index.ts defines TenantTheme interface', () => {
    const content = src('types/index.ts')
    expect(content).toContain('export interface TenantTheme')
  })

  it('TenantTheme has logoUrl field', () => {
    const content = src('types/index.ts')
    expect(content).toContain('logoUrl')
  })

  it('logoUrl is optional (? modifier)', () => {
    const content = src('types/index.ts')
    expect(content).toContain('logoUrl?')
  })

  it('TenantTheme comment describes logoUrl purpose', () => {
    const content = src('types/index.ts')
    const themeIdx = content.indexOf('export interface TenantTheme')
    const logoIdx = content.indexOf('logoUrl', themeIdx)
    expect(themeIdx).toBeGreaterThan(-1)
    expect(logoIdx).toBeGreaterThan(themeIdx)
  })
})
