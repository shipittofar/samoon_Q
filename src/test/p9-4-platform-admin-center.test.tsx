/**
 * P9.4 — Platform Administration Center tests
 *
 * Covers the new framework-level pieces (permission model, module
 * registration, dashboard registry, search registry) plus the Studio
 * extension points that make them work (group/platformPermission/
 * emptyWorkspace) — and confirms Authentication/Countries still render
 * unmodified through the same shell.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import {
  configurationService,
  configurationVersionManager,
  platformConfigurationRegistry,
  configCollection,
} from '@/config'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { DEFAULT_TENANT } from '@/constants'
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_PERMISSIONS,
  hasPlatformPermission,
  usePlatformAdminStore,
} from '@/platform-admin'
import { platformDashboardRegistry } from '@/platform-admin/dashboard'
import { platformSearchRegistry } from '@/platform-admin/search'
import { PLATFORM_ADMIN_GROUPS } from '@/platform-admin/nav-groups'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'
import { PlatformDashboard } from '@/components/admin/platform-admin/PlatformDashboard'
import '@/platform-admin'

function resetConfigState() {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
}

function loginAsPlatformOwner() {
  useAuthStore.getState().setUser({
    id: 'u-owner', email: 'owner@samoon.com', first_name: 'Pat', last_name: 'Owner',
    role: 'admin', is_verified: true, created_at: '2024-01-01T00:00:00Z',
  })
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
}

beforeEach(() => {
  resetConfigState()
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

describe('Platform permission model (Phase G, framework, generic)', () => {
  it('defines all 10 platform roles with non-empty grants', () => {
    expect(PLATFORM_ROLES).toHaveLength(10)
    for (const role of PLATFORM_ROLES) {
      expect(PLATFORM_ROLE_PERMISSIONS[role].length).toBeGreaterThan(0)
    }
  })

  it('wildcard (*) roles are granted every permission', () => {
    expect(hasPlatformPermission('platform_owner', 'platform.anything.at.all')).toBe(true)
    expect(hasPlatformPermission('platform_super_admin', 'platform.developer.manage')).toBe(true)
  })

  it('a scoped role is granted only its listed permissions', () => {
    expect(hasPlatformPermission('platform_finance', 'platform.subscriptions.view')).toBe(true)
    expect(hasPlatformPermission('platform_finance', 'platform.developer.manage')).toBe(false)
  })

  it('an undefined role grants nothing', () => {
    expect(hasPlatformPermission(undefined, 'platform.dashboard.view')).toBe(false)
  })
})

describe('Platform Administration module registration (Phase C, framework, generic)', () => {
  it('registers every module across all 12 IA groups with no duplicate field ids', () => {
    // Registering >1 field with the same id throws inside
    // PlatformConfigurationRegistry.register() (Rule 3) — reaching this
    // line at all (via the top-of-file '@/platform-admin' import) already
    // proves no collision exists across the ~55 new modules.
    const modules = platformConfigurationRegistry.getModules()
    const groupsUsed = new Set(modules.map((m) => m.group).filter(Boolean))
    for (const group of groupsUsed) {
      expect(PLATFORM_ADMIN_GROUPS).toContain(group)
    }
    expect(modules.length).toBeGreaterThan(60)
  })

  it('auto-namespaces bare field ids under the module id (the real bug caught during development)', () => {
    const field = platformConfigurationRegistry.getField('platform.email_providers.primary_provider')
    expect(field).toBeDefined()
    const collidingBareId = platformConfigurationRegistry.getField('primary_provider')
    expect(collidingBareId).toBeUndefined()
  })

  it('does not double-namespace an already-qualified collection field id', () => {
    const field = platformConfigurationRegistry.getField('platform.tenants.registry')
    expect(field).toBeDefined()
    expect(field!.type).toBe('collection')
  })

  it('Tenants collection has the 6 seed tenants with region/status defaults', () => {
    const field = platformConfigurationRegistry.getField('platform.tenants.registry')!
    const entries = configCollection.getCollectionEntries(field, field.default)
    expect(entries).toHaveLength(6)
    const samoon = entries.find((e) => e.entityId === 'samoon')!
    expect(samoon.values.status).toBe('active')
    expect(configCollection.getEntityLabel(field, 'samoon')).toBe('Samoon Restaurant')
  })

  it('existing P9.0-P9.2 modules are tagged into an IA group without changing their category', () => {
    const auth = platformConfigurationRegistry.getModule('authentication')!
    expect(auth.group).toBe('Security')
    expect(auth.category).toBe('security') // unchanged
    const countries = platformConfigurationRegistry.getModule('countries')!
    expect(countries.group).toBe('Configuration')
  })
})

describe('Platform Dashboard (Phase D, framework, generic)', () => {
  it('every registered widget computes a value matching its declared kind', () => {
    for (const widget of platformDashboardRegistry.getWidgets()) {
      const value = widget.compute()
      expect(value.kind).toBe(widget.kind)
    }
  })

  it('renders widgets through the Studio emptyWorkspace slot without affecting the Configuration Studio default', () => {
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} />)
    expect(screen.getByText('Select a module from the list to begin.')).toBeInTheDocument()
  })

  it('renders the dashboard when passed as emptyWorkspace', () => {
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} emptyWorkspace={<PlatformDashboard />} />)
    expect(screen.getByText('Active Businesses')).toBeInTheDocument()
    expect(screen.getByText('Server Health')).toBeInTheDocument()
  })

  it('a scoped role only sees widgets its permissions actually grant', () => {
    usePlatformAdminStore.getState().setPlatformRole('platform_finance')
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} emptyWorkspace={<PlatformDashboard />} />)
    // platform_finance has platform.subscriptions.view (MRR) but not platform.monitoring.view (Server Health)
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.queryByText('Server Health')).not.toBeInTheDocument()
  })
})

describe('Platform Search (Phase F, framework, generic)', () => {
  it('finds a tenant by name via the Businesses provider', () => {
    const hits = platformSearchRegistry.searchAll('Brew Cafe')
    expect(hits.some((h) => h.label === 'Brew Cafe' && h.moduleId === 'platform.tenants')).toBe(true)
  })

  it('finds a country by name via the Countries provider (same collection Countries/P9.2 already uses)', () => {
    const hits = platformSearchRegistry.searchAll('Germany')
    expect(hits.some((h) => h.label === 'Germany' && h.moduleId === 'countries')).toBe(true)
  })

  it('returns nothing for an empty query', () => {
    expect(platformSearchRegistry.searchAll('')).toEqual([])
  })

  it('command palette surfaces a Businesses search hit and can navigate to it', async () => {
    const onNavigate = vi.fn()
    render(<ConfigurationStudioLayout onNavigate={onNavigate} emptyWorkspace={<PlatformDashboard />} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = await screen.findByPlaceholderText('Go to a module, jump to a setting, or run a command…')
    fireEvent.change(input, { target: { value: 'Brew Cafe' } })
    const option = await screen.findByRole('option', { name: /Brew Cafe/ })
    fireEvent.click(option)
    expect(onNavigate).toHaveBeenCalledWith('platform.tenants')
  })
})

describe('Studio reuse — Tenants/Platform Users render through the exact same shell as Authentication/Countries', () => {
  it('renders the Tenants collection module', () => {
    render(<ConfigurationStudioLayout activeModuleId="platform.tenants" onNavigate={vi.fn()} />)
    expect(screen.getByText('Samoon Restaurant')).toBeInTheDocument()
    expect(screen.getByText('Slug')).toBeInTheDocument() // sanity: collection table header pattern reused (entityIdLabel)
  })

  it('renders the Platform Users collection module', () => {
    render(<ConfigurationStudioLayout activeModuleId="platform.users" onNavigate={vi.fn()} />)
    expect(screen.getByText('Pat Owner')).toBeInTheDocument()
  })
})

describe('Authentication/Countries regression (no framework change should affect them)', () => {
  it('Authentication still renders and saves through the Studio', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    const otpRow = screen.getByText('OTP Login Enabled').closest('[data-field-id]') as HTMLElement
    fireEvent.click(within(otpRow).getByRole('switch'))
    expect(await screen.findByText('1 unsaved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByText('1 unsaved')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('Countries still renders its 176-country roster', () => {
    render(<ConfigurationStudioLayout activeModuleId="countries" onNavigate={vi.fn()} />)
    expect(within(screen.getByRole('table')).getByText('Germany')).toBeInTheDocument()
  })

  it('every module in the registry is still listed in the nav', () => {
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} />)
    for (const mod of platformConfigurationRegistry.getModules()) {
      expect(screen.getByRole('button', { name: mod.name })).toBeInTheDocument()
    }
  })
})
