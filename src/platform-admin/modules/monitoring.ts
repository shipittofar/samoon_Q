/**
 * Platform Administration — Monitoring group — P9.4 Phase C
 *
 * `monitoring` (P9.0) already lives in this IA group via its own
 * `group: 'Monitoring'` tag. This file adds Metrics, Health, Incidents,
 * Errors, Activity Logs, and a platform-wide Audit Logs module.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.metrics',
  name: 'Metrics',
  description: 'Platform-wide metrics collection and retention.',
  group: 'Monitoring',
  icon: 'BarChart3',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'metrics_retention_days', title: 'Metrics Retention (days)', category: 'monitoring', type: 'number', default: 90, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 7 } }),
    defineField({ id: 'sample_rate_percent', title: 'Sampling Rate (%)', category: 'monitoring', type: 'number', default: 100, permissions: PERMISSIONS, uiControl: 'slider', validation: { min: 1, max: 100 } }),
  ],
})

registerAdminModule({
  id: 'platform.health',
  name: 'Health',
  description: 'Service health-check configuration and thresholds.',
  group: 'Monitoring',
  icon: 'HeartPulse',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'healthcheck_interval_seconds', title: 'Health-Check Interval (seconds)', category: 'monitoring', type: 'number', default: 30, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 5 } }),
    defineField({ id: 'degraded_latency_ms', title: 'Degraded Latency Threshold (ms)', category: 'monitoring', type: 'number', default: 500, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 50 } }),
  ],
})

registerAdminModule({
  id: 'platform.incidents',
  name: 'Incidents',
  description: 'Incident severity levels and escalation policy.',
  group: 'Monitoring',
  icon: 'Siren',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'auto_page_on_sev1', title: 'Auto-Page On-Call for SEV-1', category: 'monitoring', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'public_status_page_enabled', title: 'Public Status Page Enabled', category: 'monitoring', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.errors',
  name: 'Errors',
  description: 'Error tracking sample rate and alert thresholds.',
  group: 'Monitoring',
  icon: 'Bug',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'error_rate_alert_threshold', title: 'Error Rate Alert Threshold (%)', category: 'monitoring', type: 'number', default: 5, permissions: PERMISSIONS, uiControl: 'slider', validation: { min: 0, max: 100 } }),
    defineField({ id: 'group_similar_errors', title: 'Group Similar Errors', category: 'monitoring', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.activity_logs',
  name: 'Activity Logs',
  description: 'Cross-tenant user activity feed retention and visibility.',
  group: 'Monitoring',
  icon: 'ScrollText',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'activity_log_retention_days', title: 'Activity Log Retention (days)', category: 'monitoring', type: 'number', default: 180, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 30 } }),
  ],
})

registerAdminModule({
  id: 'platform.analytics',
  name: 'Analytics',
  description: 'Cross-tenant analytics aggregation configuration (distinct from each tenant’s own P7.13 analytics).',
  group: 'Monitoring',
  icon: 'TrendingUp',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'aggregation_window', title: 'Default Aggregation Window', category: 'monitoring', type: 'select', default: 'daily', options: [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'include_churned_tenants', title: 'Include Churned Tenants in Aggregates', category: 'monitoring', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.audit_logs',
  name: 'Platform Audit Logs',
  description: 'Platform-wide (cross-tenant) administrative audit trail — distinct from each Configuration field’s own per-field audit history (P9.1.3) and from tenant-scoped audit logs.',
  group: 'Monitoring',
  icon: 'History',
  platformPermission: 'platform.monitoring.view',
  fields: [
    defineField({ id: 'audit_log_retention_days', title: 'Audit Log Retention (days)', category: 'monitoring', type: 'number', default: 365, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 90 } }),
    defineField({ id: 'require_reason_for_destructive_actions', title: 'Require Reason for Destructive Actions', category: 'monitoring', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
