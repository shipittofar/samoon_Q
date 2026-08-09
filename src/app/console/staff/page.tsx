'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BranchContextIndicator } from '@/components/admin/RealtimeDashboardWidgets'
import {
  useStaff,
  useInvites,
  useAssignments,
  useSuspendStaff,
  useActivateStaff,
  useRemoveStaff,
  useCancelInvite,
  useResendInvite,
  useTransferOwnership,
  useSelectedBranch,
  useBranchState,
  usePermission,
  useConsoleTenantId,
} from '@/hooks'
import { staffService } from '@/services/staff.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { StaffInviteModal } from '@/components/admin/StaffInviteModal'
import { StaffRoleBadges } from '@/components/admin/StaffRoleBadges'
import { groupAssignmentsByUserId, userHasLocationAccess } from '@/lib/assignments'

export default function StaffManagementPage() {
  return (
    <ErrorBoundary feature="Staff Management">
      <PermissionGuard permission="staff.view" fallback={<AccessDenied />}>
        <StaffManagementContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}

function StaffManagementContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  // Phase 3.2 — this page previously read `activeBranch` (the unrelated,
  // unvalidated customer-storefront branch, still persisted in full) for
  // its branch filter. The admin branch-resolution state machine
  // (`selectedBranch`/`branchState`) is the only legitimate source here.
  // Staff management itself is tenant-wide and does not require a branch
  // to function, so branchState !== 'ready' does not block the page —
  // it only disables the optional per-branch filter, with that fact
  // shown explicitly rather than silently falling through.
  const selectedBranch = useSelectedBranch()
  const branchState = useBranchState()

  const { data: staff = [], isLoading: staffLoading } = useStaff(tenantId)
  const { data: invites = [], isLoading: invitesLoading } = useInvites(tenantId)
  const { data: assignmentPage } = useAssignments(tenantId, { page_size: 500 })
  const assignmentsByUser = groupAssignmentsByUserId(assignmentPage?.results ?? [])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const suspendStaff = useSuspendStaff()
  const activateStaff = useActivateStaff()
  const removeStaff = useRemoveStaff()
  const cancelInvite = useCancelInvite(tenantId)
  const resendInvite = useResendInvite(tenantId)
  const transferOwnership = useTransferOwnership(tenantId)
  const canTransferOwnership = usePermission('tenant.manage')
  const ownerMember = staff.find((m) => {
    if (m.status !== 'active') return false
    const userAssignments = assignmentsByUser.get(m.userId) ?? []
    return userAssignments.some((a) => a.status === 'active' && a.role === 'owner')
  })

  const filteredStaff = branchState === 'ready' && selectedBranch
    ? staff.filter((m) => userHasLocationAccess(assignmentsByUser.get(m.userId) ?? [], selectedBranch.id))
    : staff

  const analytics = staffService.computeAnalytics(filteredStaff, invites, assignmentPage?.results)

  const activeStaff = filteredStaff.filter((s) => s.status === 'active')
  const suspendedStaff = filteredStaff.filter((s) => s.status === 'suspended')
  const pendingInvites = invites.filter((i) => i.status === 'pending')

  if (staffLoading || invitesLoading) {
    return <div className="p-6">{t('loadingStaffEllipsis')}</div>
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('staffManagementTitle')}</h1>
          {branchState === 'loading' && (
            <span className="text-xs text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</span>
          )}
          {branchState === 'error' && (
            <span className="text-xs text-red-600 dark:text-red-400">{t('failedToLoadBranches')}</span>
          )}
          {(branchState === 'ready' || branchState === 'empty') && (
            <BranchContextIndicator branchId={selectedBranch?.id} branchName={selectedBranch?.name} />
          )}
        </div>
        <PermissionGuard permission="staff.manage">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            onClick={() => setInviteModalOpen(true)}
          >
            {t('inviteStaffLabel')}
          </button>
        </PermissionGuard>
      </div>

      <StaffInviteModal
        tenantId={tenantId}
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t('totalStaffLabel')} value={analytics.totalStaff} />
        <StatCard label={t('statusActive')} value={analytics.activeStaff} />
        <StatCard label={t('pendingInvitesLabel')} value={analytics.pendingInvites} />
        <StatCard label={t('statusSuspended')} value={analytics.suspendedStaff} />
      </div>

      {/* Active Staff */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{t('activeStaffLabel')}</h2>
        <div className="space-y-2">
          {activeStaff.length === 0 && <p className="text-sm text-gray-500">{t('noActiveStaffPeriod')}</p>}
          {activeStaff.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-sm text-gray-500">{member.email}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <StaffRoleBadges assignments={assignmentsByUser.get(member.userId) ?? []} />
                </div>
              </div>
              <PermissionGuard permission="staff.manage">
                <div className="flex gap-2">
                  <button
                    className="text-xs text-yellow-600 hover:underline"
                    onClick={() => suspendStaff.mutate(member.id)}
                  >
                    {t('suspendLabel')}
                  </button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => removeStaff.mutate(member.id)}
                  >
                    {t('removeLabel')}
                  </button>
                  {ownerMember && member.id !== ownerMember.id && canTransferOwnership && (
                    <button
                      className="text-xs text-purple-600 hover:underline"
                      onClick={() =>
                        transferOwnership.mutate({
                          currentOwnerId: ownerMember.id,
                          payload: { targetMemberId: member.id },
                        })
                      }
                    >
                      {t('transferOwnershipLabel')}
                    </button>
                  )}
                </div>
              </PermissionGuard>
            </div>
          ))}
        </div>
      </section>

      {/* Pending Invitations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{t('pendingInvitationsLabel')}</h2>
        <div className="space-y-2">
          {pendingInvites.length === 0 && (
            <p className="text-sm text-gray-500">{t('noPendingInvitationsPeriod')}</p>
          )}
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-sm text-gray-500">
                  {t('expiresDateLabel', { date: new Date(invite.expiresAt).toLocaleDateString() })}
                </p>
              </div>
              <PermissionGuard permission="staff.manage">
                <div className="flex gap-2">
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => resendInvite.mutate(invite.id)}
                  >
                    {t('resendLabel')}
                  </button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => cancelInvite.mutate(invite.id)}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </PermissionGuard>
            </div>
          ))}
        </div>
      </section>

      {/* Suspended Staff */}
      {suspendedStaff.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">{t('suspendedStaffLabel')}</h2>
          <div className="space-y-2">
            {suspendedStaff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-3 opacity-70"
              >
                <div>
                  <p className="font-medium">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                <PermissionGuard permission="staff.manage">
                  <button
                    className="text-xs text-green-600 hover:underline"
                    onClick={() => activateStaff.mutate(member.id)}
                  >
                    {t('reactivateLabel')}
                  </button>
                </PermissionGuard>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
