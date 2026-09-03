'use client'

/**
 * Phase Z.10 — Console onboarding state.
 *
 * Rendered by ConsoleWorkspaceGate when an authenticated user has ZERO
 * tenant memberships (hasTenantMembership === false). Console still
 * loads for this user — tenant is a context inside Console, not a gate
 * preventing it from loading — this is the friendly landing state
 * instead of a hard "Tenant not found" error.
 *
 * No self-serve tenant-provisioning flow exists yet (the platform's
 * `/console/tenants/new` wizard requires `tenant.manage` on an already-
 * resolved tenant — structurally unreachable for a zero-membership user
 * under the current RBAC model, see
 * docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md §5), so this screen
 * points to support rather than a broken in-app CTA.
 */

import { Store, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function ConsoleOnboarding() {
  const t = useTranslations('console')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)]">
        <Store className="h-8 w-8"aria-hidden="true"/>
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold text-[var(--fg)]">{t('onboardingTitle')}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{t('onboardingDesc')}</p>
      </div>
      <a
        href="mailto:hello@samoon.com"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        <Mail className="h-4 w-4"aria-hidden="true"/>
        {t('onboardingContactCta')}
      </a>
    </div>
  )
}
