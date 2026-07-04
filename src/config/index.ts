/**
 * Platform Configuration System — P9.0 Public Entry Point
 *
 * Importing this module triggers every module registration as a side effect
 * (Rule 2 — Registry First: nothing may register outside module-body import
 * time). Order matters only where a module declares a `dependencies` entry —
 * see each module file's `dependencies` array. The list below keeps
 * dependency owners imported before dependents for readability, but the
 * registry itself enforces the invariant and throws a clear error if it is
 * ever violated.
 *
 * Everything a consumer needs — the registry, the service facade, and the
 * schema types — is re-exported from here. Consumers should never import
 * from src/config/registry.ts or src/config/modules/* directly.
 */
import './modules/countries'
import './modules/languages'
import './modules/typography'
import './modules/themes'
import './modules/authentication'
import './modules/feature-flags'
import './modules/subscriptions'
import './modules/payments'
import './modules/storage'
import './modules/monitoring'
import './modules/notifications'
import './modules/website-builder'
import './modules/rbac'
import './modules/system'
import './modules/api'

export { platformConfigurationRegistry } from './registry'
export { configurationService } from './service'
export type { ConfigActor } from './service'
export { configurationResolver } from './resolver'
export { configurationValidator } from './validator'
export { configurationCache } from './cache'
export { configurationAudit } from './audit'
export { configurationVersionManager } from './version-manager'
export * from './types'
