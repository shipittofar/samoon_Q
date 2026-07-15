/**
 * Platform Administration — Platform group — P9.4 Phase C
 *
 * `system` (P9.0) already lives in the System IA group via its own
 * `group: 'System'` tag; `platform.announcements` was registered alongside
 * the other Automation-adjacent outbound-messaging modules in
 * automation.ts but tagged into this group since an announcement banner is
 * a platform-identity concern, not an automation pipeline. This file adds
 * Platform Overview, Maintenance Mode, and System Status.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.overview',
  name: 'Platform Overview',
  description: 'Top-level platform identity and default landing behavior for the Administration Center.',
  group: 'Platform',
  icon: 'LayoutDashboard',
  platformPermission: 'platform.dashboard.view',
  fields: [
    defineField({ id: 'platform_name', title: 'Platform Name', category: 'platform', type: 'string', default: 'Samoon', permissions: PERMISSIONS, uiControl: 'text' }),
    defineField({ id: 'default_landing_widget_set', title: 'Default Dashboard Widget Set', category: 'platform', type: 'select', default: 'standard', options: [
      { value: 'standard', label: 'Standard' },
      { value: 'finance_focused', label: 'Finance-Focused' },
      { value: 'ops_focused', label: 'Operations-Focused' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
  ],
})

registerAdminModule({
  id: 'platform.maintenance_mode',
  name: 'Maintenance Mode',
  description: 'Platform-wide maintenance mode — blocks tenant-facing traffic when enabled.',
  group: 'Platform',
  icon: 'Wrench',
  platformPermission: 'platform.dashboard.manage',
  fields: [
    defineField({ id: 'enabled', title: 'Maintenance Mode Enabled', category: 'platform', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch', governance: { dangerous: true, requiresApproval: true } }),
    defineField({ id: 'message', title: 'Maintenance Message', category: 'platform', type: 'string', default: 'We’ll be back shortly.', permissions: PERMISSIONS, uiControl: 'textarea' }),
    defineField({ id: 'allow_platform_admin_access', title: 'Allow Platform Admin Access During Maintenance', category: 'platform', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.system_status',
  name: 'System Status',
  description: 'Public-facing system status page configuration.',
  group: 'Platform',
  icon: 'Activity',
  platformPermission: 'platform.dashboard.view',
  fields: [
    defineField({ id: 'status_page_enabled', title: 'Public Status Page Enabled', category: 'platform', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'show_incident_history', title: 'Show Incident History', category: 'platform', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
