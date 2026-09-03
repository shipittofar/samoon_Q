'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { AssignmentCard } from '@/components/admin/AssignmentCard'
import {
  AssignmentFormFields,
  emptyAssignmentForm,
  requiresAssignmentLocations,
  type AssignmentFormState,
} from '@/components/admin/AssignmentFormFields'
import {
  useAssignments,
  useCreateAssignment,
  useUpdateAssignment,
  useRevokeAssignment,
} from '@/hooks'
import type { StaffMember } from '@/types/staff'
import type { RbacAssignment } from '@/types/rbac-api'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

export interface StaffEditAssignmentModalProps {
  member: StaffMember
  open: boolean
  onClose: () => void
  /** When set, modal opens in edit mode for this assignment. */
  initialEditAssignment?: RbacAssignment | null
  /** Hide assignment list inside modal when assignments are shown on the parent page. */
  showAssignmentList?: boolean
}

type FormMode = 'create' | 'edit'

function assignmentToForm(a: RbacAssignment): AssignmentFormState {
  return {
    roleId: a.roleId ?? '',
    locationIds: a.locations.map((l) => l.id),
    allLocations: a.allLocations,
    mode: a.mode,
    validFrom: a.validFrom ?? '',
    validUntil: a.validUntil ?? '',
  }
}

export function StaffEditAssignmentModal({
  member,
  open,
  onClose,
  initialEditAssignment = null,
  showAssignmentList = true,
}: StaffEditAssignmentModalProps) {
  const t = useTranslations('console')
  const tenantId = member.tenantId
  const assignmentParams = useMemo(() => ({ user_id: member.userId }), [member.userId])

  const { data: assignmentPage, isLoading } = useAssignments(tenantId, assignmentParams)
  const createAssignment = useCreateAssignment(tenantId)
  const updateAssignment = useUpdateAssignment(tenantId)
  const revokeAssignment = useRevokeAssignment(tenantId)

  const assignments = assignmentPage?.results ?? []

  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AssignmentFormState>(emptyAssignmentForm())
  const [errors, setErrors] = useState<{ role?: string; locations?: string }>({})

  useEffect(() => {
    if (open) {
      if (initialEditAssignment) {
        setFormMode('edit')
        setEditingId(initialEditAssignment.assignmentId)
        setForm(assignmentToForm(initialEditAssignment))
      } else {
        setFormMode('create')
        setEditingId(null)
        setForm(emptyAssignmentForm())
      }
      setErrors({})
    }
  }, [open, member.id, initialEditAssignment])

  function membershipRef(): string | undefined {
    return member.membershipId ?? member.id
  }

  function validate(): boolean {
    const next: typeof errors = {}
    if (formMode === 'create' && !form.roleId) next.role = t('roleRequiredError')
    if (requiresAssignmentLocations(form.allLocations, form.locationIds)) {
      next.locations = t('branchRequiredForRoleError')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const membership_id = membershipRef()
    createAssignment.mutate(
      {
        membership_id,
        user_id: member.userId,
        role_id: form.roleId,
        location_ids: form.allLocations ? [] : form.locationIds,
        all_locations: form.allLocations,
        mode: form.mode,
        valid_from: form.validFrom || null,
        valid_until: form.validUntil || null,
      },
      {
        onSuccess: () => {
          toast.success(t('assignmentCreatedSuccessfully'))
          setForm(emptyAssignmentForm())
          setFormMode('create')
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToCreateAssignment'))),
      },
    )
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !validate()) return
    updateAssignment.mutate(
      {
        assignmentId: editingId,
        userId: member.userId,
        payload: {
          location_ids: form.allLocations ? [] : form.locationIds,
          all_locations: form.allLocations,
          mode: form.mode,
          valid_from: form.validFrom || null,
          valid_until: form.validUntil || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('staffAssignmentUpdatedSuccessfully'))
          setEditingId(null)
          setFormMode('create')
          setForm(emptyAssignmentForm())
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToUpdateStaffAssignmentRetry'))),
      },
    )
  }

  function startEdit(assignment: RbacAssignment) {
    setFormMode('edit')
    setEditingId(assignment.assignmentId)
    setForm(assignmentToForm(assignment))
    setErrors({})
  }

  function handleRevoke(assignmentId: string) {
    revokeAssignment.mutate(
      { assignmentId, userId: member.userId },
      {
        onSuccess: () => toast.success(t('assignmentRevokedSuccessfully')),
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToRevokeAssignment'))),
      },
    )
  }

  const pending =
    createAssignment.isPending || updateAssignment.isPending || revokeAssignment.isPending

  const modalTitle =
    formMode === 'create' ? t('addRoleLabel') : t('editAssignmentLabel')

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-6">
        {showAssignmentList && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--fg)]">{t('locationAssignmentsLabel')}</h3>
          {isLoading ? (
            <p className="text-sm text-[var(--fg-muted)]">{t('loadingEllipsis')}</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">{t('noAssignmentsYet')}</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <AssignmentCard
                  key={a.assignmentId}
                  assignment={a}
                  onEdit={() => startEdit(a)}
                  onRevoke={() => handleRevoke(a.assignmentId)}
                  revoking={revokeAssignment.isPending}
                />
              ))}
            </div>
          )}
        </section>
        )}

        <form
          onSubmit={formMode === 'create' ? handleCreate : handleUpdate}
          className={`space-y-4 ${showAssignmentList ? 'border-t pt-4' : ''}`}
        >
          <h3 className="text-sm font-semibold text-[var(--fg)]">
            {formMode === 'create' ? t('addAssignmentLabel') : t('editAssignmentLabel')}
          </h3>

          <AssignmentFormFields
            tenantId={tenantId}
            form={form}
            onChange={setForm}
            showRoleSelect={formMode === 'create'}
            roleError={errors.role}
            locationsError={errors.locations}
          />

          <div className="flex justify-end gap-3">
            {formMode === 'edit' && (
              <button
                type="button"
                onClick={() => {
                  setFormMode('create')
                  setEditingId(null)
                  setForm(emptyAssignmentForm())
                }}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {t('cancelEdit')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--card-hover)]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[var(--info)] px-4 py-2 text-sm font-medium text-[var(--info-fg)] disabled:opacity-50"
            >
              {pending
                ? t('savingEllipsis')
                : formMode === 'create'
                  ? t('createAssignmentLabel')
                  : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
