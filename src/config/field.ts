/**
 * defineField — P9.0 / Phase D
 *
 * Terse constructor for ConfigFieldDefinition so module files declare fields
 * as data, not boilerplate. Fills in the Rule 5 metadata every field must
 * carry (visibility/permissions/preview/inheritance/audit/version) with safe
 * platform-admin defaults that module authors override only when a field
 * genuinely differs.
 */
import type { ConfigFieldDefinition, ConfigFieldInheritance, ConfigFieldAudit, ConfigFieldPreview } from './types'

const DEFAULT_INHERITANCE: ConfigFieldInheritance = {
  level: 'platform',
  canOverride: false,
  mode: 'locked',
  fallback: 'inherit',
}

const DEFAULT_AUDIT: ConfigFieldAudit = {
  trackHistory: true,
  requireReason: false,
  sensitive: false,
}

const DEFAULT_PREVIEW: ConfigFieldPreview = { kind: 'none' }

export function defineField<T>(
  input: Partial<Omit<ConfigFieldDefinition<T>, 'inheritance' | 'audit' | 'preview'>> & {
    id: string
    title: string
    category: string
    type: ConfigFieldDefinition<T>['type']
    default: T
    permissions: ConfigFieldDefinition<T>['permissions']
    inheritance?: Partial<ConfigFieldInheritance>
    audit?: Partial<ConfigFieldAudit>
    preview?: Partial<ConfigFieldPreview>
  },
): ConfigFieldDefinition<T> {
  return {
    visibility: 'admin_only',
    version: '1.0.0',
    ...input,
    inheritance: { ...DEFAULT_INHERITANCE, ...input.inheritance },
    audit: { ...DEFAULT_AUDIT, ...input.audit },
    preview: { ...DEFAULT_PREVIEW, ...input.preview },
  } as ConfigFieldDefinition<T>
}
