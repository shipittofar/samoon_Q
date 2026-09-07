'use client'

import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { AuthSessionPanel } from '@/components/auth/AuthSessionPanel'

export interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const t = useTranslations('auth')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('welcome')}
      description={t('enterPhoneToContinue')}
      size="md"
      zIndex={60}
      className="max-sm:!max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none"
      ariaTitle={t('welcome')}
    >
      {open ? (
        <AuthSessionPanel
          key="checkout-auth-session"
          onAuthenticated={onSuccess}
        />
      ) : null}
    </Modal>
  )
}
