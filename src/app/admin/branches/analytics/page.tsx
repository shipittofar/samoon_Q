'use client'

import { useTenantStore } from '@/stores'
import { useAdminBranches } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Link from 'next/link'

function BranchAnalyticsRow({ id, name, city, status }: { id: string; name: string; city: string; status: string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-medium">{name}</td>
      <td className="py-2 pr-4 text-gray-500">{city}</td>
      <td className="py-2 pr-4">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
          status === 'active' ? 'bg-green-100 text-green-800' :
          status === 'maintenance' ? 'bg-amber-100 text-amber-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </span>
      </td>
      <td className="py-2">
        <Link
          href={`/admin/branches/${id}/analytics`}
          className="text-sm text-blue-600 hover:underline"
        >
          View Analytics
        </Link>
      </td>
    </tr>
  )
}

function BranchAnalyticsOverviewContent() {
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { data: branches = [], isLoading } = useAdminBranches(tenantId)

  const active = branches.filter((b) => b.status === 'active')
  const maintenance = branches.filter((b) => b.status === 'maintenance')
  const inactive = branches.filter((b) => b.status === 'inactive')

  if (isLoading) return <p className="p-6 text-gray-500">Loading branches…</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branch Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Select a branch to view its analytics</p>
        </div>
        <Link href="/admin/branches" className="text-sm text-blue-600 hover:underline">
          ← Branch Management
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">{active.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Maintenance</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{maintenance.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="mt-1 text-2xl font-semibold text-gray-400">{inactive.length}</p>
        </div>
      </div>

      {/* Branch table */}
      {branches.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">All Branches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">City</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Analytics</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <BranchAnalyticsRow
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    city={b.location.city}
                    status={b.status}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {branches.length === 0 && (
        <p className="text-gray-500">No branches found.</p>
      )}
    </div>
  )
}

export default function BranchAnalyticsOverviewPage() {
  return (
    <ErrorBoundary feature="Branch Analytics">
      <PermissionGuard permission="branches.view">
        <BranchAnalyticsOverviewContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
