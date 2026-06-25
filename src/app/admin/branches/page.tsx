'use client'

import { useTenantStore } from '@/stores'
import { useAdminBranches } from '@/hooks'
import { branchManagementService } from '@/services/branch.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Link from 'next/link'

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function BranchList({ tenantId }: { tenantId: string }) {
  const { data: branches = [], isLoading, error } = useAdminBranches(tenantId)

  if (isLoading) return <p className="text-gray-500">Loading branches…</p>
  if (error) return <p className="text-red-500">Failed to load branches.</p>

  const analytics = branchManagementService.computeAnalytics(branches)
  const active = branches.filter((b) => b.status === 'active')
  const maintenance = branches.filter((b) => b.status === 'maintenance')
  const inactive = branches.filter((b) => b.status === 'inactive')

  return (
    <div className="space-y-6">
      {/* Analytics summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={analytics.totalBranches} />
        <StatCard label="Active" value={analytics.activeBranches} />
        <StatCard label="Maintenance" value={analytics.maintenanceBranches} />
        <StatCard label="Inactive" value={analytics.inactiveBranches} />
        <StatCard label="Staff Assigned" value={analytics.totalStaffAssigned} />
        <StatCard label="Physical" value={analytics.byType.physical} />
      </div>

      {/* Active branches */}
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Active Branches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">City</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.name}</td>
                    <td className="py-2 pr-4 capitalize">{b.type}</td>
                    <td className="py-2 pr-4">{b.location.city}</td>
                    <td className="py-2">
                      <Link href={`/admin/branches/${b.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Maintenance branches */}
      {maintenance.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-amber-600">Under Maintenance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">City</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.name}</td>
                    <td className="py-2 pr-4 capitalize">{b.type}</td>
                    <td className="py-2 pr-4">{b.location.city}</td>
                    <td className="py-2">
                      <Link href={`/admin/branches/${b.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Inactive branches */}
      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-400">Inactive Branches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">City</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactive.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.name}</td>
                    <td className="py-2 pr-4 capitalize">{b.type}</td>
                    <td className="py-2 pr-4">{b.location.city}</td>
                    <td className="py-2">
                      <Link href={`/admin/branches/${b.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {branches.length === 0 && (
        <p className="text-gray-500">No branches found for this tenant.</p>
      )}
    </div>
  )
}

function BranchManagementContent() {
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branch Management</h1>
        <PermissionGuard permission="branches.manage" fallback={<AccessDenied />}>
          <Link
            href="/admin/branches/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Branch
          </Link>
        </PermissionGuard>
      </div>

      <BranchList tenantId={tenantId} />
    </div>
  )
}

export default function BranchManagementPage() {
  return (
    <ErrorBoundary feature="Branch Management">
      <PermissionGuard permission="branches.view" fallback={<AccessDenied />}>
        <BranchManagementContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
