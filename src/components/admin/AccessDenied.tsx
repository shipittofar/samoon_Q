'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore, useRbacStore } from '@/stores'
import { getPostLoginRedirect } from '@/utils/auth-redirect'

interface AccessDeniedProps {
  resource?: string
}

export function AccessDenied({ resource }: AccessDeniedProps) {
  const t = useTranslations('console')
  const user = useAuthStore((s) => s.user)
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)
  // Phase 9.3 — "my workspace" should reflect the user's real tenant-scoped
  // RBAC roles (the actual authorization source) when refining WHICH
  // /console/* page to send a business account to. This is a landing-page
  // guess, never an access grant; the destination page still enforces its
  // own permission check.
  //
  // Phase Z.9 — routed through the same getPostLoginRedirect() every
  // post-auth success handler uses, rather than a second, hand-rolled
  // accountType/roles decision. Previously this duplicated logic could
  // send a `customer` account to `/console/*` whenever `currentTenantSession`
  // happened to carry roles (e.g. stale state from a previous tenant) —
  // getPostLoginRedirect() makes accountType authoritative for direction,
  // so a customer account always resolves to `/dashboard` here too.
  const workspace = getPostLoginRedirect(user?.accountType ?? 'customer', currentTenantSession?.roles)

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-subtle)] text-[var(--danger-text)]">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--fg)]">{t('accessDenied')}</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {resource
            ? t('noPermissionToAccessResource', { resource })
            : t('noPermissionToViewPage')}
        </p>
      </div>
      <Link
        href={workspace}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        {t('goToMyWorkspace')}
      </Link>
    </div>
  )
}
