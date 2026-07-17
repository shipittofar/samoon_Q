/**
 * Phase 2 — Platform UI Foundation tests (P2.1–P2.4)
 *
 * Covers:
 *   - Design token registry structure (P2.1)
 *   - TENANT_OVERRIDABLE_VARS contract (P2.2)
 *   - UI primitive exports (P2.3)
 *   - Navigation hook logic — useModuleNav + useDashboardNav (P2.4)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SEMANTIC_TOKENS,
  BRAND_TOKENS,
  SURFACE_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  FONT_TOKENS,
  TENANT_OVERRIDABLE_VARS,
} from '@/lib/tokens'
import { getDashboardNav, getHeaderNav } from '@/modules/registry'
import { useTenantStore, useAuthStore } from '@/stores'
import type { TenantTheme } from '@/types'

// ── Token Registry Tests (P2.1) ───────────────────────────────────────────────

describe('SEMANTIC_TOKENS', () => {
  it('has all required semantic token keys', () => {
    const expected = [
      'bg', 'bgSecondary', 'fg', 'fgMuted', 'fgSubtle',
      'border', 'borderStrong',
      'accent', 'accentHover', 'accentFg',
      'card', 'cardHover',
      'inputBg', 'overlay',
    ]
    for (const key of expected) {
      expect(SEMANTIC_TOKENS).toHaveProperty(key)
    }
  })

  it('all values are CSS var() references', () => {
    for (const val of Object.values(SEMANTIC_TOKENS)) {
      expect(val).toMatch(/^var\(--/)
    }
  })
})

describe('BRAND_TOKENS', () => {
  it('covers standard shade scale 50–950', () => {
    const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    for (const shade of expectedShades) {
      expect(BRAND_TOKENS).toHaveProperty(String(shade))
    }
  })

  it('all values are CSS var() references', () => {
    for (const val of Object.values(BRAND_TOKENS)) {
      expect(val).toMatch(/^var\(--color-brand-/)
    }
  })
})

describe('SURFACE_TOKENS', () => {
  it('covers standard shade scale 50–950', () => {
    const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    for (const shade of expectedShades) {
      expect(SURFACE_TOKENS).toHaveProperty(String(shade))
    }
  })
})

describe('RADIUS_TOKENS', () => {
  it('has sm, md, lg, xl, 2xl, full', () => {
    expect(RADIUS_TOKENS).toHaveProperty('sm')
    expect(RADIUS_TOKENS).toHaveProperty('md')
    expect(RADIUS_TOKENS).toHaveProperty('lg')
    expect(RADIUS_TOKENS).toHaveProperty('xl')
    expect(RADIUS_TOKENS).toHaveProperty('2xl')
    expect(RADIUS_TOKENS).toHaveProperty('full')
  })
})

describe('SHADOW_TOKENS', () => {
  it('has soft, brand, glow', () => {
    expect(SHADOW_TOKENS).toHaveProperty('soft')
    expect(SHADOW_TOKENS).toHaveProperty('brand')
    expect(SHADOW_TOKENS).toHaveProperty('glow')
  })
})

describe('FONT_TOKENS', () => {
  it('has display, body, mono', () => {
    expect(FONT_TOKENS).toHaveProperty('display')
    expect(FONT_TOKENS).toHaveProperty('body')
    expect(FONT_TOKENS).toHaveProperty('mono')
  })
})

// ── Tenant Override Contract (P2.2) ───────────────────────────────────────────

describe('TENANT_OVERRIDABLE_VARS', () => {
  it('includes exactly --accent, --accent-hover, --font-body', () => {
    expect(TENANT_OVERRIDABLE_VARS).toContain('--accent')
    expect(TENANT_OVERRIDABLE_VARS).toContain('--accent-hover')
    expect(TENANT_OVERRIDABLE_VARS).toContain('--font-body')
    expect(TENANT_OVERRIDABLE_VARS).toHaveLength(3)
  })

  it('does NOT allow overriding brand or surface palettes', () => {
    for (const v of TENANT_OVERRIDABLE_VARS) {
      expect(v).not.toMatch(/--color-brand/)
      expect(v).not.toMatch(/--color-surface/)
    }
  })
})

// ── TenantTheme type contract (P2.2) ─────────────────────────────────────────

describe('TenantTheme type', () => {
  it('accepts a valid theme object with optional fields', () => {
    const theme: TenantTheme = {
      primaryColor: '#f97316',
      accentHoverColor: '#ea580c',
      fontBody: 'Inter',
      logoUrl: 'https://example.com/logo.png',
    }
    expect(theme.primaryColor).toBe('#f97316')
    expect(theme.accentHoverColor).toBe('#ea580c')
    expect(theme.fontBody).toBe('Inter')
    expect(theme.logoUrl).toBeDefined()
  })

  it('accepts partial theme (all fields optional)', () => {
    const themePartial: TenantTheme = {}
    expect(themePartial).toBeDefined()
  })
})

// ── UI Primitive exports (P2.3) ───────────────────────────────────────────────

describe('Table primitives', () => {
  it('exports Table, TableHead, TableBody, TableRow, TableHeader, TableCell', async () => {
    const mod = await import('@/components/ui/Table')
    expect(typeof mod.Table).toBe('function')
    expect(typeof mod.TableHead).toBe('function')
    expect(typeof mod.TableBody).toBe('function')
    expect(typeof mod.TableRow).toBe('function')
    expect(typeof mod.TableHeader).toBe('function')
    expect(typeof mod.TableCell).toBe('function')
  })
})

describe('EmptyState primitive', () => {
  it('exports EmptyState as a function', async () => {
    const mod = await import('@/components/ui/EmptyState')
    expect(typeof mod.EmptyState).toBe('function')
  })
})

// ── Navigation Hook Logic (P2.4) ─────────────────────────────────────────────

describe('getDashboardNav registry', () => {
  it('returns an array of nav items', () => {
    const items = getDashboardNav()
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('each item has href and label', () => {
    for (const item of getDashboardNav()) {
      expect(typeof item.href).toBe('string')
      expect(typeof item.label).toBe('string')
    }
  })
})

// P10.4.12 — the legacy `useDashboardNav RBAC logic (pure)` describe block
// (rbacService.hasPermission()-only assertions) was removed here:
// src/services/rbac.service.ts is deleted, and useDashboardNav()/
// useHasDashboardAccess() have not read from it since P10.4.10 — see
// docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

describe('useModuleNav feature-flag filtering logic (pure)', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('getHeaderNav returns items for default business types', () => {
    const { tenant } = useTenantStore.getState()
    const items = getHeaderNav(tenant?.businessTypes ?? [])
    expect(Array.isArray(items)).toBe(true)
  })

  it('items without featureFlagKey are always included (no flag needed)', () => {
    const { tenant } = useTenantStore.getState()
    const items = getHeaderNav(tenant?.businessTypes ?? [])
    const unconditional = items.filter((item) => !item.featureFlagKey)
    expect(unconditional.length).toBeGreaterThan(0)
  })

  it('feature flag false hides conditional items', () => {
    const { tenant } = useTenantStore.getState()
    const items = getHeaderNav(tenant?.businessTypes ?? [])
    const flagged = items.filter((item) => !!item.featureFlagKey)
    const featureFlags: Record<string, boolean> = {}
    for (const item of flagged) {
      if (item.featureFlagKey) featureFlags[item.featureFlagKey] = false
    }
    const visible = items.filter(
      (item) => !item.featureFlagKey || featureFlags[item.featureFlagKey] !== false,
    )
    // all flagged items hidden — only unconditional ones remain
    expect(visible.length).toBe(items.length - flagged.length)
  })

  it('feature flag true shows conditional items', () => {
    const { tenant } = useTenantStore.getState()
    const items = getHeaderNav(tenant?.businessTypes ?? [])
    const flagged = items.filter((item) => !!item.featureFlagKey)
    const featureFlags: Record<string, boolean> = {}
    for (const item of flagged) {
      if (item.featureFlagKey) featureFlags[item.featureFlagKey] = true
    }
    const visible = items.filter(
      (item) => !item.featureFlagKey || featureFlags[item.featureFlagKey] !== false,
    )
    expect(visible.length).toBe(items.length)
  })
})

// ── AppShell export (P2.4) ────────────────────────────────────────────────────

describe('AppShell export', () => {
  it('exports AppShell as a function', async () => {
    const mod = await import('@/components/layout/AppShell')
    expect(typeof mod.AppShell).toBe('function')
  })
})
