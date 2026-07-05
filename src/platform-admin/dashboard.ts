/**
 * Platform Dashboard Widget Registry — P9.4 Phase D
 *
 * A metadata-driven widget registry, deliberately modeled on
 * `PlatformConfigurationRegistry`'s own shape (register-once, duplicate-id
 * guard, read-only accessors) because that pattern already proved itself
 * across P9.0–P9.3 — but it is NOT the same registry, because dashboard
 * widgets and configuration fields are genuinely different domains (a
 * widget computes a live value; a field resolves an inheritance chain).
 * Reusing the *shape* of a proven pattern for a new domain is composition,
 * not the "duplicate implementation" the phase explicitly warns against —
 * conflating the two would have been the actual mistake (a widget is not
 * a field and must not be forced through `ConfigurationService.resolveField`).
 */
import type { PlatformAdminGroup } from './nav-groups'

export type PlatformWidgetKind = 'stat' | 'list' | 'status'

export interface PlatformStatValue {
  kind: 'stat'
  value: string | number
  unit?: string
  /** Positive = improvement, negative = regression; sign convention is per-widget (`higherIsBetter`). */
  deltaPercent?: number
  higherIsBetter?: boolean
}

export interface PlatformListValue {
  kind: 'list'
  items: { label: string; value: string }[]
}

export interface PlatformStatusValue {
  kind: 'status'
  state: 'operational' | 'degraded' | 'down'
  label: string
}

export type PlatformWidgetValue = PlatformStatValue | PlatformListValue | PlatformStatusValue

export interface PlatformWidgetDefinition {
  id: string
  title: string
  description?: string
  icon?: string
  group: PlatformAdminGroup
  kind: PlatformWidgetKind
  platformPermission?: string
  /** Synchronous by design (mock-data derived, like every other illustrative default in this codebase) — swap for an async data hook when a real backend exists, per docs/P9.4_PLATFORM_ADMIN_CENTER.md's extension guide. */
  compute: () => PlatformWidgetValue
}

class PlatformDashboardRegistry {
  private widgets = new Map<string, PlatformWidgetDefinition>()

  register(widget: PlatformWidgetDefinition): void {
    if (this.widgets.has(widget.id)) {
      throw new Error(`[PlatformDashboardRegistry] duplicate widget id "${widget.id}"`)
    }
    this.widgets.set(widget.id, widget)
  }

  getWidgets(): PlatformWidgetDefinition[] {
    return Array.from(this.widgets.values())
  }

  getWidget(id: string): PlatformWidgetDefinition | undefined {
    return this.widgets.get(id)
  }

  /**
   * Test-only reset. Unlike `platformConfigurationRegistry` (P9.0), which
   * seals permanently after its first read to guarantee registration only
   * ever happens at module-import time, this registry has no such
   * safety-critical seal — widgets are read-only presentational metadata,
   * not resolved/audited configuration state, so a reset seam for test
   * isolation carries none of the risk a config-registry reset would.
   */
  __resetForTests(): void {
    this.widgets.clear()
  }
}

export const platformDashboardRegistry = new PlatformDashboardRegistry()
