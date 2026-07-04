/**
 * Platform Configuration — Schema System (P9.0 / Phase D)
 *
 * Every configuration value surfaced anywhere in Savor (Platform Administrator
 * settings, tenant settings, branch overrides, user preferences) is described by
 * one ConfigFieldDefinition, grouped under a ConfigSectionDefinition, grouped
 * under a ConfigModuleDefinition. Nothing is read or written outside this model.
 *
 * Resolution order:  Platform → Tenant → Branch → User  (see resolver.ts)
 * Registration order: Registry → Schema → Validation → Service → API Contract → UI (Rule 2)
 */

// ── Field type system (Phase D) ──────────────────────────────────────────────

export type ConfigFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'color'
  | 'font'
  | 'json'
  | 'array'
  | 'object'
  | 'password'
  | 'secret'
  | 'country'
  | 'language'
  | 'feature_flag'
  | 'permission'

export interface ConfigFieldOption {
  value: string | number | boolean
  label: string
  description?: string
}

export interface ConfigFieldValidation {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  /** Regex source (no flags) evaluated against string values. */
  pattern?: string
  enumValues?: Array<string | number>
  /** Name of a validator registered with ConfigurationValidator.registerRule(). */
  custom?: string
}

// ── Configuration Inheritance (Rule 4) ───────────────────────────────────────

export type ConfigInheritanceLevel = 'platform' | 'tenant' | 'branch' | 'user'

export const CONFIG_INHERITANCE_CHAIN: readonly ConfigInheritanceLevel[] = [
  'platform',
  'tenant',
  'branch',
  'user',
]

export type ConfigInheritanceMode =
  /** Nearest defined level fully replaces every ancestor. */
  | 'override'
  /** Nearest defined level is shallow-merged onto the resolved ancestor value (objects/arrays only). */
  | 'merge'
  /** Descendant levels may never override; the platform value always wins. */
  | 'locked'

export interface ConfigFieldInheritance {
  /** The level that owns this field's authoritative default. */
  level: ConfigInheritanceLevel
  /** Whether levels below `level` may override the value at all. */
  canOverride: boolean
  mode: ConfigInheritanceMode
  /** What an unset descendant level resolves to. */
  fallback: 'inherit' | 'default'
}

// ── Audit metadata (Rule 6) ──────────────────────────────────────────────────

export interface ConfigFieldAudit {
  trackHistory: boolean
  requireReason: boolean
  /** Secrets/passwords — value is redacted ("••••••") in audit log entries. */
  sensitive: boolean
}

// ── Field definition (Rule 5 — every field has metadata) ─────────────────────

export type ConfigFieldVisibility = 'public' | 'internal' | 'admin_only'

export interface ConfigFieldPreview {
  kind: 'none' | 'swatch' | 'font-sample' | 'json' | 'image'
}

export interface ConfigFieldPermissions {
  view: string
  edit: string
}

export interface ConfigFieldDefinition<T = unknown> {
  /** Dotted, globally unique id, e.g. "authentication.otp.length". */
  id: string
  title: string
  description?: string
  helpText?: string
  placeholder?: string
  category: string
  type: ConfigFieldType
  default: T
  options?: ConfigFieldOption[]
  validation?: ConfigFieldValidation
  visibility: ConfigFieldVisibility
  permissions: ConfigFieldPermissions
  preview: ConfigFieldPreview
  inheritance: ConfigFieldInheritance
  audit: ConfigFieldAudit
  version: string
  deprecated?: boolean
  /** When set, the field itself only applies while this platform feature flag is on. */
  featureFlag?: string
}

export interface ConfigSectionDefinition {
  id: string
  title: string
  description?: string
  fields: ConfigFieldDefinition[]
}

export interface ConfigModuleDependency {
  moduleId: string
  reason?: string
}

/**
 * A registered platform module (Phase C).
 * id/name/description/permissions/schema/defaults/version/validation/
 * dependencies/featureFlag/category are all present per Rule 3/Rule 5 —
 * nothing here is duplicated by consumers; they read it from the registry.
 */
export interface ConfigModuleDefinition {
  id: string
  name: string
  description: string
  category: string
  version: string
  icon?: string
  permissions: ConfigFieldPermissions
  featureFlag?: string
  dependencies?: ConfigModuleDependency[]
  sections: ConfigSectionDefinition[]
}

// ── Resolution / values ───────────────────────────────────────────────────────

export interface ConfigValueLayer {
  platform?: unknown
  tenant?: unknown
  branch?: unknown
  user?: unknown
}

export interface ResolvedConfigValue<T = unknown> {
  fieldId: string
  value: T
  /** The level whose value actually won after applying inheritance rules. */
  resolvedFrom: ConfigInheritanceLevel
  /** True when a descendant tried to override a locked field and was ignored. */
  overrideBlocked: boolean
}

export interface ConfigResolutionScope {
  tenantId?: string
  branchId?: string
  userId?: string
}

// ── Validation results ────────────────────────────────────────────────────────

export interface ConfigValidationError {
  fieldId: string
  message: string
}

export interface ConfigValidationResult {
  valid: boolean
  errors: ConfigValidationError[]
}

// ── Audit log entries ─────────────────────────────────────────────────────────

export interface ConfigAuditEntry {
  id: string
  fieldId: string
  scope: ConfigResolutionScope
  level: ConfigInheritanceLevel
  actorId: string
  actorName: string
  reason?: string
  previousValue: unknown
  newValue: unknown
  timestamp: string
}

// ── Version history ───────────────────────────────────────────────────────────

export interface ConfigVersionEntry {
  moduleId: string
  version: string
  changedAt: string
  changeNote: string
}
