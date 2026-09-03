'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, Shield } from 'lucide-react'
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
import type { StaffMember } from '@/types/staff'

export default function StaffManagementPage() {
  return (
    <ErrorBoundary feature="Staff Management">
      <PermissionGuard permission="staff.view"fallback={<AccessDenied />}>
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
  // (`selectedBranch`/` branchState`) is the only legitimate source here.
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{t('staffManagementTitle')}</h1>
            {branchState === 'loading' && (
              <span className="text-xs text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</span>
            )}
            {branchState === 'error' && (
              <span className="text-xs text-[var(--danger-text)]">{t('failedToLoadBranches')}</span>
            )}
            {(branchState === 'ready' || branchState === 'empty') && (
              <BranchContextIndicator branchId={selectedBranch?.id} branchName={selectedBranch?.name} />
            )}
          </div>
          <p className="text-sm text-[var(--fg-muted)]">{t('staffAccessManagementHint')}</p>
        </div>
        <PermissionGuard permission="staff.manage">
          <button
            className="px-4 py-2 bg-[var(--info)] text-[var(--info-fg)] rounded-lg text-sm font-medium"
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
          {activeStaff.length === 0 && <p className="text-sm text-[var(--fg-muted)]">{t('noActiveStaffPeriod')}</p>}
          {activeStaff.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              assignments={assignmentsByUser.get(member.userId) ?? []}
              actions={
                <PermissionGuard permission="staff.manage">
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      className="text-xs text-[var(--warning-text)] hover:underline"
                      onClick={() => suspendStaff.mutate(member.id)}
                    >
                      {t('suspendLabel')}
                    </button>
                    <button
                      className="text-xs text-[var(--danger-text)] hover:underline"
                      onClick={() => removeStaff.mutate(member.id)}
                    >
                      {t('removeLabel')}
                    </button>
                    {ownerMember && member.id !== ownerMember.id && canTransferOwnership && (
                      <button
                        className="text-xs text-[var(--chart-5)] hover:underline"
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
              }
            />
          ))}
        </div>
      </section>

      {/* Pending Invitations */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{t('pendingInvitationsLabel')}</h2>
        <div className="space-y-2">
          {pendingInvites.length === 0 && (
            <p className="text-sm text-[var(--fg-muted)]">{t('noPendingInvitationsPeriod')}</p>
          )}
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {t('expiresDateLabel', { date: new Date(invite.expiresAt).toLocaleDateString() })}
                </p>
              </div>
              <PermissionGuard permission="staff.manage">
                <div className="flex gap-2">
                  <button
                    className="text-xs text-[var(--info-text)] hover:underline"
                    onClick={() => resendInvite.mutate(invite.id)}
                  >
                    {t('resendLabel')}
                  </button>
                  <button
                    className="text-xs text-[var(--danger-text)] hover:underline"
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
              <StaffRow
                key={member.id}
                member={member}
                assignments={assignmentsByUser.get(member.userId) ?? []}
                dimmed
                actions={
                  <PermissionGuard permission="staff.manage">
                    <button
                      className="text-xs text-[var(--success-text)] hover:underline"
                      onClick={() => activateStaff.mutate(member.id)}
                    >
                      {t('reactivateLabel')}
                    </button>
                  </PermissionGuard>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Canonical staff access management destination: /console/permissions/{userId} */
function ManagePermissionsLink({ userId }: { userId: string }) {
  const t = useTranslations('console')
  return (
    <Link
      href={`/console/permissions/${userId}`}
      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--info-hover)]"
    >
      <Shield className="h-3.5 w-3.5"/>
      {t('managePermissionsLabel')}
      <ChevronRight className="h-3.5 w-3.5"/>
    </Link>
  )
}

function StaffRow({
  member,
  assignments,
  actions,
  dimmed,
}: {
  member: StaffMember
  assignments: import('@/types/rbac-api').RbacAssignment[]
  actions?: ReactNode
  dimmed?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 flex-wrap ${
        dimmed ? 'opacity-70' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium">
          {member.firstName} {member.lastName}
        </p>
        <p className="text-sm text-[var(--fg-muted)]">{member.email}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          <StaffRoleBadges assignments={assignments} />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <ManagePermissionsLink userId={member.userId} />
        {actions}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-[var(--fg-muted)]">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
