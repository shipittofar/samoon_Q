import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const put = vi.fn()
const get = vi.fn()
vi.mock('@/services/axios.instance', () => ({
  default: { put: (...a: unknown[]) => put(...a), get: (...a: unknown[]) => get(...a) },
}))

import { configurationService } from '@/config'
import {
  savePlatformConfigChanges,
  saveConfigChanges,
  loadTenantConfigOverrides,
  __resetTenantConfigLoadsForTests,
} from '@/config/platform-overrides-client'
import { canEditStudioField } from '@/lib/configuration-studio-permissions'
import {
  PlatformConfigHydrator,
  __resetPlatformConfigHydratorForTests,
} from '@/components/PlatformConfigHydrator'

const value = (id: string) => configurationService.resolveField(id, {}).value
const MAX = 'authentication.max_login_attempts' // platform, number, default 5

describe('platform configuration persistence', () => {
  beforeEach(() => {
    configurationService.__resetForTests()
    __resetPlatformConfigHydratorForTests()
    put.mockReset()
    get.mockReset()
    __resetTenantConfigLoadsForTests()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hydrates saved platform values and clears them when the server drops them', () => {
    expect(value(MAX)).toBe(5)
    configurationService.hydratePlatformOverrides({ [MAX]: 7 })
    expect(value(MAX)).toBe(7)
    configurationService.hydratePlatformOverrides({})
    expect(value(MAX)).toBe(5)
  })

  it('ignores unknown, tenant-level and secret fields from the server', () => {
    configurationService.hydratePlatformOverrides({
      'no.such_field': 1,
      'payments.stripe_secret_key': 'sk_live_x',
      'payments.stripe_publishable_key': 'pk',
    })
    expect(configurationService.getFieldLayers('payments.stripe_secret_key', {}).platform).toBeUndefined()
    expect(configurationService.getFieldLayers('payments.stripe_publishable_key', {}).platform).toBeUndefined()
  })

  it('saves only persisted fields, sends defaults as a reset, applies the answer', async () => {
    put.mockResolvedValue({ data: { overrides: { 'authentication.otp.resend_cooldown_seconds': 45 } } })
    await savePlatformConfigChanges(
      [
        { fieldId: MAX, value: 5 },
        { fieldId: 'authentication.otp.resend_cooldown_seconds', value: 45 },
        { fieldId: 'payments.stripe_secret_key', value: 'sk_live_x' },
      ],
      'launch',
    )
    expect(put).toHaveBeenCalledTimes(1)
    const [url, body] = put.mock.calls[0]
    expect(url).toBe('/platform/config/')
    expect(body).toEqual({
      changes: [
        { fieldId: MAX, reset: true },
        { fieldId: 'authentication.otp.resend_cooldown_seconds', value: 45 },
      ],
      reason: 'launch',
    })
    expect(value('authentication.otp.resend_cooldown_seconds')).toBe(45)
  })

  it('a failed save throws and changes nothing', async () => {
    put.mockRejectedValue(new Error('403'))
    await expect(savePlatformConfigChanges([{ fieldId: MAX, value: 8 }])).rejects.toThrow('403')
    expect(value(MAX)).toBe(5)
  })

  it('sends nothing in mock mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
    await savePlatformConfigChanges([{ fieldId: MAX, value: 8 }])
    expect(put).not.toHaveBeenCalled()
  })

  it('hydrator applies the layout payload before children render, and never undoes a newer save', () => {
    let seen: unknown
    function Child() {
      seen = value(MAX)
      return null
    }
    const { rerender } = render(
      <PlatformConfigHydrator overrides={{ [MAX]: 7 }}>
        <Child />
      </PlatformConfigHydrator>,
    )
    expect(seen).toBe(7)
    // The superuser saves 9 in this tab (applied from the PUT answer)...
    configurationService.hydratePlatformOverrides({ [MAX]: 9 })
    // ...and a re-render with the layout's older payload must keep 9.
    rerender(
      <PlatformConfigHydrator overrides={{ [MAX]: 7 }}>
        <Child />
      </PlatformConfigHydrator>,
    )
    expect(seen).toBe(9)
  })

  it('root layout loads the overrides before reading configuration', () => {
    const src = readFileSync(resolve(__dirname, '..', 'app/layout.tsx'), 'utf8')
    const load = src.indexOf('await getPlatformConfigOverrides()')
    expect(load).toBeGreaterThan(-1)
    expect(load).toBeLessThan(src.indexOf('await getLocale()', src.indexOf('export default async function RootLayout')))
    expect(src).toContain('<PlatformConfigHydrator overrides={platformOverrides}>')
  })
})

