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
      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[var(--accent-text)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)] transition-colors border-b border-[var(--border)]"
    >
      <Monitor className="h-4 w-4 text-[var(--accent-text)]"aria-hidden="true"/>
      {t('businessConsole')}
    </Link>
  )
}
