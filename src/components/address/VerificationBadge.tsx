import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import type { VerificationStatus } from '@/types/address'
import { cn } from '@/utils'

const VARIANT_MAP: Record<VerificationStatus, 'warning' | 'success' | 'danger' | 'secondary'> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
  expired: 'secondary',
}

export interface VerificationBadgeProps {
  status: VerificationStatus
  className?: string
}

export function VerificationBadge({ status, className }: VerificationBadgeProps) {
  const t = useTranslations('address.verification')

  return (
    <Badge
      variant={VARIANT_MAP[status]}
      dot
      className={cn('text-xs capitalize', className)}
      aria-label={t(status)}
    >
      {t(status)}
    </Badge>
  )
}
