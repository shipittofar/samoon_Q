/**
 * Subscriptions Module — P9.0 / Phase C+G
 * Platform-defined subscription plans and trial policy.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'tenant.view', edit: 'tenant.manage' }

export const SUBSCRIPTIONS_MODULE: ConfigModuleDefinition = {
  id: 'subscriptions',
  name: 'Subscriptions',
  description: 'Billing plans, trial length, and grace-period policy for tenant subscriptions.',
  category: 'billing',
  version: '1.0.0',
  icon: 'CreditCard',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'subscriptions.plans',
      title: 'Plans',
      fields: [
        defineField({
          id: 'subscriptions.plans_catalog',
          title: 'Plan Catalog',
          description: 'The platform-defined plans tenants may subscribe to.',
          category: 'billing',
          type: 'json',
          default: [
            { id: 'starter', name: 'Starter', priceMonthly: 29, branchLimit: 1, staffLimit: 5 },
            { id: 'growth', name: 'Growth', priceMonthly: 79, branchLimit: 5, staffLimit: 25 },
            { id: 'enterprise', name: 'Enterprise', priceMonthly: 249, branchLimit: -1, staffLimit: -1 },
          ],
          permissions: PERMISSIONS,
          preview: { kind: 'json' },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'subscriptions.default_plan_id',
          title: 'Default Plan',
          category: 'billing',
          type: 'select',
          default: 'starter',
          options: [
            { value: 'starter', label: 'Starter' },
            { value: 'growth', label: 'Growth' },
            { value: 'enterprise', label: 'Enterprise' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'subscriptions.trial_days',
          title: 'Trial Length (days)',
          category: 'billing',
          type: 'number',
          default: 14,
          validation: { min: 0, max: 90 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'subscriptions.grace_period_days',
          title: 'Payment Grace Period (days)',
          description: 'Days a tenant retains access after a failed billing charge.',
          category: 'billing',
          type: 'number',
          default: 7,
          validation: { min: 0, max: 30 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(SUBSCRIPTIONS_MODULE)
