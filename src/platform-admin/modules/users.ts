/**
 * Platform Administration — Users group — P9.4 Phase C
 *
 * `platform.users.registry` is a real `'collection'` field — a third
 * concrete demonstration (after Countries and Tenants) that the P9.2
 * Collection Framework is genuinely domain-agnostic. Entities here are
 * *platform staff* (Savor employees with a `PlatformRole`, src/platform-
 * admin/permissions.ts), never tenant end-users or tenant staff — those
 * remain exactly where they already are (tenant-scoped, P6/P7/P8).
 */
import { defineField } from '@/config/field'
import type { ConfigFieldDefinition } from '@/config/types'
import { registerAdminModule } from '../register-module'
import { PLATFORM_ROLES, PLATFORM_ROLE_LABEL } from '../permissions'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const PLATFORM_USER_IDS = ['owner-1', 'admin-1', 'support-1', 'ops-1', 'finance-1']

const PLATFORM_USER_NAMES: Record<string, string> = {
  'owner-1': 'Pat Owner',
  'admin-1': 'Ari Admin',
  'support-1': 'Sam Support',
  'ops-1': 'Ollie Ops',
  'finance-1': 'Frankie Finance',
}

const PLATFORM_USER_ROLE: Record<string, string> = {
  'owner-1': 'platform_owner',
  'admin-1': 'platform_admin',
  'support-1': 'platform_support',
  'ops-1': 'platform_operations',
  'finance-1': 'platform_finance',
}

const PLATFORM_USER_SCHEMA: ConfigFieldDefinition[] = [
  defineField({ id: 'role', title: 'Platform Role', category: 'users', type: 'select', default: 'platform_read_only', options: PLATFORM_ROLES.map((r) => ({ value: r, label: PLATFORM_ROLE_LABEL[r] })), permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'active', title: 'Active', category: 'users', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'mfa_enabled', title: 'MFA Enabled', category: 'users', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'last_login_note', title: 'Notes', category: 'users', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'textarea' }),
]

registerAdminModule({
  id: 'platform.users',
  name: 'Platform Users',
  description: 'Savor employees with access to the Platform Administration Center — distinct from any tenant’s own staff.',
  group: 'Users',
  icon: 'Users',
  platformPermission: 'platform.users.view',
  fields: [
    defineField({
      id: 'platform.users.registry',
      title: 'Platform Users',
      description: 'Every internal platform user and their platform role.',
      category: 'users',
      type: 'collection',
      default: Object.fromEntries(PLATFORM_USER_IDS.map((id) => [id, { role: PLATFORM_USER_ROLE[id] }])),
      permissions: PERMISSIONS,
      inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
      collection: {
        entityLabel: 'Platform User',
        entityIdLabel: 'User ID',
        schema: PLATFORM_USER_SCHEMA,
        entityIds: PLATFORM_USER_IDS,
        defaultGroupBy: 'role',
        getEntityLabel: (id) => PLATFORM_USER_NAMES[id] ?? id,
      },
    }),
  ],
})
