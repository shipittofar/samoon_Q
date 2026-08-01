import { motion } from 'framer-motion'
import Link from 'next/link'
import { Star, Trash2, Edit2, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { AddressTypeIcon, AddressTypeChip, DefaultAddressBadge } from './AddressTypeChip'
import { VerificationBadge } from './VerificationBadge'
import { CapabilityBadgeList } from './CapabilityBadge'
import type { UserAddress } from '@/types/address'
import { cn } from '@/utils'

export interface AddressCardProps {
  address: UserAddress
  index?: number
  onEdit?: (address: UserAddress) => void
  onDelete?: (id: string) => void
  onSetDefault?: (id: string) => void
  onRestore?: (id: string) => void
  href?: string
  className?: string
}

export function AddressCard({
  address,
  index = 0,
  onEdit,
  onDelete,
  onSetDefault,
  onRestore,
  href,
  className,
}: AddressCardProps) {
  const t = useTranslations('address')
  const tCommon = useTranslations('common')

  const content = (
    <Card className={cn('!p-0 overflow-hidden', href && 'hover:border-orange-200 dark:hover:border-orange-900', className)}>
      <div className="flex items-start gap-4 p-5">
        <AddressTypeIcon type={address.address_type} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <AddressTypeChip type={address.address_type} label={address.custom_label} showIcon={false} />
            {address.is_default && <DefaultAddressBadge />}
            <VerificationBadge status={address.verification_status} />
            {address.is_deleted && (
              <Badge variant="secondary" className="text-xs">{t('deletedLabel')}</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--fg)] leading-relaxed">{address.formatted_address}</p>
          {address.delivery_notes && (
            <p className="text-xs text-[var(--fg-muted)] mt-1 line-clamp-1">{address.delivery_notes}</p>
          )}
          <div className="mt-2">
            <CapabilityBadgeList capabilities={address.capabilities} max={3} />
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {address.is_deleted ? (
            onRestore && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.preventDefault(); onRestore(address.id) }}
                aria-label={t('restoreAria')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )
          ) : (
            <>
              {!address.is_default && onSetDefault && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.preventDefault(); onSetDefault(address.id) }}
                  aria-label={t('setDefaultAria')}
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.preventDefault(); onEdit(address) }}
                  aria-label={tCommon('edit')}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.preventDefault(); onDelete(address.id) }}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  aria-label={tCommon('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )

  const wrapped = href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : content

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {wrapped}
    </motion.div>
  )
}
