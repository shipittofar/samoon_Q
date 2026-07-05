/**
 * Platform Administration — Information Architecture — P9.4 Phase B
 *
 * The 12 top-level nav groups every Platform Administration module is
 * registered under via `ConfigModuleDefinition.group` (src/config/types.ts).
 * Pre-existing P9.0–P9.3 modules don't set `group` and keep grouping by
 * `category` exactly as before — this is purely an additive top layer for
 * the new, larger module set P9.4 registers.
 */
export const PLATFORM_ADMIN_GROUPS = [
  'Platform',
  'Users',
  'Businesses',
  'Subscriptions',
  'Configuration',
  'Security',
  'Monitoring',
  'Infrastructure',
  'Automation',
  'Developer',
  'Support',
  'System',
] as const

export type PlatformAdminGroup = typeof PLATFORM_ADMIN_GROUPS[number]
