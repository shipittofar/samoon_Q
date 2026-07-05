/**
 * Platform Administration — Businesses group — P9.4 Phase C
 *
 * `platform.tenants` is a real `'collection'` field (P9.2 framework, reused
 * unchanged) — not a stub — so it concretely demonstrates the Collection
 * Framework serving a second, genuinely different "one schema, many
 * entities" domain beyond Countries: tenants instead of ISO codes. The
 * entity roster mirrors the six seed tenants already defined in
 * `src/services/tenant.service.ts` (not re-implemented here — that service
 * remains the single source of truth for actual tenant business logic;
 * this module only exposes platform-admin-facing status/plan toggles).
 */
import { defineField } from '@/config/field'
import type { ConfigFieldDefinition } from '@/config/types'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const TENANT_IDS = ['savor', 'brew-cafe', 'the-oak-bar', 'central-food-court', 'road-bites', 'wheels-and-brews']

const TENANT_NAMES: Record<string, string> = {
  savor: 'Savor Restaurant',
  'brew-cafe': 'Brew Cafe',
  'the-oak-bar': 'The Oak Bar',
  'central-food-court': 'Central Food Court',
  'road-bites': 'Road Bites',
  'wheels-and-brews': 'Wheels & Brews',
}

const TENANT_BUSINESS_TYPE: Record<string, string> = {
  savor: 'restaurant',
  'brew-cafe': 'cafe',
  'the-oak-bar': 'bar',
  'central-food-court': 'food_court',
  'road-bites': 'food_truck',
  'wheels-and-brews': 'mobile_cafe',
}

const TENANT_SCHEMA: ConfigFieldDefinition[] = [
  defineField({ id: 'status', title: 'Status', category: 'businesses', type: 'select', default: 'active', options: [
    { value: 'active', label: 'Active' },
    { value: 'trial', label: 'Trial' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'churned', label: 'Churned' },
  ], permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'plan', title: 'Plan', category: 'businesses', type: 'select', default: 'starter', options: [
    { value: 'starter', label: 'Starter' },
    { value: 'growth', label: 'Growth' },
    { value: 'enterprise', label: 'Enterprise' },
  ], permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'business_type', title: 'Business Type', category: 'businesses', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text' }),
  defineField({ id: 'verified', title: 'Verified Business', category: 'businesses', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'flagged_for_review', title: 'Flagged for Review', category: 'businesses', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'notes', title: 'Internal Notes', category: 'businesses', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'textarea' }),
]

registerAdminModule({
  id: 'platform.tenants',
  name: 'Tenants',
  description: 'Every business operating on the platform, with status, plan, and internal review flags.',
  group: 'Businesses',
  icon: 'Building2',
  platformPermission: 'platform.businesses.view',
  fields: [
    defineField({
      id: 'platform.tenants.registry',
      title: 'Tenants',
      description: 'Every tenant business on the platform.',
      category: 'businesses',
      type: 'collection',
      default: Object.fromEntries(TENANT_IDS.map((id) => [id, { business_type: TENANT_BUSINESS_TYPE[id] }])),
      permissions: PERMISSIONS,
      inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
      collection: {
        entityLabel: 'Tenant',
        entityIdLabel: 'Slug',
        schema: TENANT_SCHEMA,
        entityIds: TENANT_IDS,
        defaultGroupBy: 'status',
        getEntityLabel: (id) => TENANT_NAMES[id] ?? id,
      },
    }),
  ],
})

registerAdminModule({
  id: 'platform.business_owners',
  name: 'Business Owners',
  description: 'The primary owner account for each tenant business.',
  group: 'Businesses',
  icon: 'UserCircle',
  platformPermission: 'platform.businesses.view',
  fields: [
    defineField({ id: 'require_verified_email', title: 'Require Verified Email', category: 'businesses', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'require_verified_phone', title: 'Require Verified Phone', category: 'businesses', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'max_owned_businesses', title: 'Max Businesses per Owner', category: 'businesses', type: 'number', default: 5, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1, max: 100 } }),
  ],
})

registerAdminModule({
  id: 'platform.branches',
  name: 'Branches',
  description: 'Platform-wide view of every branch/location across all tenants.',
  group: 'Businesses',
  icon: 'MapPinned',
  platformPermission: 'platform.businesses.view',
  fields: [
    defineField({ id: 'max_branches_per_tenant', title: 'Max Branches per Tenant', category: 'businesses', type: 'number', default: 25, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'require_address_verification', title: 'Require Address Verification', category: 'businesses', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
