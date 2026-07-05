/**
 * Platform Administration — Security group — P9.4 Phase C
 *
 * `authentication` and `rbac` (P9.0) already live in this IA group via
 * their own `group: 'Security'` tag. This file adds the remaining
 * requested Security-group modules the audit found missing.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.roles',
  name: 'Roles',
  description: 'Platform-level roles (distinct from tenant RBAC) and what each grants.',
  group: 'Security',
  icon: 'ShieldCheck',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'allow_custom_roles', title: 'Allow Custom Platform Roles', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'require_approval_for_owner_grant', title: 'Require Approval to Grant Owner Role', category: 'security', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.permissions',
  name: 'Permissions',
  description: 'The permission keys available to platform roles.',
  group: 'Security',
  icon: 'KeyRound',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'strict_wildcard_grants', title: 'Restrict Wildcard (*) Grants to Owner', category: 'security', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.security_center',
  name: 'Security Center',
  description: 'Platform-wide security posture: login anomalies, suspicious activity, and lockdown controls.',
  group: 'Security',
  icon: 'ShieldAlert',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'anomaly_detection_enabled', title: 'Login Anomaly Detection', category: 'security', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'auto_lock_on_anomaly', title: 'Auto-Lock Account on Anomaly', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'platform_lockdown_mode', title: 'Platform Lockdown Mode', description: 'Emergency switch — blocks all non-owner platform access.', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch', governance: { dangerous: true, requiresApproval: true } }),
  ],
})

registerAdminModule({
  id: 'platform.compliance',
  name: 'Compliance',
  description: 'SOC 2 / PCI / regulatory compliance posture tracking.',
  group: 'Security',
  icon: 'FileCheck',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'soc2_compliant', title: 'SOC 2 Type II Compliant', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'pci_dss_level', title: 'PCI DSS Level', category: 'security', type: 'select', default: 'not_applicable', options: [
      { value: 'not_applicable', label: 'Not Applicable' },
      { value: 'level_1', label: 'Level 1' },
      { value: 'level_2', label: 'Level 2' },
      { value: 'level_3', label: 'Level 3' },
      { value: 'level_4', label: 'Level 4' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
  ],
})

registerAdminModule({
  id: 'platform.gdpr',
  name: 'GDPR',
  description: 'Data subject request handling and retention policy.',
  group: 'Security',
  icon: 'Scale',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'data_retention_days', title: 'Default Data Retention (days)', category: 'security', type: 'number', default: 730, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 30 } }),
    defineField({ id: 'auto_fulfill_export_requests', title: 'Auto-Fulfill Data Export Requests', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'right_to_be_forgotten_enabled', title: 'Right to Be Forgotten Enabled', category: 'security', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.fraud',
  name: 'Fraud',
  description: 'Fraud detection thresholds for signups and payments.',
  group: 'Security',
  icon: 'AlertTriangle',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'fraud_score_threshold', title: 'Auto-Flag Fraud Score Threshold', category: 'security', type: 'number', default: 75, permissions: PERMISSIONS, uiControl: 'slider', validation: { min: 0, max: 100 } }),
    defineField({ id: 'auto_suspend_high_risk', title: 'Auto-Suspend High-Risk Signups', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.abuse',
  name: 'Abuse',
  description: 'Abuse report queue thresholds and auto-moderation.',
  group: 'Security',
  icon: 'Flag',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'auto_moderate_reports', title: 'Auto-Moderate Reported Content', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'reports_before_auto_review', title: 'Reports Before Auto-Review', category: 'security', type: 'number', default: 3, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.rate_limits',
  name: 'Rate Limits',
  description: 'Platform-wide API and auth rate limit defaults.',
  group: 'Security',
  icon: 'Gauge',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'api_requests_per_minute', title: 'API Requests per Minute (per key)', category: 'security', type: 'number', default: 600, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 10 } }),
    defineField({ id: 'login_attempts_per_hour', title: 'Login Attempts per Hour (per IP)', category: 'security', type: 'number', default: 20, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.session_management',
  name: 'Session Management',
  description: 'Platform staff session lifetime and concurrency policy.',
  group: 'Security',
  icon: 'Clock',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'session_timeout_minutes', title: 'Session Timeout (minutes)', category: 'security', type: 'number', default: 60, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 5 } }),
    defineField({ id: 'max_concurrent_sessions', title: 'Max Concurrent Sessions per User', category: 'security', type: 'number', default: 3, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.device_management',
  name: 'Device Management',
  description: 'Trusted-device policy for platform staff logins.',
  group: 'Security',
  icon: 'Smartphone',
  platformPermission: 'platform.security.view',
  fields: [
    defineField({ id: 'require_device_approval', title: 'Require New Device Approval', category: 'security', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'max_trusted_devices', title: 'Max Trusted Devices per User', category: 'security', type: 'number', default: 5, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})
