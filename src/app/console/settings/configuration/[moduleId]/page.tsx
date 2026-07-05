'use client'

/**
 * Platform Configuration — Studio module route (P9.3)
 *
 * Renders the Studio shell with `moduleId` (from the URL) as the active
 * module. This route file only wires routing + guards, exactly as it did
 * pre-P9.3 — `ConfigurationStudioLayout` (which wraps the unmodified
 * `ConfigurationModulePage`) holds all the actual rendering logic, so
 * Authentication (P9.1.3), Countries (P9.2), and any future module share
 * this exact file with no per-module page code.
 */
import { useParams, useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'

export default function ConfigurationModuleRoute() {
  const params = useParams<{ moduleId: string }>()
  const router = useRouter()
  const moduleId = params.moduleId

  return (
    <ErrorBoundary feature={`Platform Configuration — ${moduleId}`}>
      <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
        <ConfigurationStudioLayout
          activeModuleId={moduleId}
          onNavigate={(nextModuleId) => router.push(`/console/settings/configuration/${nextModuleId}`)}
        />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
