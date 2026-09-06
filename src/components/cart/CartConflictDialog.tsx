'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/stores'
import { getActiveCartContext, resolveCartMenuUrl } from '@/lib/active-cart'

export function CartConflictDialog() {
  const t = useTranslations('cart')
  const router = useRouter()
  const conflictOpen = useCartStore((s) => s.conflictOpen)
  const items = useCartStore((s) => s.items)
  const ownershipState = useCartStore((s) => s.ownership)
  const dismissConflict = useCartStore((s) => s.dismissConflict)
  const setOpen = useCartStore((s) => s.setOpen)

  const ownership = getActiveCartContext(items, ownershipState)
  const tenantLabel = ownership?.tenantName || ownership?.tenantSlug || '—'
  const branchLabel = ownership?.branchName || ownership?.branchSlug || '—'

  const viewCart = () => {
    dismissConflict()
    setOpen(true)
  }

  const goToMenu = () => {
    dismissConflict()
    router.push(resolveCartMenuUrl(ownership))
  }

  return (
    <Modal
      open={conflictOpen}
      onClose={dismissConflict}
      title={t('activeOrderTitle')}
      size="sm"
    >
      <p className="text-sm font-medium text-[var(--fg)] mb-2">
        {t('ownedBy', { tenant: tenantLabel, branch: branchLabel })}
      </p>
      <p className="text-sm text-[var(--fg-muted)] mb-6">{t('activeOrderBody')}</p>
      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={viewCart}>
          {t('viewCurrentCart')}
        </Button>
        <Button className="w-full" variant="outline" onClick={goToMenu}>
          {t('goToCurrentMenu')}
        </Button>
      </div>
    </Modal>
  )
}
