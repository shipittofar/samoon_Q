'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AssignmentCard } from '@/components/admin/AssignmentCard'
import { StaffEditAssignmentModal } from '@/components/admin/StaffEditAssignmentModal'
import {
  useAssignments,
  useRevokeAssignment,
  usePermission,
} from '@/hooks'
import type { StaffMember } from '@/types/staff'
import type { RbacAssignment } from '@/types/rbac-api'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

export interface StaffAssignedRolesSectionProps {
  member: StaffMember
}

export function StaffAssignedRolesSection({ member }: StaffAssignedRolesSectionProps) {
  const t = useTranslations('console')
  const tenantId = member.tenantId
  // Align with invite/staff pages: assignment CRUD is staff.manage, not
  // owner-only tenant.manage (transfer ownership / tenant lifecycle).
  const canManageAssignments = usePermission('staff.manage')

  const { data: assignmentPage, isLoading } = useAssignments(tenantId, { user_id: member.userId })
  const revokeAssignment = useRevokeAssignment(tenantId)

  const assignments = assignmentPage?.results ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RbacAssignment | null>(null)

  function openAddRole() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(assignment: RbacAssignment) {
    setEditTarget(assignment)
    setModalOpen(true)
  }

  function handleRevoke(assignmentId: string) {
    revokeAssignment.mutate(
      {
        assignmentId,
        userId: member.userId,
        membershipId: member.membershipId ?? member.id,
      },
      {
        onSuccess: () => toast.success(t('assignmentRevokedSuccessfully')),
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToRevokeAssignment'))),
      },
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('assignedRolesLabel')}</h2>
          {!canManageAssignments && (
            <p className="text-xs text-gray-500 mt-0.5">{t('assignmentViewOnlyHint')}</p>
          )}
        </div>
        {canManageAssignments && member.status !== 'removed' && (
          <button
            type="button"
            onClick={openAddRole}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t('addRoleLabel')}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('loadingEllipsis')}</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noAssignmentsYet')}</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.assignmentId}
              assignment={a}
              onEdit={canManageAssignments && a.status !== 'revoked' ? () => openEdit(a) : undefined}
              onRevoke={
                canManageAssignments && a.status !== 'revoked'
                  ? () => handleRevoke(a.assignmentId)
                  : undefined
              }
              revoking={revokeAssignment.isPending}
            />
          ))}
        </div>
      )}

      {canManageAssignments && (
        <StaffEditAssignmentModal
          member={member}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditTarget(null)
          }}
          initialEditAssignment={editTarget}
          showAssignmentList={false}
        />
      )}
    </section>
  )
}
