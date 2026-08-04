/**
 * Dev/audit counters for console bootstrap load calls.
 * Consumed by scripts/console-phase1-validate.mjs — not used in production UI.
 */
export type ConsoleBootMetricName =
  | 'loadTenant'
  | 'loadTenantById'
  | 'loadBranchesForTenant'
  | 'loadBranchesFromMembership'

export function recordConsoleBootMetric(name: ConsoleBootMetricName): void {
  if (typeof window === 'undefined') return
  const w = window as Window & {
    __consoleBootMetrics?: Record<ConsoleBootMetricName, number>
  }
  if (!w.__consoleBootMetrics) {
    w.__consoleBootMetrics = {
      loadTenant: 0,
      loadTenantById: 0,
      loadBranchesForTenant: 0,
      loadBranchesFromMembership: 0,
    }
  }
  w.__consoleBootMetrics[name] += 1
  window.dispatchEvent(new CustomEvent('console:boot-metric', { detail: { name } }))
}

export function resetConsoleBootMetrics(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & {
    __consoleBootMetrics?: Record<ConsoleBootMetricName, number>
  }
  if (w.__consoleBootMetrics) {
    for (const key of Object.keys(w.__consoleBootMetrics) as ConsoleBootMetricName[]) {
      w.__consoleBootMetrics[key] = 0
    }
  }
}
