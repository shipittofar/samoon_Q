'use client'

import { use } from 'react'
import { useStaffMember, useAdminBranch, useAdminBranches } from '@/hooks'
import { getPermissionsForRole } from '@/services/permission.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import Link from 'next/link'

function BranchBadge({ branchId }: { branchId: string }) {
  const { data: branch } = useAdminBranch(branchId)
  return (
    <Link
      href={`/admin/branches/${branchId}`}
      className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 hover:underline"
    >
      {branch?.name ?? branchId}
    </Link>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function StaffDetailPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <PermissionGuard permission="staff.view" fallback={<p>Access denied.</p>}>
      <StaffDetailContent id={id} />
    </PermissionGuard>
  )
}

function BranchAccessMatrix({ tenantId, assignedBranchIds }: { tenantId: string; assignedBranchIds: string[] }) {
  const { data: allBranches = [] } = useAdminBranches(tenantId)
  const assigned = new Set(assignedBranchIds)
  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">Branch Access Matrix</h2>
      <ul className="space-y-1 text-sm">
        {allBranches.map((b) => (
          <li key={b.id} className="flex items-center gap-2">
            <span className={assigned.has(b.id) ? 'text-green-600' : 'text-gray-400'}>
              {assigned.has(b.id) ? '✓' : '✗'}
            </span>
            <Link href={`/admin/branches/${b.id}`} className="hover:underline">
              {b.name}
            </Link>
            <span className="text-xs text-gray-400">{b.location.city}</span>
          </li>
        ))}
        {allBranches.length === 0 && <li className="text-gray-500">No branches configured.</li>}
      </ul>
    </section>
  )
}

function StaffDetailContent({ id }: { id: string }) {
  const { data: member, isLoading } = useStaffMember(id)

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!member) return <div className="p-6">Staff member not found.</div>

  const derivedPermissions = getPermissionsForRole(member.roles)

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        {member.avatar && (
          <img
            src={member.avatar}
            alt={`${member.firstName} ${member.lastName}`}
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-gray-500">{member.email}</p>
        </div>
        <span
          className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
            member.status === 'active'
              ? 'bg-green-100 text-green-700'
              : member.status === 'suspended'
                ? 'bg-yellow-100 text-yellow-700'
                : member.status === 'removed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
          }`}
        >
          {member.status}
        </span>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Roles</h2>
        <div className="flex gap-2 flex-wrap">
          {member.roles.map((r) => (
            <span key={r} className="px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm">
              {r}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Derived Permissions</h2>
        <div className="flex gap-2 flex-wrap">
          {derivedPermissions.map((p) => (
            <span key={p} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-mono">
              {p}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Membership</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Tenant</dt>
          <dd>{member.tenantId}</dd>
          <dt className="text-gray-500">Invited</dt>
          <dd>{new Date(member.invitedAt).toLocaleDateString()}</dd>
          {member.activatedAt && (
            <>
              <dt className="text-gray-500">Activated</dt>
              <dd>{new Date(member.activatedAt).toLocaleDateString()}</dd>
            </>
          )}
          {member.lastSeenAt && (
            <>
              <dt className="text-gray-500">Last Seen</dt>
              <dd>{new Date(member.lastSeenAt).toLocaleDateString()}</dd>
            </>
          )}
        </dl>
      </section>

      {member.branchIds && member.branchIds.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Assigned Branches</h2>
          <div className="flex flex-wrap gap-2">
            {member.branchIds.map((bid) => (
              <BranchBadge key={bid} branchId={bid} />
            ))}
          </div>
        </section>
      )}

      <BranchAccessMatrix tenantId={member.tenantId} assignedBranchIds={member.branchIds ?? []} />
    </div>
  )
}
