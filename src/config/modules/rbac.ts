/**
 * RBAC Module — P9.0 / Phase C+G
 * Platform-level RBAC policy — distinct from the per-tenant role assignments
 * already modeled in src/types/rbac.ts and src/services/rbac.service.ts.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'staff.view', edit: 'staff.manage' }

export const RBAC_MODULE: ConfigModuleDefinition = {
  id: 'rbac',
  name: 'RBAC',
  description: 'Custom role limits and default role assigned to newly invited staff.',
  category: 'security',
  version: '1.0.0',
  icon: 'Shield',
  permissions: PERMISSIONS,
  featureFlag: 'feature_flags.rbac_custom_roles',
  sections: [
    {
      id: 'rbac.roles',
      title: 'Roles',
      fields: [
        defineField({
          id: 'rbac.max_custom_roles_per_tenant',
          title: 'Max Custom Roles Per Tenant',
          category: 'security',
          type: 'number',
          default: 10,
          validation: { min: 0, max: 100 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'rbac.default_invite_role',
          title: 'Default Invite Role',
          category: 'security',
          type: 'select',
          default: 'staff',
          options: [
            { value: 'staff', label: 'Staff' },
            { value: 'manager', label: 'Manager' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'rbac.require_mfa_for_admin',
          title: 'Require MFA for Admin Role',
          category: 'security',
          type: 'boolean',
          default: false,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(RBAC_MODULE)
