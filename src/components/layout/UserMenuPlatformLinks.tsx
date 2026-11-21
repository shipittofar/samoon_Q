'use client'

import Link from 'next/link'
import { ShieldCheck, Store } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores'
import { isBusinessAccount } from '@/lib/console-account-access'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'

const itemClass =
  'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors border-b border-[var(--border)]'

/**
 * User-menu entries next to the business console link:
 *  - platform superusers: "Platform panel" (the superuser part of the console);
 *  - everyone without a business: "Register a business".
 */
export function UserMenuPlatformLinks() {
  const user = useAuthStore((s) => s.user)
  const t = useTranslations('superadmin')
  if (!user) return null

  if (isPlatformSuperuser(user)) {
    return (
      <Link href="/console/platform" className={itemClass}>
        <ShieldCheck className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
        {t('nav.platformPanel')}
      </Link>
    )
  }
  if (!isBusinessAccount(user)) {
    return (
      <Link href="/business/register" className={itemClass}>
        <Store className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
        {t('nav.registerBusiness')}
      </Link>
    )
  }
  return null
}
