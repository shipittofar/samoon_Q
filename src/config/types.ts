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
  /** Increment step for numeric/slider controls — display hint only; not enforced by ConfigurationValidator. */
  step?: number
  minLength?: number
  maxLength?: number
  /** Regex source (no flags) evaluated against string values. */
  pattern?: string
  enumValues?: Array<string | number>
  /** Deny-list — a value matching any of these fails validation even if otherwise valid. */
  disallowedValues?: Array<string | number>
  /** Name of a validator registered with ConfigurationValidator.registerRule(). */
  custom?: string
  /** Soft warning shown alongside a value that is valid but discouraged (e.g. an unusually low timeout). Display-only — never blocks a write. */
  warningMessage?: string
  /** Overrides ConfigurationValidator's generated message for this field, when a friendlier one is warranted. */
  errorMessage?: string
  /** Whether the Console should run this field's validation before submit (P9.1.2.1 — metadata only, no client validator implemented here). Defaults true when omitted. */
  clientValidation?: boolean
  /** Whether the backend must re-validate on write, even if the client already did (defense in depth). Defaults true when omitted. */
  serverValidation?: boolean
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

// ── Console Readiness metadata (P9.1.2.1) ────────────────────────────────────
//
// Everything in this block is OPTIONAL and purely descriptive — no resolver,
// validator, cache, audit, or service logic reads any of it as of P9.1.2.1.
// It exists so a future Console can generate forms, search, and dependency
// wiring directly from the registry instead of hand-built per-field UI (Rule
// 7). Adding these fields to ConfigFieldDefinition is non-breaking: every
// existing field registration across all 15 modules remains valid untouched.
// See docs/P9.1.2.1_CONFIGURATION_METADATA.md for the full rendering model.

/**
 * Rendering hint for the future Console — which control a field should be
 * drawn with. Distinct from `type` (the value's data shape): a `'string'`
 * field might render as `'text'`, `'textarea'`, or `'secret_input'` depending
 * on this hint, and a `'number'` field might render as `'number'` or
 * `'slider'`. When omitted, the Console falls back to a sensible default
 * purely from `type` (see the mapping table in
 * docs/P9.1.2.1_CONFIGURATION_METADATA.md).
 */
export type ConfigUIControlType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'switch'
  | 'checkbox'
  | 'radio'
  | 'country_selector'
  | 'language_selector'
  | 'color_picker'
  | 'font_selector'
  | 'json_editor'
  | 'secret_input'
  | 'otp_provider_picker'
  | 'timezone_picker'
  | 'currency_picker'
  | 'file_upload'
  | 'table_editor'

/** Phase B — organizational/display metadata beyond the always-required title/description/helpText/placeholder/category. */
export interface ConfigFieldDisplayMeta {
  /** Short label for compact UI (chips, search results) when `title` is too long. Falls back to `title` when absent. */
  displayName?: string
  /** A finer grouping within `category`, e.g. category 'security' + subcategory 'otp'. */
  subcategory?: string
  /** Icon name (lucide-react convention, matching ADMIN_NAV_ICON_MAP's pattern in AdminSidebar). */
  icon?: string
  /** Sort position within its section. Lower renders first. Fields without one sort after those with one, in registration order. */
  displayOrder?: number
  /** Visual grouping tag distinct from `category`/`subcategory` — e.g. grouping fields from different sections under one Console tab. */
  group?: string
  /** Short label rendered as a chip next to the field, e.g. "New", "Recommended". Distinct from lifecycle state badges, which the Console derives automatically. */
  badge?: string
  tags?: string[]
  /** Link to prose documentation for this specific field (module-level docs live in ConfigModuleDefinition's own description). */
  documentationLink?: string
  /** Name of a Console-side custom preview component, for fields whose preview needs more than `ConfigFieldPreview.kind` supports. */
  previewComponent?: string
  /** A realistic example value shown as inline guidance, distinct from `default` (the value actually used) and `placeholder` (shown in an empty input). */
  exampleValue?: unknown
  /** Prose explaining *why* the default is what it is — for fields whose default isn't self-evident (e.g. "300s balances SMS delivery latency against brute-force exposure"). */
  defaultExplanation?: string
}

