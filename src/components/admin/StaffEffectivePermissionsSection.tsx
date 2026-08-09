'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { EffectivePermissionViewer } from '@/components/admin/EffectivePermissionViewer'
import { useEffectivePermissions } from '@/hooks'

export interface StaffEffectivePermissionsSectionProps {
  membershipId: string
  userId: string
}

export function StaffEffectivePermissionsSection({
  membershipId,
  userId,
}: StaffEffectivePermissionsSectionProps) {
  const t = useTranslations('console')
  const { data, isLoading } = useEffectivePermissions({
    membership_id: membershipId,
    user_id: userId,
  })

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{t('effectivePermissionsTitle')}</h2>
      <EffectivePermissionViewer data={data} loading={isLoading} />
    </section>
  )
}
