/**
 * Platform Administration — Information Architecture — P9.4 Phase B,
 * extended P9.5.5 Phase K.
 *
 * The top-level nav groups every Platform Administration module is
 * registered under via `ConfigModuleDefinition.group` (src/config/types.ts).
 * Pre-existing P9.0–P9.3 modules don't set `group` and keep grouping by
 * `category` exactly as before — this is purely an additive top layer for
 * the new, larger module set P9.4 registers.
 *
 * P9.5.5 adds `'Localization'`, matching the dedicated IA group
 * `docs/P9.5.0_LOCALIZATION_ARCHITECTURE.md` §1 designed for the Language
 * Management Center — distinct from `'Configuration'` (which already
 * houses the simple `languages`/`countries`/`typography` config modules)
 * because the new `platform.languages` module is Platform-Admin-only
 * (Phase K: "Platform Admin only. No tenant. No owner. No branch."),
 * unlike Configuration-group modules which tenants can also reach.
 */
export const PLATFORM_ADMIN_GROUPS = [
  'Platform',
  'Users',
  'Businesses',
  'Subscriptions',
  'Configuration',
  'Localization',
  'Security',
  'Monitoring',
  'Infrastructure',
  'Automation',
  'Developer',
  'Support',
  'System',
] as const

export type PlatformAdminGroup = typeof PLATFORM_ADMIN_GROUPS[number]
