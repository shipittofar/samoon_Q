'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { Badge } from '@/components/ui'
import { useFeatureFlags, useUpdateFeatureFlag } from '@/hooks'

const SOURCE_KEY: Record<string, string> = {
  module_default:  'sourceModuleDefault',
  capability:      'sourceCapability',
  tenant_override: 'sourceTenantOverride',
}
const SOURCE_BADGE: Record<string, 'secondary' | 'info' | 'success'> = {
  module_default:  'secondary',
  capability:      'info',
  tenant_override: 'success',
}

function FeatureFlagsContent() {
  const t = useTranslations('console')
  const { data: flags, isLoading, isError } = useFeatureFlags()
  const { mutate: updateFlag, isPending } = useUpdateFeatureFlag()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)] text-sm">
        <Loader2 className="w-4 h-4 animate-spin"/>
        {t('loadingFeatureFlags')}
      </div>
    )
  }

  if (isError || !flags) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <XCircle className="w-6 h-6 text-[var(--danger-text)]"/>
        <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadFeatureFlags')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div
          key={flag.key}
          className="flex items-center justify-between py-3 px-4 bg-[var(--card)] rounded-lg border hover:border-[var(--border-input)] transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-medium text-[var(--fg)]">{flag.key}</span>
              <Badge variant={SOURCE_BADGE[flag.source] ?? 'secondary'}>
                {SOURCE_KEY[flag.source] ? t(SOURCE_KEY[flag.source]) : flag.source}
              </Badge>
            </div>
          </div>
          <button
            onClick={() => updateFlag({ key: flag.key, value: !flag.value })}
            disabled={isPending}
            className={`ml-4 shrink-0 transition-colors ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={t('toggleFlagAria', { key: flag.key })}
          >
            {flag.value ? (
              <ToggleRight className="w-8 h-8 text-[var(--info-text)]"/>
            ) : (
              <ToggleLeft className="w-8 h-8 text-[var(--fg-subtle)]"/>
            )}
          </button>
        </div>
      ))}
      {flags.length === 0 && (
        <p className="text-sm text-[var(--fg-muted)] text-center py-8">{t('noFeatureFlagsConfigured')}</p>
      )}
    </div>
  )
}

export default function FeatureFlagsPage() {
  const t = useTranslations('console')
  return (
    <ErrorBoundary feature="Feature Flags">
      <PermissionGuard permission="settings.manage"fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--card-hover)]">
          <div className="bg-[var(--card)] border-b sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <Link href="/console/settings"className="text-[var(--fg-subtle)] hover:text-[var(--fg)]">
                <ArrowLeft className="w-5 h-5"/>
              </Link>
              <h1 className="text-lg font-semibold">{t('settingsTabFeatureFlags')}</h1>
            </div>
          </div>
          <div className="max-w-3xl mx-auto px-4 py-6">
            <p className="text-sm text-[var(--fg-muted)] mb-5">
              {t('toggleCapabilityFlagsHint')}
            </p>
            <FeatureFlagsContent />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
