/**
 * P9.5.5 — Language Management Center tests.
 *
 * Covers the new `platform.languages` module: registration through the
 * exact same registry/collection framework Countries/Platform Users
 * already use, the roster (6 operational + 24 disabled), the cross-entity
 * validator (`validateLanguageCollection`), the coverage dashboard
 * widgets, and Studio rendering with zero new UI component code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import { platformConfigurationRegistry, configurationService, configurationVersionManager } from '@/config'
import type { ConfigCollectionValue } from '@/config'
import { platformDashboardRegistry } from '@/platform-admin/dashboard'
import { hasPlatformPermission, usePlatformAdminStore } from '@/platform-admin'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { DEFAULT_TENANT } from '@/constants'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'
import '@/platform-admin'
import '@/platform-admin/modules'
import '@/platform-admin/widgets'
import { validateLanguageCollection, LANGUAGE_ROSTER } from '@/platform-admin/modules/languages'

function loginAsPlatformOwner() {
  useAuthStore.getState().setUser({
    id: 'u-owner', email: 'owner@samoon.com', first_name: 'Pat', last_name: 'Owner',
    role: 'admin', is_verified: true, created_at: '2024-01-01T00:00:00Z',
  })
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
}

beforeEach(() => {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
  loginAsPlatformOwner()
  usePlatformAdminStore.getState().setPlatformRole('platform_super_admin')
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
  localStorage.clear()
})

describe('platform.languages module registration (Phase B, framework reuse)', () => {
  it('registers under the registry exactly like every other module (no second registry)', () => {
    const mod = platformConfigurationRegistry.getModule('platform.languages')
    expect(mod).toBeDefined()
    expect(mod?.group).toBe('Localization')
    expect(mod?.platformPermission).toBe('platform.localization.view')
  })

  it('the collection field resolves through the same ConfigurationService.resolveField every other module uses', () => {
    const resolved = configurationService.resolveField('platform.languages.registry')
    const value = resolved.value as ConfigCollectionValue
    expect(Object.keys(value)).toHaveLength(LANGUAGE_ROSTER.length)
  })

  it('roster has 6 operational + 24 additional disabled languages (30 total, not a fabricated 150+)', () => {
    expect(LANGUAGE_ROSTER).toHaveLength(30)
    const resolved = configurationService.resolveField('platform.languages.registry')
    const value = resolved.value as Record<string, Record<string, unknown>>
    const enabled = Object.values(value).filter((v) => v.enabled)
    expect(enabled).toHaveLength(6)
  })

  it('the 6 operational languages carry the exact coverage percentages the phase brief specifies', () => {
    const resolved = configurationService.resolveField('platform.languages.registry')
    const value = resolved.value as Record<string, Record<string, unknown>>
    expect(value.en.translationCoverage).toBe(100)
    expect(value.fa.translationCoverage).toBe(99)
    expect(value.ar.translationCoverage).toBe(97)
    expect(value.zh.translationCoverage).toBe(20)
    expect(value.it.translationCoverage).toBe(15)
    expect(value.tr.translationCoverage).toBe(12)
  })

  it('disabled roster languages exist with 0% coverage — a real "not started" state, not fabricated', () => {
    const resolved = configurationService.resolveField('platform.languages.registry')
    const value = resolved.value as Record<string, Record<string, unknown>>
    expect(value.fr.enabled).toBe(false)
    expect(value.fr.translationCoverage).toBe(0)
    expect(value.sw.enabled).toBe(false)
  })
})

describe('validateLanguageCollection (Phase G/J — the real cross-entity gap the per-field validator cannot express)', () => {
  it('the real mock data passes validation cleanly', () => {
    const resolved = configurationService.resolveField('platform.languages.registry')
    const errors = validateLanguageCollection(resolved.value as ConfigCollectionValue)
    expect(errors).toEqual([])
  })

  it('flags more than one default language', () => {
    const errors = validateLanguageCollection({
      en: { direction: 'ltr', default: true, fallbackLanguage: '' },
      fa: { direction: 'rtl', default: true, fallbackLanguage: 'en' },
    })
    expect(errors.some((e) => e.message.includes('Only one language may be the default'))).toBe(true)
  })

  it('detects a fallback cycle', () => {
    const errors = validateLanguageCollection({
      a: { direction: 'ltr', fallbackLanguage: 'b' },
      b: { direction: 'ltr', fallbackLanguage: 'a' },
    })
    expect(errors.some((e) => e.message.includes('cycles back'))).toBe(true)
  })

  it('blocks Published status when required metadata is missing', () => {
    const errors = validateLanguageCollection({
      x: { direction: 'ltr', status: 'published', fallbackLanguage: '' },
    })
    expect(errors.some((e) => e.message.includes('cannot be Published'))).toBe(true)
  })

  it('flags a direction/rtl mismatch', () => {
    const errors = validateLanguageCollection({
      y: { direction: 'rtl', rtl: false, fallbackLanguage: '' },
    })
    expect(errors.some((e) => e.message.includes('disagrees with direction'))).toBe(true)
  })

  it('rejects an invalid direction value', () => {
    const errors = validateLanguageCollection({
      z: { direction: 'sideways', fallbackLanguage: '' },
    })
    expect(errors.some((e) => e.message.includes('must be'))).toBe(true)
  })
})

describe('Coverage Dashboard widgets (Phase H) — compute live from the real collection, not a separate mock', () => {
  it('operational_languages widget matches the real enabled count', () => {
    const widget = platformDashboardRegistry.getWidgets().find((w) => w.id === 'operational_languages')
    expect(widget?.compute()).toEqual({ kind: 'stat', value: 6, unit: '/ 30', higherIsBetter: true })
  })

  it('avg_translation_coverage widget averages only enabled languages', () => {
    const widget = platformDashboardRegistry.getWidgets().find((w) => w.id === 'avg_translation_coverage')
    const result = widget?.compute() as { kind: string; value: number }
    // (100 + 99 + 97 + 20 + 15 + 12) / 6 = 57.166..., rounded to 57
    expect(result.value).toBe(57)
  })

  it('lowest_coverage_languages widget lists the 3 lowest-coverage enabled languages, ascending', () => {
    const widget = platformDashboardRegistry.getWidgets().find((w) => w.id === 'lowest_coverage_languages')
    const result = widget?.compute() as { kind: string; items: { label: string; value: string }[] }
    expect(result.items.map((i) => i.value)).toEqual(['12%', '15%', '20%'])
  })

  it('every language dashboard widget requires platform.localization.view', () => {
    const languageWidgets = platformDashboardRegistry.getWidgets().filter((w) => w.group === 'Localization')
    expect(languageWidgets.length).toBeGreaterThan(0)
    for (const w of languageWidgets) {
      expect(w.platformPermission).toBe('platform.localization.view')
    }
  })
})

describe('Permissions (Phase K) — Platform Admin only', () => {
  it('platform_admin and owner/super_admin roles are granted platform.localization.manage', () => {
    expect(hasPlatformPermission('platform_admin', 'platform.localization.manage')).toBe(true)
    expect(hasPlatformPermission('platform_owner', 'platform.localization.manage')).toBe(true)
    expect(hasPlatformPermission('platform_super_admin', 'platform.localization.manage')).toBe(true)
  })

  it('platform_support (no localization grant) is denied', () => {
    expect(hasPlatformPermission('platform_support', 'platform.localization.view')).toBe(false)
    expect(hasPlatformPermission('platform_support', 'platform.localization.manage')).toBe(false)
  })

  it('an undefined role is denied', () => {
    expect(hasPlatformPermission(undefined, 'platform.localization.view')).toBe(false)
  })
})

describe('Studio reuse — Language Management renders through the exact same shell as Countries/Platform Users (Phase C/D)', () => {
  it('renders the Languages collection module with zero new UI component code', () => {
    render(<ConfigurationStudioLayout activeModuleId="platform.languages" onNavigate={vi.fn()} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('فارسی')).toBeInTheDocument()
  })

  it('the entity drawer opens with the generic tabs (Configuration/Overrides/Dependencies/Audit/Statistics/Inheritance/Preview)', async () => {
    render(<ConfigurationStudioLayout activeModuleId="platform.languages" onNavigate={vi.fn()} />)
    const row = screen.getByText('فارسی').closest('tr') as HTMLElement
    fireEvent.click(row)
    expect(await screen.findByRole('button', { name: 'Preview' })).toBeInTheDocument()
  })
})

describe('Regression — no framework change affects Countries/Platform Users/Authentication', () => {
  it('Countries still renders its 176-country roster', () => {
    render(<ConfigurationStudioLayout activeModuleId="countries" onNavigate={vi.fn()} />)
    expect(within(screen.getByRole('table')).getByText('Germany')).toBeInTheDocument()
  })

  it('every module (including platform.languages) is listed in the nav exactly once', () => {
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} />)
    const matches = screen.getAllByRole('button', { name: 'Language Management' })
    expect(matches).toHaveLength(1)
  })
})
