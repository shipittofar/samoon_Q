/**
 * Payments Module — P9.0 / Phase C+G
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const PAYMENTS_MODULE: ConfigModuleDefinition = {
  id: 'payments',
  name: 'Payments',
  description: 'Enabled payment providers, default currency, and processing fee policy.',
  category: 'commerce',
  group: 'Subscriptions',
  version: '1.0.0',
  icon: 'Wallet',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'payments.providers',
      title: 'Providers',
      fields: [
        defineField({
          id: 'payments.enabled_providers',
          title: 'Enabled Providers',
          category: 'commerce',
          type: 'multi-select',
          default: ['stripe', 'cash'],
          options: [
            { value: 'stripe', label: 'Stripe' },
            { value: 'cash', label: 'Cash on Delivery' },
            { value: 'wallet', label: 'Platform Wallet' },
            { value: 'gift_card', label: 'Gift Card' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'payments.stripe_publishable_key',
          title: 'Stripe Publishable Key',
          category: 'commerce',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'payments.stripe_secret_key',
          title: 'Stripe Secret Key',
          category: 'commerce',
          type: 'secret',
          default: '',
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: true },
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
          uiControl: 'secret_input',
          governance: { securityLevel: 'critical', dangerous: true },
        }),
        defineField({
          id: 'payments.default_currency',
          title: 'Default Currency',
          category: 'commerce',
          type: 'select',
          default: 'USD',
          options: [
            { value: 'USD', label: 'US Dollar' },
            { value: 'EUR', label: 'Euro' },
            { value: 'AED', label: 'UAE Dirham' },
            { value: 'TRY', label: 'Turkish Lira' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
          uiControl: 'currency_picker',
        }),
        defineField({
          id: 'payments.platform_fee_percent',
          title: 'Platform Fee (%)',
          category: 'commerce',
          type: 'number',
          default: 2.5,
          validation: { min: 0, max: 15 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(PAYMENTS_MODULE)
