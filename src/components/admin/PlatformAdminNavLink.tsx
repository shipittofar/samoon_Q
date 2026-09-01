'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'

export function PlatformAdminNavLink() {
  const user = useAuthStore((s) => s.user)
  const t = useTranslations('console')
  if (!isPlatformSuperuser(user)) return null
  return (
    <Link
      href="/platform-admin"
      data-testid="platform-admin-nav"
      className="hidden sm:flex h-9 items-center px-3 rounded-xl text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
    >
      {t('navGroupPlatform')}
    </Link>
  )
}
