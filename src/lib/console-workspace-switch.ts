/**
 * Monotonic generation tokens for console tenant/branch switch requests.
 * Last user action wins — stale in-flight responses are discarded.
 */
let tenantSwitchGeneration = 0
let branchSwitchGeneration = 0

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
