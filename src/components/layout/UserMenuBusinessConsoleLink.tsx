'use client'

import Link from 'next/link'
import { Monitor } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores'
import { isBusinessAccount } from '@/lib/console-account-access'

/**
 * Highlighted "Business Console" entry for the global user dropdown.
 * Rendered directly above "My Account"; omitted for non-business accounts.
 */
export function UserMenuBusinessConsoleLink() {
  const user = useAuthStore((s) => s.user)
  const t = useTranslations('header')

  if (!isBusinessAccount(user)) return null

  return (
    <Link
      href="/console"
      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/25 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors border-b border-[var(--border)]"
    >
      <Monitor className="h-4 w-4 text-orange-500" aria-hidden="true" />
      {t('businessConsole')}
    </Link>
  )
}
