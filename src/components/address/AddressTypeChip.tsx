import {
  Home, Briefcase, Building2, Warehouse, MapPin, type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import type { AddressType } from '@/types/address'
import { cn } from '@/utils'

const TYPE_ICONS: Record<AddressType, LucideIcon> = {
  home: Home,
  work: Briefcase,
  office: Building2,
  warehouse: Warehouse,
  other: MapPin,
}

export interface AddressTypeChipProps {
  type: AddressType
  label?: string | null
  className?: string
  showIcon?: boolean
}

export function AddressTypeChip({ type, label, className, showIcon = true }: AddressTypeChipProps) {
  const t = useTranslations('address')
  const Icon = TYPE_ICONS[type]
  const display = label?.trim() || t(`types.${type}`)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[var(--card-hover)] px-2.5 py-0.5 text-xs font-medium text-[var(--fg-muted)]',
        className,
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]"aria-hidden />}
      {display}
    </span>
  )
}

export function getAddressTypeIcon(type: AddressType): LucideIcon {
  return TYPE_ICONS[type]
}

export interface AddressTypeIconProps {
  type: AddressType
  className?: string
}

export function AddressTypeIcon({ type, className }: AddressTypeIconProps) {
  const Icon = TYPE_ICONS[type]
  return (
    <div
      className={cn(
        'h-10 w-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center shrink-0',
        className,
      )}
    >
      <Icon className="h-5 w-5 text-[var(--accent-text)]"aria-hidden />
    </div>
  )
}

export function DefaultAddressBadge() {
  const t = useTranslations('address')
  return <Badge variant="default"dot className="text-xs">{t('defaultLabel')}</Badge>
}
