import { Clock, DollarSign, Package, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui'
import { CapabilityBadgeList } from './CapabilityBadge'
import { BranchCard } from './BranchCard'
import type { BranchCheckout } from '@/types/branch'
import type { ServiceabilityResult } from '@/types/address'
import { formatCurrency, cn } from '@/utils'
import { filterDeliveryCapabilities } from '@/lib/branch-checkout'

export interface DeliveryInfoCardProps {
  result: ServiceabilityResult
  checkout?: BranchCheckout
  className?: string
}

export function DeliveryInfoCard({ result, checkout, className }: DeliveryInfoCardProps) {
  const t = useTranslations('address.serviceability')
  const filteredCapabilities = filterDeliveryCapabilities(result.capabilities, checkout)

  return (
    <Card className={cn('space-y-4', className)}>
      <div className="flex items-start gap-3">
        {result.deliverable ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className={cn('font-semibold', result.deliverable ? 'text-emerald-600' : 'text-amber-600')}>
            {result.deliverable ? t('deliverable') : t('notDeliverable')}
          </p>
          {!result.deliverable && result.reason && (
            <p className="text-sm text-[var(--fg-muted)] mt-1">{result.reason}</p>
          )}
        </div>
      </div>

      {result.deliverable && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {result.delivery_fee != null && (
            <div className="flex items-center gap-2 text-[var(--fg-muted)]">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <span>{t('deliveryFee', { fee: formatCurrency(result.delivery_fee) })}</span>
            </div>
          )}
          {result.eta_minutes != null && (
            <div className="flex items-center gap-2 text-[var(--fg-muted)]">
              <Clock className="h-4 w-4 text-orange-500" />
              <span>{t('eta', { minutes: result.eta_minutes })}</span>
            </div>
          )}
          {result.minimum_order != null && (
            <div className="flex items-center gap-2 text-[var(--fg-muted)]">
              <Package className="h-4 w-4 text-orange-500" />
              <span>{t('minimumOrder', { amount: formatCurrency(result.minimum_order) })}</span>
            </div>
          )}
        </div>
      )}

      {result.branch && <BranchCard branch={result.branch} />}

      {filteredCapabilities && (
        <div>
          <p className="text-xs font-medium text-[var(--fg-muted)] mb-2">{t('capabilitiesTitle')}</p>
          <CapabilityBadgeList capabilities={filteredCapabilities} />
        </div>
      )}
    </Card>
  )
}
