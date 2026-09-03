/**
 * PlatformDashboardWidgetCard — P9.4 Phase D
 *
 * Renders one `PlatformWidgetDefinition` by its `kind` — a stat tile,
 * status indicator, or small list — the same one-dispatch-point pattern
 * `ConfigurationFieldRow` uses for `field.type` (P9.2). Status colors
 * (emerald/amber/red) are reserved for delta/state meaning only — value
 * text itself always stays neutral ink, per the dataviz skill's "text
 * wears text tokens, never the series color"rule.
 */
import { useTranslations } from 'next-intl'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { PlatformWidgetDefinition, PlatformWidgetValue } from '@/platform-admin/dashboard'
import { resolvePlatformAdminIcon } from '@/platform-admin/icon-map'
import { resolveConfigText } from '@/config'

const STATUS_DOT: Record<'operational' | 'degraded' | 'down', string> = {
  operational: 'bg-[var(--success)]',
  degraded: 'bg-[var(--warning)]',
  down: 'bg-[var(--danger)]',
}

const STATUS_TEXT: Record<'operational' | 'degraded' | 'down', string> = {
  operational: 'text-[var(--success-text)]',
  degraded: 'text-[var(--warning-text)]',
  down: 'text-[var(--danger-text)]',
}

function formatStatValue(value: PlatformWidgetValue & { kind: 'stat' }): string {
  const formatted = typeof value.value === 'number' ? value.value.toLocaleString() : value.value
  if (value.unit === '$') return `$${formatted}`
  if (value.unit) return `${formatted} ${value.unit}`
  return String(formatted)
}

export function PlatformDashboardWidgetCard({ widget }: { widget: PlatformWidgetDefinition }) {
  const tFields = useTranslations('configFields')
  const value = widget.compute()
  const Icon = resolvePlatformAdminIcon(widget.icon)
  const title = resolveConfigText(tFields, widget.id, 'title', widget.title)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"data-widget-id={widget.id}>
      <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
        <Icon className="h-3.5 w-3.5"aria-hidden="true"/>
        <span>{title}</span>
      </div>

      {value.kind === 'stat' && (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[var(--fg)]">{formatStatValue(value)}</span>
          {value.deltaPercent !== undefined && value.deltaPercent !== 0 && (() => {
            const isImprovement = value.higherIsBetter ? value.deltaPercent > 0 : value.deltaPercent < 0
            const Trend = value.deltaPercent > 0 ? TrendingUp : TrendingDown
            return (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${isImprovement ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}>
                <Trend className="h-3 w-3"aria-hidden="true"/>
                {Math.abs(value.deltaPercent)}%
              </span>
            )
          })()}
        </div>
      )}

      {value.kind === 'status' && (
        <div className="mt-2 flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[value.state]}`} aria-hidden="true"/>
          <span className={`text-sm font-medium ${STATUS_TEXT[value.state]}`}>{value.label}</span>
        </div>
      )}

      {value.kind === 'list' && (
        <ul className="mt-2 space-y-1">
          {value.items.map((item) => (
            <li key={item.label} className="flex items-center justify-between text-sm">
              <span className="truncate text-[var(--fg)]">{item.label}</span>
              <span className="shrink-0 text-[var(--fg-muted)]">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
