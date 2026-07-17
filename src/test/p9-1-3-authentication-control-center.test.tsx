/**
 * P9.1.3 — Authentication Control Center tests
 *
 * Covers the reusable generic-rendering pieces (configUiHelpers, the
 * ConfigurationModulePage shell rendered end-to-end for the `authentication`
 * module) — dependency-driven hide/show reacting to live edits (not just
 * saved values), search filtering, dirty-state/save/discard, and the mock
 * demo-state seed. Vitest's default per-file module isolation means the
 * registry is already sealed once for this whole file — only the override/
 * cache/audit state needs resetting between tests, so plain static imports
 * are used throughout (no vi.resetModules() dance needed here, unlike the
 * registration-focused P9.0/P9.1.1 test files).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import {
  configurationService,
  configurationAudit,
  configurationVersionManager,
  platformConfigurationRegistry,
} from '@/config'
import {
  __resetAuthenticationMockSeedForTests,
  seedAuthenticationMockOverrides,
} from '@/config/mock-data'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { DEFAULT_TENANT } from '@/constants'
import { ConfigurationModulePage } from '@/components/admin/configuration/ConfigurationModulePage'
import {
  deriveFieldState,
  evaluateCondition,
  isFieldVisible,
  matchesSearch,
  resolveUiControl,
} from '@/components/admin/configuration/configUiHelpers'

function resetConfigState() {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
  __resetAuthenticationMockSeedForTests()
}

function loginAsPlatformOwner() {
  useAuthStore.getState().setUser({
    id: 'u-owner', email: 'owner@samoon.com', first_name: 'Pat', last_name: 'Owner',
    role: 'admin', is_verified: true, created_at: '2024-01-01T00:00:00Z',
  })
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
  useRbacStore.getState().setCurrentTenantSession(DEFAULT_TENANT.id, ['owner'], normalizeTenantPermissions(['owner']).permissions)
}

beforeEach(() => {
  resetConfigState()
  loginAsPlatformOwner()
})

describe('configUiHelpers (pure)', () => {
  it('resolveUiControl prefers an explicit uiControl over the type-based default', () => {
    const field = platformConfigurationRegistry.getField('authentication.enabled')!
    expect(field.uiControl).toBe('switch')
    expect(resolveUiControl(field)).toBe('switch')
  })

  it('resolveUiControl falls back to a type-based default when uiControl is unset', () => {
    const field = platformConfigurationRegistry.getField('authentication.lockout_duration_minutes')!
    const bareField = { ...field, uiControl: undefined }
    expect(field.type).toBe('number')
    expect(resolveUiControl(bareField)).toBe('number')
  })

  it('evaluateCondition matches equals/notEquals/in against a resolved value map', () => {
    const resolvedValues = { 'authentication.enabled': configurationService.resolveField('authentication.enabled', {}) }
    expect(evaluateCondition({ fieldId: 'authentication.enabled', equals: true }, resolvedValues)).toBe(true)
    expect(evaluateCondition({ fieldId: 'authentication.enabled', equals: false }, resolvedValues)).toBe(false)
    expect(evaluateCondition({ fieldId: 'authentication.enabled', notEquals: false }, resolvedValues)).toBe(true)
    expect(evaluateCondition({ fieldId: 'authentication.enabled', in: [true, 'x'] }, resolvedValues)).toBe(true)
  })

  it('isFieldVisible hides a field whose hiddenWhen condition currently holds', () => {
    const otpLength = platformConfigurationRegistry.getField('authentication.otp.length')!
    const values = {
      'authentication.otp.enabled': configurationService.resolveField('authentication.otp.enabled', {}),
    }
    expect(isFieldVisible(otpLength, values)).toBe(true) // otp.enabled is true by default
    values['authentication.otp.enabled'] = { ...values['authentication.otp.enabled'], value: false }
    expect(isFieldVisible(otpLength, values)).toBe(false)
  })

  it('matchesSearch matches on keywords even when the query does not appear in the title', () => {
    const field = platformConfigurationRegistry.getField('authentication.max_login_attempts')!
    expect(field.search?.keywords).toContain('brute force')
    expect(matchesSearch(field, 'brute force')).toBe(true)
    expect(matchesSearch(field, 'totally unrelated query')).toBe(false)
    expect(matchesSearch(field, '')).toBe(true)
  })

  it('deriveFieldState reports "modified" once a platform-owned field\'s resolved value differs from its default', () => {
    const field = platformConfigurationRegistry.getField('authentication.max_login_attempts')!
    const untouched = configurationService.resolveField(field.id, {})
    expect(deriveFieldState(field, untouched)).toBe('default')

    configurationService.updateField({
      fieldId: field.id, value: 9, level: 'platform', scope: {},
      actor: { id: 'u1', name: 'Test' }, reason: 'test',
    })
    const modified = configurationService.resolveField(field.id, {})
    expect(deriveFieldState(field, modified)).toBe('modified')
  })
})

describe('seedAuthenticationMockOverrides (Phase N)', () => {
  it('is idempotent and produces real, resolvable overrides plus audit history', () => {
    seedAuthenticationMockOverrides()
    seedAuthenticationMockOverrides() // second call must no-op, not double-apply

    const cooldown = configurationService.resolveField('authentication.otp.resend_cooldown_seconds', {})
    expect(cooldown.value).toBe(45)

    const attempts = configurationService.resolveField('authentication.max_login_attempts', {})
    expect(attempts.value).toBe(7)

    const guestCheckout = configurationService.resolveField('authentication.guest_checkout_enabled', {})
    expect(guestCheckout.value).toBe(false)

    const history = configurationAudit.listForField('authentication.max_login_attempts')
    expect(history).toHaveLength(1)
    expect(history[0].reason).toBeTruthy()
  })
})

describe('ConfigurationModulePage — Authentication (end-to-end render)', () => {
  it('renders every visible field with its title, grouped into the registry\'s own sections', () => {
    render(<ConfigurationModulePage moduleId="authentication" />)
    expect(screen.getByText('Authentication Enabled')).toBeInTheDocument()
    expect(screen.getByText('Core Toggles')).toBeInTheDocument()
    expect(screen.getByText('OTP')).toBeInTheDocument()
    expect(screen.getByText('Login Attempts & Lockout')).toBeInTheDocument()
    expect(screen.getByText('Demo / Mock')).toBeInTheDocument()
  })

  it('hides OTP-dependent fields immediately when OTP Login Enabled is toggled off, before saving', async () => {
    render(<ConfigurationModulePage moduleId="authentication" />)
    expect(screen.getByText('OTP Code Length')).toBeInTheDocument()

    const otpRow = screen.getByText('OTP Login Enabled').closest('[data-field-id]') as HTMLElement
    const toggle = within(otpRow).getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => expect(screen.queryByText('OTP Code Length')).not.toBeInTheDocument())
    // The saved resolved value is untouched until Save is clicked — only the
    // live draft drives visibility, proving the dependency engine reacts to
    // in-progress edits (P9.1.3 Phase E), not only committed state.
    expect(configurationService.resolveField('authentication.otp.enabled', {}).value).toBe(true)
  })

  it('shows an "Unsaved" badge and a sticky save bar once a field is dirty, and clears both after Save', async () => {
    render(<ConfigurationModulePage moduleId="authentication" />)
    const otpRow = screen.getByText('OTP Login Enabled').closest('[data-field-id]') as HTMLElement
    fireEvent.click(within(otpRow).getByRole('switch'))

    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    expect(within(otpRow).getByText('Unsaved')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.queryByText('1 unsaved change')).not.toBeInTheDocument(), { timeout: 2000 })
    expect(configurationService.resolveField('authentication.otp.enabled', {}).value).toBe(false)
  })

  it('search filters the visible field list live', () => {
    render(<ConfigurationModulePage moduleId="authentication" />)
    const search = screen.getByPlaceholderText(/search authentication settings/i)
    fireEvent.change(search, { target: { value: 'brute force' } })
    expect(screen.getByText('Max Login Attempts')).toBeInTheDocument()
    expect(screen.queryByText('Refresh Token Lifetime (days)')).not.toBeInTheDocument()
  })

  it('renders "Unknown configuration module" for an unregistered module id instead of crashing', () => {
    render(<ConfigurationModulePage moduleId="not-a-real-module" />)
    expect(screen.getByText(/unknown configuration module/i)).toBeInTheDocument()
  })
})
