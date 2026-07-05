/**
 * Platform Administration — Subscriptions group — P9.4 Phase C
 *
 * `subscriptions` and `payments` (P9.0) already cover platform-wide
 * billing *settings* and are tagged into this same IA group via their own
 * files (`group: 'Subscriptions'`) rather than duplicated here. This file
 * registers the browsable-object modules the audit found missing: Plans,
 * Billing, Invoices.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.plans',
  name: 'Plans',
  description: 'Pricing plans available to tenants (Starter, Growth, Enterprise).',
  group: 'Subscriptions',
  icon: 'Layers',
  platformPermission: 'platform.subscriptions.view',
  fields: [
    defineField({ id: 'trial_days', title: 'Default Trial Length (days)', category: 'subscriptions', type: 'number', default: 14, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0, max: 90 } }),
    defineField({ id: 'allow_plan_downgrade', title: 'Allow Self-Serve Downgrade', category: 'subscriptions', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'grace_period_days', title: 'Payment Grace Period (days)', category: 'subscriptions', type: 'number', default: 7, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0, max: 30 } }),
  ],
})

registerAdminModule({
  id: 'platform.billing',
  name: 'Billing',
  description: 'Platform-wide billing cycle and dunning configuration.',
  group: 'Subscriptions',
  icon: 'Receipt',
  platformPermission: 'platform.subscriptions.view',
  fields: [
    defineField({ id: 'billing_cycle', title: 'Default Billing Cycle', category: 'subscriptions', type: 'select', default: 'monthly', options: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annual', label: 'Annual' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'dunning_retry_attempts', title: 'Failed Payment Retry Attempts', category: 'subscriptions', type: 'number', default: 3, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0, max: 10 } }),
    defineField({ id: 'auto_suspend_on_failure', title: 'Auto-Suspend After Retries Exhausted', category: 'subscriptions', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.invoices',
  name: 'Invoices',
  description: 'Invoice generation and numbering configuration.',
  group: 'Subscriptions',
  icon: 'FileText',
  platformPermission: 'platform.subscriptions.view',
  fields: [
    defineField({ id: 'invoice_prefix', title: 'Invoice Number Prefix', category: 'subscriptions', type: 'string', default: 'INV-', permissions: PERMISSIONS, uiControl: 'text' }),
    defineField({ id: 'auto_send_on_issue', title: 'Auto-Send Invoice on Issue', category: 'subscriptions', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'include_tax_breakdown', title: 'Include Tax Breakdown', category: 'subscriptions', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
