'use client'

/**
 * Platform Configuration — module index (P9.1.3 Phase B)
 *
 * Lists every module registered in PlatformConfigurationRegistry. Reads the
 * registry directly (via usePlatformConfiguration()) — adding a future
 * module (Countries, Themes, Payments, …) requires no change to this page;
 * it appears here automatically the moment it's registered.
 */
import Link from 'next/link'
import { ArrowRight, LayoutGrid } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { Badge } from '@/components/ui'
import { platformConfigurationRegistry } from '@/config'
import { usePlatformConfiguration } from '@/hooks/use-platform-configuration'

const LIFECYCLE_BADGE_VARIANT = {
  draft: 'secondary',
  testing: 'purple',
  published: 'success',
  deprecated: 'warning',
  archived: 'outline',
} as const

function ConfigurationIndexContent() {
  const modules = usePlatformConfiguration()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[var(--fg)]">
            <LayoutGrid className="h-5 w-5 text-orange-500" aria-hidden="true" />
            Platform Configuration
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Every platform-wide setting lives in one of these modules. Authentication is the reference implementation — see docs/P9.1.3_AUTHENTICATION_CONTROL_CENTER.md.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((mod) => {
            const lifecycle = platformConfigurationRegistry.getModuleLifecycle(mod.id)
            const fieldCount = mod.sections.reduce((sum, s) => sum + s.fields.length, 0)
            return (
              <Link
                key={mod.id}
                href={`/console/settings/configuration/${mod.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-orange-300"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--fg)]">{mod.name}</span>
                    <Badge variant={LIFECYCLE_BADGE_VARIANT[lifecycle]}>{lifecycle}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">{mod.description}</p>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)] opacity-70">{fieldCount} setting{fieldCount === 1 ? '' : 's'} · v{mod.version}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ConfigurationIndexPage() {
  return (
    <ErrorBoundary feature="Platform Configuration">
      <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
        <ConfigurationIndexContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
