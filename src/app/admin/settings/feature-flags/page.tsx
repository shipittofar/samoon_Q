'use client'

import Link from 'next/link'
import { ArrowLeft, Loader2, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { Badge } from '@/components/ui'
import { useFeatureFlags, useUpdateFeatureFlag } from '@/hooks'

const SOURCE_LABEL: Record<string, string> = {
  module_default:  'Module Default',
  capability:      'Capability',
  tenant_override: 'Tenant Override',
}
const SOURCE_BADGE: Record<string, 'secondary' | 'info' | 'success'> = {
  module_default:  'secondary',
  capability:      'info',
  tenant_override: 'success',
}

function FeatureFlagsContent() {
  const { data: flags, isLoading, isError } = useFeatureFlags()
  const { mutate: updateFlag, isPending } = useUpdateFeatureFlag()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading feature flags…
      </div>
    )
  }

  if (isError || !flags) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <XCircle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-gray-600">Failed to load feature flags.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div
          key={flag.key}
          className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border hover:border-gray-300 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-medium text-gray-800">{flag.key}</span>
              <Badge variant={SOURCE_BADGE[flag.source] ?? 'secondary'}>
                {SOURCE_LABEL[flag.source] ?? flag.source}
              </Badge>
            </div>
          </div>
          <button
            onClick={() => updateFlag({ key: flag.key, value: !flag.value })}
            disabled={isPending}
            className={`ml-4 shrink-0 transition-colors ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={`Toggle ${flag.key}`}
          >
            {flag.value ? (
              <ToggleRight className="w-8 h-8 text-blue-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-400" />
            )}
          </button>
        </div>
      ))}
      {flags.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No feature flags configured.</p>
      )}
    </div>
  )
}

export default function FeatureFlagsPage() {
  return (
    <ErrorBoundary feature="Feature Flags">
      <PermissionGuard permission="settings.manage">
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
              <Link href="/admin/settings" className="text-gray-400 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-lg font-semibold">Feature Flags</h1>
            </div>
          </div>
          <div className="max-w-3xl mx-auto px-4 py-6">
            <p className="text-sm text-gray-500 mb-5">
              Toggle capability flags for this tenant. Tenant overrides take precedence over module defaults.
            </p>
            <FeatureFlagsContent />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
