/**
 * Notifications Module — P9.0 / Phase C+G
 * Platform-level notification provider config, distinct from the per-tenant
 * NotificationPreference model in src/types/notification.ts (which governs
 * a single user's channel opt-ins, not which providers exist).
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'notifications.view', edit: 'settings.manage' }

export const NOTIFICATIONS_MODULE: ConfigModuleDefinition = {
  id: 'notifications',
  name: 'Notifications',
  description: 'Delivery providers and default channel policy for platform notifications.',
  category: 'communications',
  group: 'Automation',
  version: '1.0.0',
  icon: 'Bell',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'notifications.providers',
      title: 'Providers',
      fields: [
        defineField({
          id: 'notifications.email_provider',
          title: 'Email Provider',
          category: 'communications',
          type: 'select',
          default: 'sendgrid',
          options: [
            { value: 'sendgrid', label: 'SendGrid' },
            { value: 'ses', label: 'Amazon SES' },
            { value: 'postmark', label: 'Postmark' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'notifications.sms_provider',
          title: 'SMS Provider',
          category: 'communications',
          type: 'select',
          default: 'twilio',
          options: [
            { value: 'twilio', label: 'Twilio' },
            { value: 'vonage', label: 'Vonage' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'notifications.push_enabled',
          title: 'Push Notifications Enabled',
          category: 'communications',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'notifications.default_channels',
          title: 'Default Channels',
          description: 'Channels enabled by default for a new user, before their own preferences apply.',
          category: 'communications',
          type: 'multi-select',
          default: ['push', 'email'],
          options: [
            { value: 'push', label: 'Push' },
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'SMS' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(NOTIFICATIONS_MODULE)
