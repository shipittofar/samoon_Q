/**
 * API Module — P9.0 / Phase C+G
 * Platform-level API access policy — versioning, CORS, and webhook delivery.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const API_MODULE: ConfigModuleDefinition = {
  id: 'api',
  name: 'API',
  description: 'Public API versioning, CORS allow-list, and webhook delivery policy.',
  category: 'platform',
  version: '1.0.0',
  icon: 'Webhook',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'api.access',
      title: 'Access',
      fields: [
        defineField({
          id: 'api.current_version',
          title: 'Current API Version',
          category: 'platform',
          type: 'string',
          default: 'v1',
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'api.cors_allowed_origins',
          title: 'CORS Allowed Origins',
          category: 'platform',
          type: 'array',
          default: ['https://savor.app'],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'merge', fallback: 'inherit' },
        }),
        defineField({
          id: 'api.webhook_retry_attempts',
          title: 'Webhook Retry Attempts',
          category: 'platform',
          type: 'number',
          default: 3,
          validation: { min: 0, max: 10 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'api.public_api_enabled',
          title: 'Public API Enabled',
          category: 'platform',
          type: 'feature_flag',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(API_MODULE)
