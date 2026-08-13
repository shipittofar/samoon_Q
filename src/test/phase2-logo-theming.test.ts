/**
 * P2.2 — White-Label Theme Engine: tenant logo via Tenant.image
 *
 * Covers:
 *   P2.2.L1 — Header reads logo from tenant.image (resolveTenantImage)
 *   P2.2.L2 — Header renders tenant logo image when image is present
 *   P2.2.L3 — Header renders default Samoon wordmark when image is absent
 *   P2.2.L4 — Alt text uses tenant name
 *   P2.2.L5 — TenantBranding has no logo fields; logo is Tenant.image
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const src = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf-8')

describe('P2.2.L1 — Header reads logo from tenant.image', () => {
  it('Header uses resolveTenantImage', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('resolveTenantImage')
    expect(content).toContain('tenantImage')
  })

  it('Header does not read theme.logoUrl', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).not.toContain('theme?.logoUrl')
    expect(content).not.toContain('theme.logoUrl')
    expect(content).not.toContain('settings?.theme?.logoUrl')
  })
})

describe('P2.2.L2 — Header renders tenant logo image when image is set', () => {
  it('Header renders an <img> element for the tenant logo', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('<img')
  })

  it('img src is the tenantImage variable', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('src={tenantImage}')
  })

  it('img has explicit width and height to avoid layout shift', () => {
    const content = src('components/layout/Header.tsx')
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toContain('width=')
    expect(imgBlock).toContain('height=')
  })

  it('img is conditionally rendered only when tenantImage is truthy', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('tenantImage ?')
  })

  it('img has object-contain class to preserve aspect ratio', () => {
    const content = src('components/layout/Header.tsx')
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toContain('object-contain')
  })
})

describe('P2.2.L3 — Header renders default Samoon wordmark when logo is absent', () => {
  it('Header still contains the Samoon wordmark text', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('Samoon')
  })

  it('Header still contains the S icon div (orange gradient fallback)', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('from-orange-400 to-orange-600')
  })

  it('Samoon wordmark is in the else branch of the tenantImage conditional', () => {
    const content = src('components/layout/Header.tsx')
    const logoIdx = content.indexOf('tenantImage ?')
    const samoonIdx = content.indexOf('Samoon', logoIdx)
    expect(logoIdx).toBeGreaterThan(-1)
    expect(samoonIdx).toBeGreaterThan(logoIdx)
  })
})

describe('P2.2.L4 — Logo image alt text uses tenant name', () => {
  it('Image alt references tenant?.name', () => {
    const content = src('components/layout/Header.tsx')
    expect(content).toContain('tenant?.name')
    expect(content).toContain('logo')
  })

  it('img alt is an expression referencing tenant?.name, null-safe since tenant can be null (not hardcoded)', () => {
    const content = src('components/layout/Header.tsx')
    const imgBlock = content.slice(content.indexOf('<img'), content.indexOf('/>', content.indexOf('<img')))
    expect(imgBlock).toMatch(/alt=\{/)
    expect(imgBlock).toContain('tenant?.name')
  })
})

describe('P2.2.L5 — TenantBranding / Tenant.image contract', () => {
  it('types/index.ts defines TenantBranding', () => {
    const content = src('types/index.ts')
    expect(content).toContain('export interface TenantBranding')
  })

  it('TenantTheme is an alias of TenantBranding', () => {
    const content = src('types/index.ts')
    expect(content).toContain('export type TenantTheme = TenantBranding')
  })

  it('TenantBranding does not declare logoUrl', () => {
    const content = src('types/index.ts')
    const start = content.indexOf('export interface TenantBranding')
    const end = content.indexOf('export type TenantTheme', start)
    const block = content.slice(start, end)
    expect(block).not.toContain('logoUrl')
    expect(block).toContain('primaryColor')
    expect(block).toContain('fontBody')
    expect(block).toContain('fontsByLocale')
  })

  it('Tenant has top-level image field', () => {
    const content = src('types/index.ts')
    const start = content.indexOf('export interface Tenant {')
    const end = content.indexOf('export interface', start + 1)
    expect(content.slice(start, end)).toContain('image?:')
  })
})
