'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useAuthStore } from '@/stores'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'
import { PLATFORM_HOMEPAGE_ADMIN_HREF } from '@/lib/platform-homepage'

/**
 * Tenant console must not host Platform Homepage CMS.
 * Superusers are sent to platform-admin; everyone else is denied.
 */
export default function ConsolePlatformHomepageRedirectPage() {
  const router = useRouter()
  const isLoading = useAuthStore((s) => s.isLoading)
  const user = useAuthStore((s) => s.user)
  const allowed = isPlatformSuperuser(user)

  useEffect(() => {
    if (!isLoading && allowed) {
      router.replace(PLATFORM_HOMEPAGE_ADMIN_HREF)
    }
  }, [allowed, isLoading, router])

  if (isLoading || allowed) return null
  return <AccessDenied />
}
