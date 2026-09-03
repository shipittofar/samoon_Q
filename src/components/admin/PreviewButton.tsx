'use client'

/**
 * P8.7 / P8.7.5 — Context-aware Preview Button
 *
 * Reads the active tenant and admin branch from their respective stores and
 * generates the correct public URL using `hrefToPublicUrl`. The ` href`prop is
 * treated as a module hint (e.g. "/menu", "/reservation") and is automatically
 * upgraded to the path-based URL /[tenantSlug]/[branchSlug]/[module].
 *
 * Falls back to the flat href if tenant or branch context is unavailable.
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { hrefToPublicUrl } from '@/utils/public-url'
import { useBranchStore, useRbacStore } from '@/stores'
import { useConsoleTenantId } from '@/hooks/console-workspace'

export interface PreviewButtonProps {
  /** Flat module href (e.g. "/menu", "/reservation", "/"). Upgraded to context-aware URL. */
  href: string
  /** Button label. Defaults to the translated "Preview Public Site". */
  label?: string
  /** Visual size. Defaults to "default". */
  size?: 'sm' | 'default'
  /** Extra class names applied to the anchor. */
  className?: string
}

export function PreviewButton({
  href,
  label,
  size = 'default',
  className,
}: PreviewButtonProps) {
  const t = useTranslations('console')
  const activeTenantId = useConsoleTenantId()
  const tenantSlug = useRbacStore((s) => {
    const memberships = s.sessionMemberships
    if (!activeTenantId || !memberships) return undefined
    return memberships.find((m) => m.tenantId === activeTenantId)?.tenantSlug
  })
  const branchSlug = useBranchStore((s) => s.adminActiveBranch?.slug)

  const publicUrl = hrefToPublicUrl(href, tenantSlug, branchSlug)

  return (
    <Link
      href={publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg-secondary)] font-medium transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-input)] hover:text-[var(--fg)]',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        className,
      )}
    >
      <ExternalLink className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label ?? t('previewPublicSite')}
    </Link>
  )
}
