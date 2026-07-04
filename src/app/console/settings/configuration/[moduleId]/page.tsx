'use client'

/**
 * Platform Configuration — generic module page (P9.1.3)
 *
 * This route is the reusable Control Center shell for ANY registered
 * PlatformConfigurationRegistry module — `moduleId` comes straight from the
 * URL, so Authentication (P9.1.3) and every future module (Countries,
 * Themes, Payments, …) share this exact file. See
 * ConfigurationModulePage (src/components/admin/configuration/) for the
 * actual rendering logic; this file only wires routing + guards.
 */
import { useParams } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ConfigurationModulePage } from '@/components/admin/configuration/ConfigurationModulePage'

export default function ConfigurationModuleRoute() {
  const params = useParams<{ moduleId: string }>()
  const moduleId = params.moduleId

  return (
    <ErrorBoundary feature={`Platform Configuration — ${moduleId}`}>
      <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
        <ConfigurationModulePage moduleId={moduleId} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