const CURRENCY = 'payments.default_currency' // tenant-level select
const scoped = (tenantId: string) => configurationService.resolveField(CURRENCY, { tenantId }).value

describe('business (tenant-level) configuration persistence', () => {
  beforeEach(() => {
    configurationService.__resetForTests()
    put.mockReset()
    get.mockReset()
    __resetTenantConfigLoadsForTests()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hydrates each business separately and clears values the server dropped', () => {
    const fallback = scoped('t-1')
    configurationService.hydrateTenantOverrides('t-1', { [CURRENCY]: 'IRR' })
    configurationService.hydrateTenantOverrides('t-2', { [CURRENCY]: 'AED' })
    expect(scoped('t-1')).toBe('IRR')
    expect(scoped('t-2')).toBe('AED')
    configurationService.hydrateTenantOverrides('t-1', {})
    expect(scoped('t-1')).toBe(fallback)
    expect(scoped('t-2')).toBe('AED')
  })

  it('loads a business once and bumps the version for React', async () => {
    get.mockResolvedValue({ data: { overrides: { [CURRENCY]: 'IRR' } } })
    const before = configurationService.getOverridesVersion()
    await Promise.all([loadTenantConfigOverrides('t-1'), loadTenantConfigOverrides('t-1')])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe('/tenants/t-1/config/')
    expect(scoped('t-1')).toBe('IRR')
    expect(configurationService.getOverridesVersion()).toBeGreaterThan(before)
  })

  it('splits a save by level and never sends secrets', async () => {
    put.mockImplementation(async (url: string) => ({
      data: { overrides: url.startsWith('/tenants/') ? { [CURRENCY]: 'IRR' } : { [MAX]: 7 } },
    }))
    await saveConfigChanges(
      [
        { fieldId: CURRENCY, value: 'IRR' },
        { fieldId: MAX, value: 7 },
        { fieldId: 'payments.stripe_secret_key', value: 'sk_live_x' },
      ],
      'setup',
      { tenantId: 't-1' },
    )
    expect(put.mock.calls.map((c) => c[0])).toEqual(['/tenants/t-1/config/', '/platform/config/'])
    expect(put.mock.calls[0][1]).toEqual({ changes: [{ fieldId: CURRENCY, value: 'IRR' }], reason: 'setup' })
    expect(put.mock.calls[1][1]).toEqual({ changes: [{ fieldId: MAX, value: 7 }], reason: 'setup' })
    expect(scoped('t-1')).toBe('IRR')
    expect(value(MAX)).toBe(7)
  })

  it('refuses business-level changes with no business selected', async () => {
    await expect(saveConfigChanges([{ fieldId: CURRENCY, value: 'IRR' }])).rejects.toThrow(/business/i)
    expect(put).not.toHaveBeenCalled()
  })

  it('in a business console, platform-wide fields are read-only except for superusers', () => {
    const platformField = configurationService.getField(MAX)!
    const tenantField = configurationService.getField(CURRENCY)!
    const perms = [platformField.permissions.edit, tenantField.permissions.edit]
    const owner = { id: 'u', is_superuser: false } as never
    const root = { id: 'r', is_superuser: true } as never
    expect(canEditStudioField(platformField, 'tenant', perms, owner)).toBe(false)
    expect(canEditStudioField(tenantField, 'tenant', perms, owner)).toBe(true)
    expect(canEditStudioField(platformField, 'tenant', perms, root)).toBe(true)
  })
})
