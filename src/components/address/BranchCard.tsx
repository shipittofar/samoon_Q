import { Building2, MapPin, Ruler } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui'
import { Badge } from '@/components/ui'
import type { ServiceabilityBranch } from '@/types/address'
import { cn } from '@/utils'

const STATUS_VARIANT: Record<ServiceabilityBranch['status'], 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
  maintenance: 'warning',
}

export interface BranchCardProps {
  branch: ServiceabilityBranch
  className?: string
}

export function BranchCard({ branch, className }: BranchCardProps) {
  const t = useTranslations('address.serviceability')

  return (
    <Card className={cn('!p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
          <Building2 className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-[var(--fg)]">{branch.name}</p>
            <Badge variant={STATUS_VARIANT[branch.status]} className="text-xs capitalize">
              {t(`branchStatus.${branch.status}`)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
            {branch.distance_km != null && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {t('distance', { km: branch.distance_km.toFixed(1) })}
              </span>
            )}
            {branch.delivery_radius_km != null && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                {t('radius', { km: branch.delivery_radius_km })}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
