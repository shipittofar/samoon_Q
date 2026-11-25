/**
 * Reservation rules (backend reservations/services/rules.py): slot spacing,
 * length and limits. A branch's own value wins, then the platform's value for
 * its business type, then the platform default. Empty = inherited.
 */
import api from './axios.instance'

export const RULE_FIELDS = [
  'slot_minutes',
  'duration_minutes',
  'last_before_close_minutes',
  'lead_minutes',
  'max_days_ahead',
  'max_concurrent',
] as const
export type RuleField = (typeof RULE_FIELDS)[number]
export type RuleValues = Partial<Record<RuleField, number | null>>
export type RuleLimits = Record<RuleField, [number, number]>

export interface BranchRules {
  own: RuleValues
  inherited: RuleValues
  effective: RuleValues
  limits: RuleLimits
  max_capacity: number | null
}

export interface PlatformRules {
  default: RuleValues
  by_type: Record<string, RuleValues>
  inherited: { default: RuleValues; by_type: Record<string, RuleValues> }
  limits: RuleLimits
}

const branchUrl = (tenantId: string, branchId: string) =>
  `/reservations/console-reservations/tenants/${tenantId}/branches/${branchId}/rules/`

export const reservationRulesService = {
  async branch(tenantId: string, branchId: string): Promise<BranchRules> {
    const { data } = await api.get<BranchRules>(branchUrl(tenantId, branchId))
    return data
  },
  async saveBranch(tenantId: string, branchId: string, own: RuleValues): Promise<BranchRules> {
    const { data } = await api.put<BranchRules>(branchUrl(tenantId, branchId), own)
    return data
  },
  async platform(): Promise<PlatformRules> {
    const { data } = await api.get<PlatformRules>('/reservations/platform-rules/')
    return data
  },
  async savePlatform(body: Pick<PlatformRules, 'default' | 'by_type'>): Promise<PlatformRules> {
    const { data } = await api.put<PlatformRules>('/reservations/platform-rules/', body)
    return data
  },
}

/** Why a typed value cannot be saved, or null. Empty is fine (inherited). */
export function ruleOutOfRange(field: RuleField, value: number | null | undefined, limits: RuleLimits): boolean {
  if (value === null || value === undefined) return false
  const [low, high] = limits[field]
  return !Number.isInteger(value) || value < low || value > high
}
