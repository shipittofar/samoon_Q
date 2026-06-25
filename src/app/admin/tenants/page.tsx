'use client'

import Link from 'next/link'
import { useTenants, useActivateTenant, useSuspendTenant, useArchiveTenant } from '@/hooks'
import type { Tenant } from '@/types'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  trial: 'text-blue-700 bg-blue-50',
  suspended: 'text-amber-700 bg-amber-50',
  churned: 'text-gray-500 bg-gray-100',
  archived: 'text-red-700 bg-red-50',
}

function TenantAnalyticsSummary({ tenants }: { tenants: Tenant[] }) {
  const total = tenants.length
  const active = tenants.filter((t) => t.status === 'active').length
  const suspended = tenants.filter((t) => t.status === 'suspended').length
  const byType: Record<string, number> = {}
  tenants.forEach((t) => {
    const bt = t.businessTypes?.[0] ?? 'unknown'
    byType[bt] = (byType[bt] ?? 0) + 1
  })

  return (
    <section aria-label="Tenant Analytics" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="border rounded-lg p-4 text-center" aria-label="Total tenants">
        <p className="text-2xl font-bold">{total}</p>
        <p className="text-xs text-gray-500 mt-1">Total Tenants</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label="Active tenants">
        <p className="text-2xl font-bold text-green-700">{active}</p>
        <p className="text-xs text-gray-500 mt-1">Active</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label="Suspended tenants">
        <p className="text-2xl font-bold text-amber-700">{suspended}</p>
        <p className="text-xs text-gray-500 mt-1">Suspended</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label="Business type distribution">
        <p className="text-xs font-semibold text-gray-700 mb-1">By Type</p>
        {Object.entries(byType).map(([bt, count]) => (
          <p key={bt} className="text-xs text-gray-600">
            {bt.replace(/_/g, ' ')}: {count}
          </p>
        ))}
      </div>
    </section>
  )
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const activate = useActivateTenant()
  const suspend = useSuspendTenant()
  const archive = useArchiveTenant()

  const statusClass = STATUS_COLORS[tenant.status] ?? 'text-gray-500 bg-gray-100'

  return (
    <tr>
      <td className="px-4 py-3">
        <Link
          href={`/admin/tenants/${tenant.slug}`}
          className="font-medium text-accent hover:underline"
        >
          {tenant.name}
        </Link>
        <p className="text-xs text-gray-500 font-mono">{tenant.slug}</p>
      </td>
      <td className="px-4 py-3 text-sm">
        {tenant.businessTypes?.[0]?.replace(/_/g, ' ') ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
          {tenant.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(tenant.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm space-x-2">
        {tenant.status !== 'active' && tenant.status !== 'archived' && (
          <button
            type="button"
            onClick={() => activate.mutate(tenant.slug)}
            disabled={activate.isPending}
            className="text-green-700 hover:underline disabled:opacity-40"
            aria-label={`Activate ${tenant.name}`}
          >
            Activate
          </button>
        )}
        {tenant.status === 'active' && (
          <button
            type="button"
            onClick={() => suspend.mutate(tenant.slug)}
            disabled={suspend.isPending}
            className="text-amber-700 hover:underline disabled:opacity-40"
            aria-label={`Suspend ${tenant.name}`}
          >
            Suspend
          </button>
        )}
        {tenant.status !== 'archived' && (
          <button
            type="button"
            onClick={() => archive.mutate(tenant.slug)}
            disabled={archive.isPending}
            className="text-red-600 hover:underline disabled:opacity-40"
            aria-label={`Archive ${tenant.name}`}
          >
            Archive
          </button>
        )}
      </td>
    </tr>
  )
}

export default function AdminTenantsPage() {
  const { data: tenants = [], isLoading } = useTenants()

  return (
    <ErrorBoundary feature="Tenant Management">
    <PermissionGuard permission="tenant.view" fallback={<AccessDenied />}>
    <main aria-label="Tenant Management" className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and provision tenants</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover"
          aria-label="Create new tenant"
        >
          + New Tenant
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading tenants…</p>
      ) : (
        <>
          <TenantAnalyticsSummary tenants={tenants} />

          <section aria-label="Tenant List">
            <table className="w-full border rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name / Slug</th>
                  <th className="px-4 py-3 font-medium">Business Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <TenantRow key={t.id} tenant={t} />
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && (
              <p className="text-center text-gray-400 py-8">No tenants found.</p>
            )}
          </section>
        </>
      )}
    </main>
  
    </PermissionGuard>
    </ErrorBoundary>

  )
}
