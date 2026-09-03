'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheck, ShieldX, ArrowDown } from 'lucide-react'
import type { EffectivePermissionsResponse } from '@/types/rbac-api'

export interface EffectivePermissionViewerProps {
  data?: EffectivePermissionsResponse
  loading?: boolean
}

export function EffectivePermissionViewer({ data, loading = false }: EffectivePermissionViewerProps) {
  const t = useTranslations('console')

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 rounded-lg border bg-[var(--card-hover)] animate-pulse"/>
        <div className="h-20 rounded-lg border bg-[var(--card-hover)] animate-pulse"/>
        <div className="h-20 rounded-lg border bg-[var(--card-hover)] animate-pulse"/>
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('noEffectivePermissionsData')}</p>
  }

  const denyOverrides = data.overrides.filter((o) => o.effect === 'deny')
  const allowOverrides = data.overrides.filter((o) => o.effect === 'allow')

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--border)] p-4 bg-[var(--card-hover)]">
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">{t('inheritedPermissionsLabel')}</h3>
        <div className="flex flex-wrap gap-1">
          {data.inherited.length === 0 ? (
            <span className="text-xs text-[var(--fg-subtle)]">{t('noneLabel')}</span>
          ) : (
            data.inherited.map((p) => (
              <span key={p} className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--card)] border text-[var(--fg-secondary)]">
                {p}
              </span>
            ))
          )}
        </div>
      </section>

      <div className="flex justify-center text-[var(--fg-subtle)]">
        <ArrowDown className="w-4 h-4"/>
      </div>

      <section className="rounded-lg border border-[var(--info-border)] p-4 bg-[var(--info-subtle)]/50">
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">{t('overridePermissionsLabel')}</h3>
        {data.overrides.length === 0 ? (
          <span className="text-xs text-[var(--fg-subtle)]">{t('noneLabel')}</span>
        ) : (
          <div className="space-y-2">
            {allowOverrides.map((o) => (
              <div key={`allow-${o.permission}`} className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--success-text)]"/>
                <span className="font-mono text-[var(--success-text)]">{o.permission}</span>
                <span className="text-[var(--success-text)]">({t('allowEffectLabel')})</span>
              </div>
            ))}
            {denyOverrides.map((o) => (
              <div key={`deny-${o.permission}`} className="flex items-center gap-2 text-xs">
                <ShieldX className="w-3.5 h-3.5 text-[var(--danger-text)]"/>
                <span className="font-mono text-[var(--danger-text)] line-through">{o.permission}</span>
                <span className="text-[var(--danger-text)]">({t('denyEffectLabel')})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-center text-[var(--fg-subtle)]">
        <ArrowDown className="w-4 h-4"/>
      </div>

      <section className="rounded-lg border border-[var(--success-border)] p-4 bg-[var(--success-subtle)]/40">
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">{t('finalEffectivePermissionsLabel')}</h3>
        <div className="flex flex-wrap gap-1">
          {data.effective.length === 0 ? (
            <span className="text-xs text-[var(--fg-subtle)]">{t('noneLabel')}</span>
          ) : (
            data.effective.map((p) => {
              const denied = denyOverrides.some((d) => d.permission === p)
              return (
                <span
                  key={p}
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    denied
                      ? 'bg-[var(--danger-subtle)] text-[var(--danger-text)] border-[var(--danger-border)] line-through'
                      : 'bg-[var(--card)] text-[var(--fg)] border-[var(--success-border)]'
                  }`}
                >
                  {p}
                </span>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
