'use client'

import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useTranslations('console')

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 mb-6">{description}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {cancelLabel ?? t('cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
            destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {pending ? t('savingEllipsis') : confirmLabel ?? t('confirmLabel')}
        </button>
      </div>
    </Modal>
  )
}
