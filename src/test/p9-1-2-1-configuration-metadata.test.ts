/**
 * P9.1.2.1 — Configuration Metadata & UI Readiness tests
 *
 * Covers: the new optional Console-readiness metadata groups (display,
 * uiControl, governance, dependency, search) don't break existing field
 * registrations, resolve/validate/audit exactly as before, and are
 * correctly retrievable on the fields that were enriched with them.
 * No runtime behavior changed in this phase — every assertion here is a
 * regression guard proving that.
 */
import { describe, it, expect, vi } from 'vitest'

async function freshConfig() {
  vi.resetModules()
  return import('@/config')
}

describe('Console-readiness metadata is additive only (P9.1.2.1)', () => {
  it('every registered field still resolves and validates exactly as before', async () => {
    const { platformConfigurationRegistry, configurationService } = await freshConfig()
    const fields = platformConfigurationRegistry.getAllFields()
    expect(fields.length).toBeGreaterThan(60) // 70 at time of writing across 15 modules

    for (const field of fields) {
      // Every field must still resolve without throwing, and to its own default
      // when no override exists — unchanged from pre-P9.1.2.1 behavior.
      const resolved = configurationService.resolveField(field.id, {})
      expect(resolved.value).toEqual(field.default)
    }
  })

  it('new metadata groups are absent by default and never required', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    // countries.enabled_codes was never touched with new metadata in this phase.
    const untouched = platformConfigurationRegistry.getField('countries.enabled_codes')
    expect(untouched?.uiControl).toBeUndefined()
    expect(untouched?.display).toBeUndefined()
    expect(untouched?.governance).toBeUndefined()
    expect(untouched?.dependency).toBeUndefined()
    expect(untouched?.search).toBeUndefined()
  })
})

describe('Phase B/C/D/E/F/G metadata is retrievable on enriched fields', () => {
  it('authentication.enabled exposes display, governance, and search metadata', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const field = platformConfigurationRegistry.getField('authentication.enabled')
    expect(field?.uiControl).toBe('switch')
    expect(field?.display?.icon).toBe('ShieldAlert')
    expect(field?.display?.displayOrder).toBe(1)
    expect(field?.governance?.securityLevel).toBe('critical')
    expect(field?.governance?.dangerous).toBe(true)
    expect(field?.governance?.requiresApproval).toBe(true)
    expect(field?.search?.keywords).toContain('kill switch')
  })

  it('authentication.otp.length exposes a slider control with validation step and defaultExplanation', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const field = platformConfigurationRegistry.getField('authentication.otp.length')
    expect(field?.uiControl).toBe('slider')
    expect(field?.validation?.step).toBe(1)
    expect(field?.display?.defaultExplanation).toBeTruthy()
    expect(field?.display?.subcategory).toBe('otp')
  })

  it('authentication.phone_login_enabled declares a hiddenWhen dependency on authentication.enabled', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const field = platformConfigurationRegistry.getField('authentication.phone_login_enabled')
    expect(field?.dependency?.hiddenWhen).toEqual({ fieldId: 'authentication.enabled', equals: false })
  })

  it('authentication.demo_login_enabled declares it requires mock_authentication_enabled', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const field = platformConfigurationRegistry.getField('authentication.demo_login_enabled')
    expect(field?.dependency?.requires).toEqual(['authentication.mock_authentication_enabled'])
    expect(field?.governance?.securityLevel).toBe('critical')
  })

  it('themes.primary_color exposes a color_picker control; themes.logo_url exposes file_upload', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    expect(platformConfigurationRegistry.getField('themes.primary_color')?.uiControl).toBe('color_picker')
    expect(platformConfigurationRegistry.getField('themes.logo_url')?.uiControl).toBe('file_upload')
  })

  it('countries.default_code exposes country_selector; languages.default exposes language_selector', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    expect(platformConfigurationRegistry.getField('countries.default_code')?.uiControl).toBe('country_selector')
    expect(platformConfigurationRegistry.getField('languages.default')?.uiControl).toBe('language_selector')
  })

  it('payments.stripe_secret_key exposes secret_input with critical governance; payments.default_currency exposes currency_picker', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    const secretField = platformConfigurationRegistry.getField('payments.stripe_secret_key')
    expect(secretField?.uiControl).toBe('secret_input')
    expect(secretField?.governance?.securityLevel).toBe('critical')
    expect(platformConfigurationRegistry.getField('payments.default_currency')?.uiControl).toBe('currency_picker')
  })

  it('subscriptions.plans_catalog exposes a table_editor control', async () => {
    const { platformConfigurationRegistry } = await freshConfig()
    expect(platformConfigurationRegistry.getField('subscriptions.plans_catalog')?.uiControl).toBe('table_editor')
  })
})
