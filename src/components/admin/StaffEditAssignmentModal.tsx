'use client'

/**
 * Console Staff — "Edit roles & branches" for an existing staff member.
 * Wired to the existing useUpdateStaffRoles() mutation (already
 * functioning, previously never called from any UI) — no new
 * mutation/service is introduced.
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { StaffRoleBranchFields, requiresBranchSelection } from '@/components/admin/StaffRoleBranchFields'
import { useUpdateStaffRoles } from '@/hooks'
import type { StaffMember } from '@/types/staff'
import type { Role } from '@/types/rbac'
import toast from 'react-hot-toast'

export interface StaffEditAssignmentModalProps {
  member: StaffMember
  open: boolean
  onClose: () => void
}

export function StaffEditAssignmentModal({ member, open, onClose }: StaffEditAssignmentModalProps) {
  const t = useTranslations('console')
  const qc = useQueryClient()
  const updateStaffRoles = useUpdateStaffRoles()

  const [roles, setRoles] = useState<Role[]>(member.roles)
  const [branchIds, setBranchIds] = useState<string[]>(member.branchIds ?? [])
  const [errors, setErrors] = useState<{ roles?: string; branches?: string }>({})

  // Re-sync local state whenever a different member is opened (or the
  // modal re-opens after a prior edit), instead of carrying stale edits
  // across members.
  useEffect(() => {
    if (open) {
      setRoles(member.roles)
      setBranchIds(member.branchIds ?? [])
      setErrors({})
    }
  }, [open, member])

  function validate(): boolean {
    const next: typeof errors = {}
    if (roles.length === 0) next.roles = t('roleRequiredError')
    if (roles.length > 0 && requiresBranchSelection(roles) && branchIds.length === 0) {
      next.branches = t('branchRequiredForRoleError')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (updateStaffRoles.isPending) return
    if (!validate()) return

    updateStaffRoles.mutate(
      { id: member.id, payload: { roles, branchIds } },
      {
        onSuccess: () => {
          // useUpdateStaffRoles() already invalidates ['staff', tenantId]
          // and ['staff-member', id] — this call is a defense-in-depth
          // refresh so the detail page reflects the change immediately
          // even if a caller reuses this modal outside that hook's own
          // onSuccess timing.
          qc.invalidateQueries({ queryKey: ['staff-member', member.id] })
          toast.success(t('staffAssignmentUpdatedSuccessfully'))
          onClose()
        },
        onError: () => {
          toast.error(t('failedToUpdateStaffAssignmentRetry'))
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={t('editStaffAssignmentModalTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <StaffRoleBranchFields
          tenantId={member.tenantId}
          selectedRoles={roles}
          selectedBranchIds={branchIds}
          onChangeRoles={setRoles}
          onChangeBranchIds={setBranchIds}
          roleError={errors.roles}
          branchError={errors.branches}
        />

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
            disabled={updateStaffRoles.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateStaffRoles.isPending ? t('savingEllipsis') : t('saveChanges')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
