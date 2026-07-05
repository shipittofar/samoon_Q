/**
 * System Module — P9.0 / Phase C+G
 * Platform-wide operational switches: maintenance mode, rate limits, retention.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const SYSTEM_MODULE: ConfigModuleDefinition = {
  id: 'system',
  name: 'System',
  description: 'Maintenance mode, global rate limits, and data retention policy.',
  category: 'platform',
  group: 'System',
  version: '1.0.0',
  icon: 'Server',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'system.operations',
      title: 'Operations',
      fields: [
        defineField({
          id: 'system.maintenance_mode',
          title: 'Maintenance Mode',
          category: 'platform',
          type: 'boolean',
          default: false,
          permissions: PERMISSIONS,
          audit: { trackHistory: true, requireReason: true, sensitive: false },
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'system.api_rate_limit_per_minute',
          title: 'API Rate Limit (requests/min)',
          category: 'platform',
          type: 'number',
          default: 300,
          validation: { min: 10, max: 10000 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'system.audit_log_retention_days',
          title: 'Audit Log Retention (days)',
          category: 'platform',
          type: 'number',
          default: 365,
          validation: { min: 30, max: 3650 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'system.default_business_type',
          title: 'Default Business Type',
          description: 'Business type pre-selected during tenant provisioning.',
          category: 'platform',
          type: 'select',
          default: 'restaurant',
          options: [
            { value: 'restaurant', label: 'Restaurant' },
            { value: 'cafe', label: 'Cafe' },
            { value: 'bar', label: 'Bar' },
            { value: 'food_court', label: 'Food Court' },
            { value: 'food_truck', label: 'Food Truck' },
            { value: 'mobile_cafe', label: 'Mobile Cafe' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(SYSTEM_MODULE)
