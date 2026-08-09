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
        <div className="h-20 rounded-lg border bg-gray-50 animate-pulse" />
        <div className="h-20 rounded-lg border bg-gray-50 animate-pulse" />
        <div className="h-20 rounded-lg border bg-gray-50 animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-gray-500">{t('noEffectivePermissionsData')}</p>
  }

  const denyOverrides = data.overrides.filter((o) => o.effect === 'deny')
  const allowOverrides = data.overrides.filter((o) => o.effect === 'allow')

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('inheritedPermissionsLabel')}</h3>
        <div className="flex flex-wrap gap-1">
          {data.inherited.length === 0 ? (
            <span className="text-xs text-gray-400">{t('noneLabel')}</span>
          ) : (
            data.inherited.map((p) => (
              <span key={p} className="text-xs font-mono px-2 py-0.5 rounded bg-white border text-gray-700">
                {p}
              </span>
            ))
          )}
        </div>
      </section>

      <div className="flex justify-center text-gray-400">
        <ArrowDown className="w-4 h-4" />
      </div>

      <section className="rounded-lg border border-indigo-100 p-4 bg-indigo-50/50">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('overridePermissionsLabel')}</h3>
        {data.overrides.length === 0 ? (
          <span className="text-xs text-gray-400">{t('noneLabel')}</span>
        ) : (
          <div className="space-y-2">
            {allowOverrides.map((o) => (
              <div key={`allow-${o.permission}`} className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                <span className="font-mono text-green-800">{o.permission}</span>
                <span className="text-green-600">({t('allowEffectLabel')})</span>
              </div>
            ))}
            {denyOverrides.map((o) => (
              <div key={`deny-${o.permission}`} className="flex items-center gap-2 text-xs">
                <ShieldX className="w-3.5 h-3.5 text-red-600" />
                <span className="font-mono text-red-800 line-through">{o.permission}</span>
                <span className="text-red-600">({t('denyEffectLabel')})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-center text-gray-400">
        <ArrowDown className="w-4 h-4" />
      </div>

      <section className="rounded-lg border border-green-200 p-4 bg-green-50/40">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('finalEffectivePermissionsLabel')}</h3>
        <div className="flex flex-wrap gap-1">
          {data.effective.length === 0 ? (
            <span className="text-xs text-gray-400">{t('noneLabel')}</span>
          ) : (
            data.effective.map((p) => {
              const denied = denyOverrides.some((d) => d.permission === p)
              return (
                <span
                  key={p}
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    denied
                      ? 'bg-red-50 text-red-400 border-red-100 line-through'
                      : 'bg-white text-gray-800 border-green-200'
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
