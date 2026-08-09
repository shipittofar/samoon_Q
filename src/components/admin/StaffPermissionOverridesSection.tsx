'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserPermissionControlTable } from '@/components/admin/UserPermissionControlTable'
import { PermissionOverrideModal } from '@/components/admin/PermissionOverrideModal'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import {
  useEffectivePermissions,
  usePermissionOverrides,
  useCreatePermissionOverride,
  useUpdatePermissionOverride,
  useDeletePermissionOverride,
  usePermission,
  usePermissionCatalog,
  useAssignments,
} from '@/hooks'
import type { PermissionOverride } from '@/types/rbac-api'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

export interface StaffPermissionOverridesSectionProps {
  tenantId: string
  membershipId: string
  userId: string
}

export function StaffPermissionOverridesSection({
  tenantId,
  membershipId,
  userId,
}: StaffPermissionOverridesSectionProps) {
  const t = useTranslations('console')
  const canManage = usePermission('tenant.manage')
  const { data: effectiveData, isLoading: effectiveLoading } = useEffectivePermissions({
    membership_id: membershipId,
    user_id: userId,
  })
  const { data: overrides = [] } = usePermissionOverrides(tenantId, {
    membership_id: membershipId,
  })
  const { data: assignmentPage } = useAssignments(tenantId, { user_id: userId })
  const { data: catalog = [] } = usePermissionCatalog()
  const createOverride = useCreatePermissionOverride(tenantId)
  const updateOverride = useUpdatePermissionOverride(tenantId)
  const deleteOverride = useDeletePermissionOverride(tenantId)

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PermissionOverride | null>(null)

  const activeAssignments = (assignmentPage?.results ?? []).filter((a) => a.status === 'active')
  const roleNames = activeAssignments.map((a) => a.role)

  function permissionIdForKey(key: string): string | undefined {
    const entry = catalog.find((p) => p.key === key)
    return entry?.id ?? entry?.key
  }

  function handleAllow(permissionKey: string) {
    const permission_id = permissionIdForKey(permissionKey)
    if (!permission_id) {
      toast.error(t('permissionRequiredError'))
      return
    }
    const existing = overrides.find((o) => o.permission === permissionKey)
    if (existing) {
      updateOverride.mutate(
        {
          overrideId: existing.id,
          payload: { effect: 'allow' },
          membershipId,
          userId,
        },
        {
          onSuccess: () => toast.success(t('overrideUpdatedSuccessfully')),
          onError: (err) => toast.error(getApiErrorMessage(err, t('failedToSaveOverride'))),
        },
      )
    } else {
      createOverride.mutate(
        {
          membership_id: membershipId,
          user_id: userId,
          permission_id,
          effect: 'allow',
        },
        {
          onSuccess: () => toast.success(t('overrideCreatedSuccessfully')),
          onError: (err) => toast.error(getApiErrorMessage(err, t('failedToSaveOverride'))),
        },
      )
    }
  }

  function handleDeny(permissionKey: string) {
    const permission_id = permissionIdForKey(permissionKey)
    if (!permission_id) {
      toast.error(t('permissionRequiredError'))
      return
    }
    const existing = overrides.find((o) => o.permission === permissionKey)
    if (existing) {
      updateOverride.mutate(
        {
          overrideId: existing.id,
          payload: { effect: 'deny' },
          membershipId,
          userId,
        },
        {
          onSuccess: () => toast.success(t('overrideUpdatedSuccessfully')),
          onError: (err) => toast.error(getApiErrorMessage(err, t('failedToSaveOverride'))),
        },
      )
    } else {
      createOverride.mutate(
        {
          membership_id: membershipId,
          user_id: userId,
          permission_id,
          effect: 'deny',
        },
        {
          onSuccess: () => toast.success(t('overrideCreatedSuccessfully')),
          onError: (err) => toast.error(getApiErrorMessage(err, t('failedToSaveOverride'))),
        },
      )
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteOverride.mutate(
      { overrideId: deleteTarget.id, membershipId, userId },
      {
        onSuccess: () => {
          toast.success(t('overrideDeletedSuccessfully'))
          setDeleteTarget(null)
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToDeleteOverride'))),
      },
    )
  }

  const pending =
    createOverride.isPending || updateOverride.isPending || deleteOverride.isPending

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-lg font-semibold">{t('userPermissionOverridesTitle')}</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            {t('addPermissionOverrideLabel')}
          </button>
        )}
      </div>

      <UserPermissionControlTable
        data={effectiveData}
        loading={effectiveLoading}
        roleNames={roleNames}
        overrides={overrides}
        canManage={canManage}
        onAllow={canManage ? handleAllow : undefined}
        onDeny={canManage ? handleDeny : undefined}
        onRemoveOverride={canManage ? setDeleteTarget : undefined}
        pending={pending}
      />

      {canManage && (
        <>
          <PermissionOverrideModal
            tenantId={tenantId}
            open={modalOpen}
            mode="create"
            membershipId={membershipId}
            userId={userId}
            override={null}
            onClose={() => setModalOpen(false)}
            onSubmit={async (payload) => {
              await createOverride.mutateAsync({
                membership_id: membershipId,
                user_id: userId,
                ...payload,
              })
              toast.success(t('overrideCreatedSuccessfully'))
            }}
            pending={createOverride.isPending}
          />

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            title={t('deleteOverrideTitle')}
            description={t('deleteOverrideConfirm')}
            confirmLabel={t('deleteLabel')}
            destructive
            pending={deleteOverride.isPending}
            onConfirm={handleDeleteConfirm}
          />
        </>
      )}
    </section>
  )
}
