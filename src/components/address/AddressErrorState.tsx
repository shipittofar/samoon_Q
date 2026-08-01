import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

export interface AddressErrorStateProps {
  onRetry?: () => void
  message?: string
}

export function AddressErrorState({ onRetry, message }: AddressErrorStateProps) {
  const t = useTranslations('address')
  const tCommon = useTranslations('common')

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500">
        <AlertCircle className="h-8 w-8" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base font-semibold text-[var(--fg)]">{t('errorTitle')}</h3>
        <p className="text-sm text-[var(--fg-muted)]">{message ?? t('errorDescription')}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
          {tCommon('retry')}
        </Button>
      )}
    </div>
  )
}
