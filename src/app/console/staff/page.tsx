'use client'

import { useTranslations } from 'next-intl'
import { useTenantStore, useBranchStore } from '@/stores'
import { BranchContextIndicator } from '@/components/admin/RealtimeDashboardWidgets'
import {
  useStaff,
  useInvites,
  useInviteStaff,
  useSuspendStaff,
  useActivateStaff,
  useRemoveStaff,
  useCancelInvite,
  useResendInvite,
  useTransferOwnership,
} from '@/hooks'
import { staffService } from '@/services/staff.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

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
  const tenant = useTenantStore((s) => s.tenant)
  const tenantId = tenant?.id ?? ''
  const activeBranch = useBranchStore((s) => s.activeBranch)

  const { data: staff = [], isLoading: staffLoading } = useStaff(tenantId)
  const { data: invites = [], isLoading: invitesLoading } = useInvites(tenantId)
  const inviteStaff = useInviteStaff(tenantId)
  const suspendStaff = useSuspendStaff()
  const activateStaff = useActivateStaff()
  const removeStaff = useRemoveStaff()
  const cancelInvite = useCancelInvite(tenantId)
  const resendInvite = useResendInvite(tenantId)
  const transferOwnership = useTransferOwnership(tenantId)

  const filteredStaff = activeBranch
    ? staff.filter((m) => !m.branchIds || m.branchIds.includes(activeBranch.id))
    : staff

  const analytics = staffService.computeAnalytics(filteredStaff, invites)

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
          <BranchContextIndicator branchId={activeBranch?.id} branchName={activeBranch?.name} />
        </div>
        <PermissionGuard permission="staff.manage">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            onClick={() =>
              inviteStaff.mutate({ email: '', roles: ['waiter'] })
            }
          >
            {t('inviteStaffLabel')}
          </button>
        </PermissionGuard>
      </div>

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
                  {member.roles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700"
                    >
                      {r}
                    </span>
                  ))}
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
                  {!member.roles.includes('owner') && (
                    <button
                      className="text-xs text-purple-600 hover:underline"
                      onClick={() =>
                        transferOwnership.mutate({
                          currentOwnerId: member.id,
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
