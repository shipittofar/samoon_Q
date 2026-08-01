import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export interface AddressEmptyStateProps {
  onAdd?: () => void
}

export function AddressEmptyState({ onAdd }: AddressEmptyStateProps) {
  const t = useTranslations('address')

  return (
    <EmptyState
      icon={<MapPin className="h-8 w-8" />}
      title={t('emptyTitle')}
      description={t('emptyDescription')}
      action={onAdd ? <Button onClick={onAdd}>{t('addAddress')}</Button> : undefined}
    />
  )
}
