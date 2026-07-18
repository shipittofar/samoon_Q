/**
 * P9.3 — Configuration Studio tests
 *
 * Covers the Studio shell (layout/nav/toolbar/inspector/command palette/
 * history/compare) as framework-level, module-agnostic pieces — exercised
 * against Authentication and Countries only as reference consumers, never
 * with module-specific assertions baked into the components themselves.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import {
  configurationService,
  configurationVersionManager,
  platformConfigurationRegistry,
} from '@/config'
import { __resetAuthenticationMockSeedForTests } from '@/config/mock-data'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { DEFAULT_TENANT } from '@/constants'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'

function resetConfigState() {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
  __resetAuthenticationMockSeedForTests()
}

function loginAsPlatformOwner() {
  useAuthStore.getState().setUser({
    id: 'u-owner', email: 'owner@samoon.com', first_name: 'Pat', last_name: 'Owner',
    accountType: 'business', is_verified: true, created_at: '2024-01-01T00:00:00Z',
  })
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
  useRbacStore.getState().setCurrentTenantSession(DEFAULT_TENANT.id, ['owner'], normalizeTenantPermissions(['owner']).permissions)
}

// The global jsdom matchMedia mock (src/test/setup.ts) always reports
// `matches: false`, which would force the Studio into its narrow/mobile
// layout for every test. These tests want the desktop 3-pane layout, so
// override it here to report a desktop-width match instead.
beforeEach(() => {
  resetConfigState()
  loginAsPlatformOwner()
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
  localStorage.clear()
})

describe('ConfigurationStudioLayout — shell (framework, generic)', () => {
  it('renders the nav, toolbar breadcrumb, and workspace for the active module', () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: 'Configuration modules' })).toBeInTheDocument()
    const toolbar = screen.getByRole('banner', { name: 'Configuration toolbar' })
    expect(within(toolbar).getByText('Configuration')).toBeInTheDocument()
    // Breadcrumb + workspace both show the module name — scope to the toolbar to disambiguate.
    expect(within(toolbar).getByText('Authentication')).toBeInTheDocument()
  })

  it('shows a prompt in the workspace when no module is selected', () => {
    render(<ConfigurationStudioLayout onNavigate={vi.fn()} />)
    expect(screen.getByText('Select a module from the list to begin.')).toBeInTheDocument()
  })

  it('calls onNavigate when a module is clicked in the nav', () => {
    const onNavigate = vi.fn()
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Countries' }))
    expect(onNavigate).toHaveBeenCalledWith('countries')
  })

  it('renders Countries through the exact same shell as Authentication (no module-specific branching)', () => {
    render(<ConfigurationStudioLayout activeModuleId="countries" onNavigate={vi.fn()} />)
    expect(screen.getByText('ISO Code')).toBeInTheDocument()
  })

  it('the Inspector shows an empty state until a field is selected, then shows the selected field', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    expect(screen.getByText('No field selected')).toBeInTheDocument()

    const inspectButtons = screen.getAllByRole('button', { name: 'Audit history and details' })
    fireEvent.click(inspectButtons[0])

    await waitFor(() => expect(screen.queryByText('No field selected')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument()
  })
})

describe('ConfigurationStudioToolbar — draft status + save wiring (framework, generic)', () => {
  it('shows an unsaved-changes badge and a working Save button once a field is dirty', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)

    // "OTP Login Enabled" doesn't require a reason, unlike the "Kill Switch"
    // authentication.enabled field — matching the field P9.1.3's own save-bar
    // test uses, since the toolbar's Save button has no reason input (only
    // the bottom sticky save bar does).
    const otpRow = screen.getByText('OTP Login Enabled').closest('[data-field-id]') as HTMLElement
    fireEvent.click(within(otpRow).getByRole('switch'))

    expect(await screen.findByText('1 unsaved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByText('1 unsaved')).not.toBeInTheDocument(), { timeout: 2000 })
  })
})

describe('ConfigurationCommandPalette (framework, generic)', () => {
  it('opens with Ctrl+K and navigates to a module on selection', async () => {
    const onNavigate = vi.fn()
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={onNavigate} />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = await screen.findByPlaceholderText('Go to a module, jump to a setting, or run a command…')
    fireEvent.change(input, { target: { value: 'Countries' } })

    const option = await screen.findByRole('option', { name: /Go to Countries/ })
    fireEvent.click(option)
    expect(onNavigate).toHaveBeenCalledWith('countries')
  })

  it('finds an individual field across the registry, not just modules', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = await screen.findByPlaceholderText('Go to a module, jump to a setting, or run a command…')
    fireEvent.change(input, { target: { value: 'otp' } })
    const list = screen.getByRole('listbox')
    expect(await within(list).findByText(/length/i)).toBeInTheDocument()
  })
})

describe('ConfigurationInheritanceTree + History/Compare (framework, generic)', () => {
  it('inheritance tree renders one row per level in the resolution chain', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Audit history and details' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Inheritance' }))
    expect(await screen.findByRole('list', { name: 'Inheritance chain' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4) // platform/tenant/branch/user
  })

  it('history tab shows an empty state for a never-changed field', async () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Audit history and details' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    expect(await screen.findByText('No history yet')).toBeInTheDocument()
  })
})

describe('Registry-driven — every module registered renders through the Studio', () => {
  it('every module in the registry is listed in the nav', () => {
    render(<ConfigurationStudioLayout activeModuleId="authentication" onNavigate={vi.fn()} />)
    for (const mod of platformConfigurationRegistry.getModules()) {
      expect(screen.getByRole('button', { name: mod.name })).toBeInTheDocument()
    }
  })
})
