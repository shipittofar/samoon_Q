/**
 * Platform Administration Center — P9.4 public entry point
 *
 * Importing this module registers every Platform Administration module
 * (Phase C) as a side effect, mirroring `src/config/index.ts`'s pattern.
 * Consumers (routes, nav, dashboard) should import from here rather than
 * reaching into `src/platform-admin/modules/*` or `./permissions` directly.
 *
 * P9.5.5.1 — `'@/config'` is imported first, explicitly, so the startup
 * order is visible right here: every core config module (countries,
 * languages, authentication, …) registers before any Platform
 * Administration module does. `register-module.ts` already forces this
 * ordering transitively (it imports `platformConfigurationRegistry` from
 * the barrel too), so this line is belt-and-suspenders — it doesn't change
 * behavior, it just makes the dependency graph readable at the one file
 * every route imports to trigger registration. See
 * docs/P9.5.5.1_RUNTIME_RECOVERY.md.
 */
import '@/config'
import './modules'
import './widgets'
import './search-providers'

export { PLATFORM_ROLES, PLATFORM_ROLE_LABEL, PLATFORM_ROLE_PERMISSIONS, hasPlatformPermission } from './permissions'
export type { PlatformRole, PlatformPermission } from './permissions'
export { usePlatformAdminStore } from './store'
export { usePlatformRole, usePlatformPermission } from './hooks'
export { PLATFORM_ADMIN_GROUPS } from './nav-groups'
export type { PlatformAdminGroup } from './nav-groups'
export { platformDashboardRegistry } from './dashboard'
export type { PlatformWidgetDefinition, PlatformWidgetValue, PlatformWidgetKind } from './dashboard'
export { platformSearchRegistry } from './search'
export type { PlatformSearchHit, PlatformSearchProvider } from './search'
