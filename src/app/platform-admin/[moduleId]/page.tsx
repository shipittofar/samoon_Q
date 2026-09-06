'use client'

/**
 * Platform Administration Center — module route (P9.4)
 *
 * `moduleId` from the URL renders through the same
 * `ConfigurationStudioLayout`/`ConfigurationModulePage` pipeline every
 * Configuration Studio module (Authentication, Countries, …) and every
 * newly-registered Platform Administration module (Tenants, Platform
 * Users, Billing, …) already share — this route file only wires
 * routing. Route authorization lives on the layout (`user.is_superuser`).
 */
import { useParams, useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'
import { PlatformDashboard } from '@/components/admin/platform-admin/PlatformDashboard'
import { PlatformHomepageHeroEditor } from '@/components/admin/platform-admin/PlatformHomepageHeroEditor'
import { PLATFORM_HOMEPAGE_MODULE_ID } from '@/lib/platform-homepage'
import '@/platform-admin'

export default function PlatformAdminModuleRoute() {
  const params = useParams<{ moduleId: string }>()
  const router = useRouter()
  const moduleId = params.moduleId
  const customWorkspace =
    moduleId === PLATFORM_HOMEPAGE_MODULE_ID ? <PlatformHomepageHeroEditor /> : undefined

  return (
    <ErrorBoundary feature={`Platform Administration — ${moduleId}`}>
      <ConfigurationStudioLayout
        activeModuleId={moduleId}
        onNavigate={(nextModuleId) => router.push(`/platform-admin/${nextModuleId}`)}
        emptyWorkspace={<PlatformDashboard />}
        permissionContext="platform"
        customWorkspace={customWorkspace}
      />
    </ErrorBoundary>
  )
}
