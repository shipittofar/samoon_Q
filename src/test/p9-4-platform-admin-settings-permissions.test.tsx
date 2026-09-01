/**
 * Platform Admin Configuration Studio — permissionContext="platform"
 * uses Django is_superuser, not tenant settings.view / platformRole.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderWithIntl as render } from './test-utils'
import { configurationService, configurationVersionManager } from '@/config'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { usePlatformAdminStore } from '@/platform-admin'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { DEFAULT_TENANT } from '@/constants'
import { ConfigurationModulePage } from '@/components/admin/configuration/ConfigurationModulePage'
import { ConfigurationInspector } from '@/components/admin/configuration/ConfigurationInspector'
import {
  canEditStudioField,
  canViewStudioField,
} from '@/lib/configuration-studio-permissions'
import type { User } from '@/types'

const NO_SETTINGS = 'No settings are visible with your current permissions.'

function resetConfigState() {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'user@samoon.com',
    first_name: 'Pat',
    last_name: 'User',
    accountType: 'business',
    is_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function setUser(overrides: Partial<User> = {}) {
  useAuthStore.setState({
    user: user(overrides),
    isAuthenticated: true,
    isLoading: false,
    sessionCheckFailed: false,
  })
}

function setTenantPermissions(permissions: string[], roles: string[] = ['owner']) {
  const membership = {
    tenantId: DEFAULT_TENANT.id,
    tenantSlug: 'samoon',
    roles: roles as never,
    branchAccess: { scope: 'all' as const },
  }
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setSessionMemberships([membership], membership)
  useRbacStore.getState().setCurrentTenantSession(
    DEFAULT_TENANT.id,
    roles as never,
    permissions as never,
  )
}

beforeEach(() => {
  resetConfigState()
  usePlatformAdminStore.getState().setPlatformRole(null)
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    sessionCheckFailed: false,
  })
  useRbacStore.getState()._resetStore()
})

describe('canViewStudioField / canEditStudioField', () => {
  const field = {
    permissions: { view: 'settings.view', edit: 'settings.manage' },
  } as Parameters<typeof canViewStudioField>[0]

  it('platform context grants view/edit only for is_superuser === true', () => {
    expect(canViewStudioField(field, 'platform', [], user({ is_superuser: true }))).toBe(true)
    expect(canEditStudioField(field, 'platform', [], user({ is_superuser: true }))).toBe(true)
    expect(canViewStudioField(field, 'platform', ['settings.view', 'settings.manage'], user({ is_superuser: false }))).toBe(false)
    expect(canEditStudioField(field, 'platform', ['settings.view', 'settings.manage'], user({ is_staff: true, is_superuser: false }))).toBe(false)
    expect(canViewStudioField(field, 'platform', [], user())).toBe(false)
  })

  it('tenant context still uses settings.view / settings.manage and ignores is_superuser', () => {
    expect(canViewStudioField(field, 'tenant', [], user({ is_superuser: true }))).toBe(false)
    expect(canViewStudioField(field, 'tenant', ['settings.view'], user({ is_superuser: false }))).toBe(true)
    expect(canEditStudioField(field, 'tenant', ['settings.view'], user({ is_superuser: true }))).toBe(false)
    expect(canEditStudioField(field, 'tenant', ['settings.manage'], user())).toBe(true)
  })
})

describe('Platform Admin Settings — permissionContext=platform', () => {
  it('superuser with no tenant membership sees fields', () => {
    setUser({ is_superuser: true })
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
    expect(screen.queryByText(NO_SETTINGS)).not.toBeInTheDocument()
  })

  it('superuser with empty tenant permissions can see and edit', () => {
    setUser({ is_superuser: true })
    setTenantPermissions([])
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
    const row = screen.getByText('Maintenance Mode').closest('[data-field-id]') as HTMLElement
    expect(within(row).queryByText('You don\'t have permission to edit this field.')).toBeNull()
    expect(within(row).getByRole('switch')).not.toBeDisabled()
  })

  it('tenant Console without permissionContext still hides fields without settings.view', () => {
    setUser({ is_superuser: false })
    setTenantPermissions([])
    render(<ConfigurationModulePage moduleId="system" />)
    expect(screen.getByText(NO_SETTINGS)).toBeInTheDocument()
    expect(screen.queryByText('Maintenance Mode')).not.toBeInTheDocument()
  })

  it('tenant Console with permissionContext=tenant shows fields when settings.view is present', () => {
    setUser({ is_superuser: false })
    setTenantPermissions(['settings.view', 'settings.manage'])
    render(<ConfigurationModulePage moduleId="system" permissionContext="tenant" />)
    expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
    expect(screen.queryByText(NO_SETTINGS)).not.toBeInTheDocument()
  })

  it('tenant settings.view does not grant platform-context field visibility', () => {
    setUser({ is_superuser: false })
    setTenantPermissions(['settings.view', 'settings.manage'])
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    expect(screen.getByText(NO_SETTINGS)).toBeInTheDocument()
    expect(screen.queryByText('Maintenance Mode')).not.toBeInTheDocument()
  })

  it('is_staff without is_superuser does not grant platform-context fields', () => {
    setUser({ is_staff: true, is_superuser: false })
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    expect(screen.getByText(NO_SETTINGS)).toBeInTheDocument()
  })

  it('stale platformRole platform_super_admin does not grant Settings visibility', () => {
    setUser({ is_superuser: false })
    usePlatformAdminStore.getState().setPlatformRole('platform_super_admin')
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    expect(screen.getByText(NO_SETTINGS)).toBeInTheDocument()
    expect(screen.queryByText('Maintenance Mode')).not.toBeInTheDocument()
  })

  it('superuser can edit a field and save through the in-memory ConfigurationService', async () => {
    setUser({ id: 'su-1', first_name: 'Su', last_name: 'Per', is_superuser: true })
    const before = configurationService.resolveField('system.maintenance_mode', {}).value
    render(<ConfigurationModulePage moduleId="system" permissionContext="platform" />)
    const row = screen.getByText('Maintenance Mode').closest('[data-field-id]') as HTMLElement
    fireEvent.click(within(row).getByRole('switch'))
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'platform ops' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByText('1 unsaved change')).not.toBeInTheDocument(), { timeout: 2000 })
    expect(configurationService.resolveField('system.maintenance_mode', {}).value).toBe(!before)
  })

  it('inspector history rollback is enabled for a platform superuser without tenant manage', () => {
    setUser({ is_superuser: true })
    setTenantPermissions([])
    configurationService.updateField({
      fieldId: 'system.maintenance_mode',
      value: true,
      level: 'platform',
      scope: {},
      actor: { id: 'su-1', name: 'Su Per' },
      reason: 'test',
    })
    render(
      <ConfigurationInspector
        fieldId="system.maintenance_mode"
        actor={{ id: 'su-1', name: 'Su Per' }}
        permissionContext="platform"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('button', { name: /Roll back to the value from/i })).toBeInTheDocument()
  })

  it('Platform Admin routes pass permissionContext=platform; Console routes do not', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const paIndex = readFileSync(join(dir, '..', 'app', 'platform-admin', 'page.tsx'), 'utf-8')
    const paModule = readFileSync(join(dir, '..', 'app', 'platform-admin', '[moduleId]', 'page.tsx'), 'utf-8')
    const consoleIndex = readFileSync(join(dir, '..', 'app', 'console', 'settings', 'configuration', 'page.tsx'), 'utf-8')
    const consoleModule = readFileSync(join(dir, '..', 'app', 'console', 'settings', 'configuration', '[moduleId]', 'page.tsx'), 'utf-8')
    expect(paIndex).toContain('permissionContext="platform"')
    expect(paModule).toContain('permissionContext="platform"')
    expect(consoleIndex).not.toContain('permissionContext="platform"')
    expect(consoleModule).not.toContain('permissionContext="platform"')
    expect(consoleIndex).not.toMatch(/window\.location/)
    expect(paIndex).not.toMatch(/window\.location/)
  })

  it('ConfigurationModulePage has no runtime platformRole authorization', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, '..', 'components', 'admin', 'configuration', 'ConfigurationModulePage.tsx'), 'utf-8')
    expect(src).not.toContain('platformRole')
    expect(src).not.toContain('platform_super_admin')
    expect(src).not.toContain('hasPlatformPermission')
  })
})
