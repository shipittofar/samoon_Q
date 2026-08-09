import type { RbacAssignment } from '@/types/rbac-api'

/** Group tenant assignments by user id for list views. */
export function groupAssignmentsByUserId(assignments: RbacAssignment[]): Map<string, RbacAssignment[]> {
  const map = new Map<string, RbacAssignment[]>()
  for (const a of assignments) {
    if (!a.userId) continue
    const list = map.get(a.userId) ?? []
    list.push(a)
    map.set(a.userId, list)
  }
  return map
}

/** Active/future assignment role labels (deduped, order preserved). */
export function activeRoleLabels(assignments: RbacAssignment[]): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const a of assignments) {
    if (a.status !== 'active' && a.status !== 'future') continue
    if (!seen.has(a.role)) {
      seen.add(a.role)
      labels.push(a.role)
    }
  }
  return labels
}

/** Whether a user has an active assignment at a location (or tenant-wide). */
export function userHasLocationAccess(
  assignments: RbacAssignment[],
  locationId: string,
): boolean {
  const active = assignments.filter((a) => a.status === 'active')
  if (active.length === 0) return true
  if (active.some((a) => a.allLocations)) return true
  return active.some((a) => a.locations.some((l) => l.id === locationId))
}