/** Phase D — permission/risk metadata beyond the always-required `permissions: { view, edit }`. */
export interface ConfigFieldGovernanceMeta {
  /** Specific roles/permission keys allowed to edit, narrower than `permissions.edit` alone — e.g. edit requires 'settings.manage' AND being in this list. Empty/omitted means `permissions.edit` alone governs. */
  editableBy?: string[]
  /** Specific roles/permission keys allowed to view, narrower than `permissions.view` alone. */
  visibleTo?: string[]
  /** How much detail the audit trail captures for this field, beyond the boolean `audit.trackHistory`. */
  auditLevel?: 'none' | 'basic' | 'detailed' | 'forensic'
  /** Coarse risk classification the Console uses for visual treatment (e.g. a red border on 'critical' fields) — distinct from `audit.sensitive` (which governs redaction specifically). */
  securityLevel?: 'low' | 'medium' | 'high' | 'critical'
  /** Whether a change to this field must go through an approval workflow before taking effect (workflow itself is not implemented here — metadata only). */
  requiresApproval?: boolean
  /** Whether a change requires an application/process restart to take effect (vs. being live-read on next resolution). */
  requiresRestart?: boolean
  /** Whether a change requires an explicit "publish" step (draft → live) rather than taking effect immediately on write. */
  requiresPublish?: boolean
  /** Whether the runtime picks up a change without restart or publish — the common case; explicit here so the Console can warn when it's false. */
  runtimeReloadable?: boolean
  /** Whether the Console should show an extra confirmation step before allowing a write (e.g. system.maintenance_mode). */
  dangerous?: boolean
  experimental?: boolean
  beta?: boolean
  /** Never shown to tenant-level administrators, regardless of `visibility` — reserved for platform engineering only. */
  internalOnly?: boolean
}

/** A single condition referencing another field's resolved value — the building block for `enabledWhen`/`hiddenWhen`. */
export interface ConfigFieldCondition {
  fieldId: string
  equals?: unknown
  notEquals?: unknown
  in?: unknown[]
}

/** Phase F — dependency metadata so a future Console can show/hide/disable fields automatically without per-field UI logic. */
export interface ConfigFieldDependencyMeta {
  /** Field ids this field's value or availability depends on, for display/documentation purposes. */
  dependsOn?: string[]
  /** The Console renders this field's control as enabled only when this condition holds; disabled (but still visible) otherwise. */
  enabledWhen?: ConfigFieldCondition
  /** The Console hides this field entirely when this condition holds. */
  hiddenWhen?: ConfigFieldCondition
  /** Field ids that cannot simultaneously hold a truthy/non-default value alongside this one — Console shows a warning, does not block (validation-time enforcement is a future ConfigurationValidator custom rule, not implied by this metadata alone). */
  conflictsWith?: string[]
  /** Field ids that must already have a non-default value for this field to make sense (weaker than `dependsOn` — informational). */
  requires?: string[]
  /** Field ids forming a radio-group-like set where only one may be truthy/active at a time. */
  mutuallyExclusive?: string[]
}

/** Phase G — search metadata to power a future global configuration search. Not consumed by any search implementation in P9.1.2.1. */
export interface ConfigFieldSearchMeta {
  keywords?: string[]
  aliases?: string[]
  /** Relative ranking boost for search results; higher sorts first. Unset fields rank neutrally. */
  searchWeight?: number
  /** Platform-wide "commonly favorited" flag — distinct from any individual admin's personal favorites (a future per-user preference, not modeled here). */
  favorite?: boolean
  /** Whether to surface this field in a "recently changed" quick-access list — derived data in a real implementation; a static hint here for design purposes only. */
  recent?: boolean
  /** Platform-wide "commonly adjusted" flag, analogous to `favorite` but computed from usage rather than curated. */
  popular?: boolean
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
  /** Defaults to 'published' via defineField() — see ConfigLifecycleState. */
  lifecycle: ConfigLifecycleState
  /** @deprecated Use lifecycle: 'deprecated' instead. Kept only for source compatibility. */
  deprecated?: boolean
  /** When set, the field itself only applies while this platform feature flag is on. */
  featureFlag?: string

  // ── Console Readiness (P9.1.2.1) — all optional, all descriptive only ──────
  /** Rendering hint (Phase C). Omit to let the Console infer a default control from `type`. */
  uiControl?: ConfigUIControlType
  /** Organizational/display metadata (Phase B). */
  display?: ConfigFieldDisplayMeta
  /** Permission/risk metadata beyond `permissions` (Phase D). */
  governance?: ConfigFieldGovernanceMeta
  /** Show/hide/conflict wiring for a future Console (Phase F). */
  dependency?: ConfigFieldDependencyMeta
  /** Global configuration search metadata (Phase G). */
  search?: ConfigFieldSearchMeta
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
