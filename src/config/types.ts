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

// ── Secret references (P9.0.1 / Phase C) ─────────────────────────────────────

/**
 * Rule: Platform Configuration must NEVER store secrets. Fields of type
 * 'secret' (and, in production, 'password') resolve to a SecretReference —
 * a pointer into a future Secret Provider (vault) — never the plaintext.
 *
 * This type exists so a future Secret Provider integration has a stable
 * contract to target; no provider is implemented in P9.0/P9.0.1 (see
 * docs/P9.0.1_ARCHITECTURE_HARDENING.md §C). Until that lands, mock/dev
 * module defaults for 'secret' fields are inline placeholder strings for
 * local development convenience only and MUST NOT be treated as a pattern
 * to copy for real credentials.
 */
export interface SecretReference {
  /** Opaque id the Secret Provider resolves at runtime; never the value itself. */
  ref: string
  /** Which provider owns this secret, e.g. 'vault' | 'aws-secrets-manager' | 'env'. */
  provider: string
  /** ISO timestamp of the last rotation, for rotation-policy reporting. */
  rotatedAt?: string
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

// ── Lifecycle (P9.0.1 / Phase D) ─────────────────────────────────────────────

/**
 * Every field and module carries a lifecycle state, independent of its
 * inheritance level or audit settings. A future Console reads this to decide
 * whether a field/module is safe to surface, editable, or read-only:
 *
 *   draft      → visible only to the authoring team; never resolved for real tenants
 *   testing    → resolvable behind a feature flag / for internal tenants only
 *   published  → the default; fully live
 *   deprecated → still resolves (existing overrides keep working) but is
 *                hidden from "add new configuration" UI and flagged in the Console
 *   archived   → no longer resolves; reads fall back to `default` only
 *
 * See docs/P9.0.1_ARCHITECTURE_HARDENING.md §D for the full state machine.
 */
export type ConfigLifecycleState = 'draft' | 'testing' | 'published' | 'deprecated' | 'archived'

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
  /** Defaults to 'published' via defineField() — see ConfigLifecycleState. */
  lifecycle: ConfigLifecycleState
  /** @deprecated Use lifecycle: 'deprecated' instead. Kept only for source compatibility. */
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
  /**
   * 'hard' (default when omitted) — the dependent module cannot function
   * without the dependency; the registry refuses to register the dependent
   * before the dependency exists (see registry.ts `register()`).
   * 'soft' — the dependent merely reads the dependency's resolved values
   * when present (e.g. for preview rendering) but registers fine without it.
   * P9.0.1 / Phase G — see docs/P9.0.1_ARCHITECTURE_HARDENING.md §G.
   */
  type?: 'hard' | 'soft'
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
  /** Omitted means 'published' — use registry.getModuleLifecycle(id) rather than reading this directly. */
  lifecycle?: ConfigLifecycleState
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
