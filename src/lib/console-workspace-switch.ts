/**
 * Monotonic generation tokens for console tenant/branch switch requests.
 * Last user action wins — stale in-flight responses are discarded.
 */
let tenantSwitchGeneration = 0
let branchSwitchGeneration = 0
/** Guards in-flight `loadTenantById` / enrichment — stale completions are ignored. */
let tenantLoadGeneration = 0

export function nextTenantSwitchGeneration(): number {
  tenantSwitchGeneration += 1
  return tenantSwitchGeneration
}

export function nextBranchSwitchGeneration(): number {
  branchSwitchGeneration += 1
  return branchSwitchGeneration
}

export function isCurrentTenantSwitch(generation: number): boolean {
  return generation === tenantSwitchGeneration
}

export function isCurrentBranchSwitch(generation: number): boolean {
  return generation === branchSwitchGeneration
}

export function nextTenantLoadGeneration(): number {
  tenantLoadGeneration += 1
  return tenantLoadGeneration
}

export function isCurrentTenantLoad(generation: number): boolean {
  return generation === tenantLoadGeneration
}

/** Invalidates any in-flight tenant enrichment loads (e.g. on tenant switch). */
export function invalidateTenantLoads(): number {
  return nextTenantLoadGeneration()
}
