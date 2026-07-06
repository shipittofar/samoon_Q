'use client'

/**
 * P8.7.5 — Context-aware QR Table Preview
 * Accepts [code] (table identifier) and renders the table ordering experience
 * for the selected tenant/branch. Context initialized by parent layout.
 */

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useBranchStore } from '@/stores'

export default function TenantBranchTablePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string; code: string }>
}) {
  const t = useTranslations('branch')
  const { code } = use(params)
  const adminActiveBranch = useBranchStore((s) => s.adminActiveBranch)
  const router = useRouter()

  // Redirect to the flat QR route with the table code, once branch context is set
  useEffect(() => {
    router.replace(`/table/${code}`)
  }, [code, router])

  return (
    <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
      {t('loadingTableExperienceEllipsis')}
    </div>
  )
}
