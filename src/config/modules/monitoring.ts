/**
 * Monitoring Module — P9.0 / Phase C+G
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const MONITORING_MODULE: ConfigModuleDefinition = {
  id: 'monitoring',
  name: 'Monitoring',
  description: 'Error tracking, uptime thresholds, and alert routing.',
  category: 'infrastructure',
  group: 'Monitoring',
  version: '1.0.0',
  icon: 'Activity',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'monitoring.thresholds',
      title: 'Thresholds',
      fields: [
        defineField({
          id: 'monitoring.sentry_enabled',
          title: 'Error Tracking Enabled',
          category: 'infrastructure',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'monitoring.error_rate_alert_threshold_percent',
          title: 'Error Rate Alert Threshold (%)',
          category: 'infrastructure',
          type: 'number',
          default: 2,
          validation: { min: 0.1, max: 50 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'monitoring.api_latency_alert_ms',
          title: 'API Latency Alert Threshold (ms)',
          category: 'infrastructure',
          type: 'number',
          default: 1500,
          validation: { min: 100, max: 10000 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'monitoring.alert_channels',
          title: 'Alert Channels',
          category: 'infrastructure',
          type: 'multi-select',
          default: ['email'],
          options: [
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'SMS' },
            { value: 'slack', label: 'Slack' },
            { value: 'pagerduty', label: 'PagerDuty' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(MONITORING_MODULE)
