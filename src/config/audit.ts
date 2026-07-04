/**
 * ConfigurationAudit — P9.0 / Phase E
 *
 * Every configuration change is recorded: who, when, old value, new value,
 * reason (Rule 6). Sensitive fields (audit.sensitive === true) are redacted.
 * In-memory append log for the frontend mock layer — the real backend
 * persists this table (see docs/BACKEND_API_CONTRACT.md Platform Configuration
 * section) and this module's shape mirrors that contract exactly so swapping
 * the storage backend later requires no consumer changes.
 */
import { platformConfigurationRegistry } from './registry'
import type { ConfigAuditEntry, ConfigResolutionScope } from './types'

const REDACTED = '••••••'

let entries: ConfigAuditEntry[] = []
let seq = 0

function redact(fieldId: string, value: unknown): unknown {
  const field = platformConfigurationRegistry.getField(fieldId)
  if (field?.audit.sensitive) return value === undefined || value === null ? value : REDACTED
  return value
}

function record(input: {
  fieldId: string
  scope: ConfigResolutionScope
  level: ConfigAuditEntry['level']
  actorId: string
  actorName: string
  reason?: string
  previousValue: unknown
  newValue: unknown
}): ConfigAuditEntry {
  const entry: ConfigAuditEntry = {
    id: `cfg-audit-${++seq}`,
    fieldId: input.fieldId,
    scope: input.scope,
    level: input.level,
    actorId: input.actorId,
    actorName: input.actorName,
    reason: input.reason,
    previousValue: redact(input.fieldId, input.previousValue),
    newValue: redact(input.fieldId, input.newValue),
    timestamp: new Date().toISOString(),
  }
  entries = [entry, ...entries]
  return entry
}

function listForField(fieldId: string): ConfigAuditEntry[] {
  return entries.filter((e) => e.fieldId === fieldId)
}

function listForScope(scope: ConfigResolutionScope): ConfigAuditEntry[] {
  return entries.filter(
    (e) =>
      (scope.tenantId === undefined || e.scope.tenantId === scope.tenantId) &&
      (scope.branchId === undefined || e.scope.branchId === scope.branchId) &&
      (scope.userId === undefined || e.scope.userId === scope.userId),
  )
}

function all(): ConfigAuditEntry[] {
  return entries
}

/** Rule 6 — rollback support: returns the previousValue of the given audit entry. */
function getRollbackValue(auditEntryId: string): unknown {
  const entry = entries.find((e) => e.id === auditEntryId)
  return entry?.previousValue
}

function __resetForTests(): void {
  entries = []
  seq = 0
}

export const configurationAudit = {
  record,
  listForField,
  listForScope,
  all,
  getRollbackValue,
  __resetForTests,
}
