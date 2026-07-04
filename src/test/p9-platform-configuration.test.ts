/**
 * P9.0 — Platform Configuration Foundation tests
 *
 * Covers the registry (Phase C), schema system (Phase D), and service layer
 * (Phase E): registration integrity, inheritance resolution, validation,
 * locked-field enforcement, caching, and audit redaction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Fresh module scope per test so the sealed registry doesn't bleed across tests. */
async function freshConfig() {
  vi.resetModules()
  return import('@/config')
}

describe('PlatformConfigurationRegistry (P9.0 Phase C)', () => {
  it('registers all 14 platform modules with unique ids', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const modules = platformConfigurationRegistry.getModules()
    const ids = modules.map((m) => m.id)
    expect(ids.length).toBe(new Set(ids).size)
    expect(ids).toEqual(
      expect.arrayContaining([
        'countries', 'languages', 'typography', 'themes', 'authentication',
        'feature_flags', 'subscriptions', 'payments', 'storage', 'monitoring',
        'notifications', 'website_builder', 'rbac', 'system', 'api',
      ]),
    )
  })

  it('every field carries required Rule 5 metadata', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    for (const field of platformConfigurationRegistry.getAllFields()) {
      expect(field.id).toBeTruthy()
      expect(field.title).toBeTruthy()
      expect(field.category).toBeTruthy()
      expect(field.permissions.view).toBeTruthy()
      expect(field.permissions.edit).toBeTruthy()
      expect(field.version).toBeTruthy()
      expect(field.inheritance).toBeDefined()
      expect(field.audit).toBeDefined()
    }
  })

  it('throws when registering a duplicate field id', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    expect(() =>
      platformConfigurationRegistry.register({
        id: 'duplicate-test-module',
        name: 'Dup',
        description: 'dup',
        category: 'test',
        version: '1.0.0',
        permissions: { view: 'settings.view', edit: 'settings.manage' },
        sections: [{ id: 's', title: 's', fields: [{
          id: 'authentication.otp.length', // collides with authentication module
          title: 'Dup', category: 'test', type: 'number', default: 1,
          visibility: 'admin_only', permissions: { view: 'settings.view', edit: 'settings.manage' },
          preview: { kind: 'none' },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
          audit: { trackHistory: true, requireReason: false, sensitive: false },
          version: '1.0.0',
        }] }],
      }),
    ).toThrow(/duplicate field id/)
  })
})

describe('ConfigurationResolver — Platform → Tenant → Branch → User (Rule 4)', () => {
  it('falls back to the platform default with no overrides', async () => {
    const { configurationService } = await freshConfig()
    const resolved = configurationService.resolveField('themes.primary_color', { tenantId: 't1' })
    expect(resolved.value).toBe('#f97316')
    expect(resolved.resolvedFrom).toBe('platform')
  })

  it('a tenant override wins over the platform default', async () => {
    const { configurationService } = await freshConfig()
    configurationService.updateField({
      fieldId: 'themes.primary_color',
      value: '#0ea5e9',
      level: 'tenant',
      scope: { tenantId: 't1' },
      actor: { id: 'u1', name: 'Test Admin' },
    })
    const resolved = configurationService.resolveField('themes.primary_color', { tenantId: 't1' })
    expect(resolved.value).toBe('#0ea5e9')
    expect(resolved.resolvedFrom).toBe('tenant')
  })

  it('a locked field rejects overrides at descendant levels', async () => {
    const { configurationService } = await freshConfig()
    expect(() =>
      configurationService.updateField({
        fieldId: 'authentication.otp.length',
        value: 4,
        level: 'tenant',
        scope: { tenantId: 't1' },
        actor: { id: 'u1', name: 'Test Admin' },
      }),
    ).toThrow(/cannot be overridden/)
  })

  it('overrides scoped to another tenant do not leak', async () => {
    const { configurationService } = await freshConfig()
    configurationService.updateField({
      fieldId: 'themes.primary_color',
      value: '#111111',
      level: 'tenant',
      scope: { tenantId: 't1' },
      actor: { id: 'u1', name: 'Test Admin' },
    })
    const other = configurationService.resolveField('themes.primary_color', { tenantId: 't2' })
    expect(other.value).toBe('#f97316')
  })
})

describe('ConfigurationValidator (Phase E)', () => {
  it('rejects a value outside the declared numeric range', async () => {
    const { configurationService } = await freshConfig()
    expect(() =>
      configurationService.updateField({
        fieldId: 'subscriptions.trial_days',
        value: 999,
        level: 'platform',
        scope: {},
        actor: { id: 'u1', name: 'Test Admin' },
      }),
    ).toThrow(/validation failed/)
  })
})

describe('ConfigurationAudit (Rule 6)', () => {
  it('redacts sensitive field values in the audit trail', async () => {
    const { configurationService, configurationAudit } = await freshConfig()
    configurationService.updateField({
      fieldId: 'payments.stripe_secret_key',
      value: 'sk_live_super_secret',
      level: 'tenant',
      scope: { tenantId: 't1' },
      actor: { id: 'u1', name: 'Test Admin' },
      reason: 'Rotate key',
    })
    const [entry] = configurationAudit.listForField('payments.stripe_secret_key')
    expect(entry.newValue).toBe('••••••')
    expect(entry.reason).toBe('Rotate key')
  })

  it('requires a reason when the field demands one', async () => {
    const { configurationService } = await freshConfig()
    expect(() =>
      configurationService.updateField({
        fieldId: 'payments.stripe_secret_key',
        value: 'sk_live_x',
        level: 'tenant',
        scope: { tenantId: 't1' },
        actor: { id: 'u1', name: 'Test Admin' },
      }),
    ).toThrow(/requires a reason/)
  })
})
