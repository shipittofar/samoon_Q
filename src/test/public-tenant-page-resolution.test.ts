import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_TENANT } from '@/constants'
import { useTenantStore } from '@/stores'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import type { Tenant } from '@/types'

const ROOT = join(__dirname, '..')

describe('Public Tenant page — SSR handoff and path slug', () => {
  it('passes SSR-resolved Tenant into TenantHomepageClient', () => {
    const page = readFileSync(join(ROOT, 'app', '[tenantSlug]', 'page.tsx'), 'utf8')
    const client = readFileSync(join(ROOT, 'app', '[tenantSlug]', 'TenantHomepageClient.tsx'), 'utf8')
    expect(page).toContain('initialTenant={tenant}')
    expect(client).toContain('usePublicTenant(tenantSlug')
    expect(client).toContain('initialData: initialTenant')
    expect(client).not.toContain('tenantState !== \'resolved\'')
  })

  it('TenantBootstrapper prefers the path slug over hostname-only readTenantSlug', () => {
    const src = readFileSync(join(ROOT, 'providers', 'index.tsx'), 'utf8')
    expect(src).toContain('readPublicPathTenantSlug(pathname)')
    expect(src).toContain('const slug = pathSlug ?? readTenantSlug()')
  })
})

describe('loadTenant — force failure and concurrency', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('keeps an already-resolved Tenant when force refresh fails', async () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, id: 'keep-1', slug: 'acme', is_active: true }
    useTenantStore.setState({ tenant, tenantState: 'resolved', isLoading: false })
    vi.spyOn(tenantService, 'getTenantBySlug').mockRejectedValueOnce(new TenantNotFoundError('acme'))

    await useTenantStore.getState().loadTenant('acme', { force: true })

    expect(useTenantStore.getState().tenant?.id).toBe('keep-1')
    expect(useTenantStore.getState().tenantState).toBe('resolved')
  })

  it('does not let an older failed request overwrite a newer success', async () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, id: 't-1', slug: 'acme', name: 'First', is_active: true }
    const newer: Tenant = { ...tenant, name: 'Second' }
    useTenantStore.setState({ tenant, tenantState: 'resolved', isLoading: false })

    let rejectOlder!: (err: Error) => void
    const older = new Promise<Tenant>((_, rej) => {
      rejectOlder = rej
    })
    let calls = 0
    vi.spyOn(tenantService, 'getTenantBySlug').mockImplementation(async () => {
      calls += 1
      if (calls === 1) return older
      return newer
    })

    const first = useTenantStore.getState().loadTenant('acme', { force: true })
    const second = useTenantStore.getState().loadTenant('acme', { force: true })
    await second
    rejectOlder(new TenantNotFoundError('acme'))
    await first

    expect(useTenantStore.getState().tenant?.name).toBe('Second')
    expect(useTenantStore.getState().tenantState).toBe('resolved')
  })

  it('classifies an inactive Tenant as forbidden, not not_found', async () => {
    await useTenantStore.getState().loadTenant('road-bites')
    expect(useTenantStore.getState().tenantState).toBe('forbidden')
    expect(useTenantStore.getState().tenant).toBeNull()
  })
})
