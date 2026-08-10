'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { usePermissionCatalog } from '@/hooks'
import type { PermissionOverride, PermissionOverrideEffect } from '@/types/rbac-api'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

export interface PermissionOverrideModalProps {
  tenantId: string
  open: boolean
  mode: 'create' | 'edit'
  membershipId?: string
  userId?: string
  override?: PermissionOverride | null
  onClose: () => void
  onSubmit: (payload: {
    permission_id: string
    effect: PermissionOverrideEffect
  }) => Promise<void>
  pending?: boolean
}

export function PermissionOverrideModal({
  open,
  mode,
  membershipId,
  userId,
  override,
  onClose,
  onSubmit,
  pending = false,
}: PermissionOverrideModalProps) {
  const t = useTranslations('console')
  const { data: catalog = [], isLoading } = usePermissionCatalog()
  const selectableCatalog = catalog.filter((p) => typeof p.id === 'string' && p.id.length > 0)
  const [permissionId, setPermissionId] = useState('')
  const [effect, setEffect] = useState<PermissionOverrideEffect>('allow')
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (open) {
      setPermissionId(override?.permissionId ?? '')
      setEffect(override?.effect ?? 'allow')
      setError(undefined)
    }
  }, [open, override])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!permissionId) {
      setError(t('permissionRequiredError'))
      return
    }
    try {
      await onSubmit({ permission_id: permissionId, effect })
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('failedToSaveOverride')))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('addOverrideLabel') : t('editOverrideLabel')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="override-permission" className="block text-sm font-medium mb-1">
            {t('permissionColumnLabel')}
          </label>
          {isLoading ? (
            <p className="text-sm text-gray-500">{t('loadingEllipsis')}</p>
          ) : (
            <select
              id="override-permission"
              value={permissionId}
              onChange={(e) => setPermissionId(e.target.value)}
              disabled={mode === 'edit'}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">{t('selectPermissionPlaceholder')}</option>
              {selectableCatalog.map((p) => (
                <option key={p.id!} value={p.id!}>
                  {p.key}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('effectColumnLabel')}</label>
          <select
            value={effect}
            onChange={(e) => setEffect(e.target.value as PermissionOverrideEffect)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="allow">{t('allowEffectLabel')}</option>
            <option value="deny">{t('denyEffectLabel')}</option>
          </select>
        </div>

        {(membershipId || userId) && (
          <p className="text-xs text-gray-500">
            {membershipId ? t('membershipIdLabel', { id: membershipId }) : t('userIdLabel', { id: userId })}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? t('savingEllipsis') : t('saveChanges')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
