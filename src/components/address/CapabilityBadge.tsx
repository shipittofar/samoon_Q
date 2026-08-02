import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import type { AddressCapabilities } from '@/types/address'
import { cn } from '@/utils'

type CapabilityKey = keyof AddressCapabilities

export interface CapabilityBadgeProps {
  capability: CapabilityKey
  available?: boolean
  className?: string
}

export function CapabilityBadge({ capability, available = true, className }: CapabilityBadgeProps) {
  const t = useTranslations('address.capabilities')

  if (!available) return null

  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {t(capability)}
    </Badge>
  )
}

export interface CapabilityBadgeListProps {
  capabilities?: AddressCapabilities | null
  className?: string
  max?: number
}

export function CapabilityBadgeList({ capabilities, className, max }: CapabilityBadgeListProps) {
  if (!capabilities) return null

  const active = (Object.entries(capabilities) as [CapabilityKey, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
  const shown = max ? active.slice(0, max) : active

  if (shown.length === 0) {
    const t = useTranslations('address.capabilities')
    return (
      <span className={cn('text-xs text-[var(--fg-subtle)]', className)}>{t('unavailable')}</span>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((key) => (
        <CapabilityBadge key={key} capability={key} />
      ))}
    </div>
  )
}
