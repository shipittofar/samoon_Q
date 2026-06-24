'use client'

import { use } from 'react'
import { useAdminBranch, useAdminBranchMetrics, useActivateBranch, useDeactivateBranch, useMaintenanceBranch } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { BranchStatus } from '@/types/branch'

const STATUS_COLORS: Record<BranchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-amber-100 text-amber-800',
}

function BranchDetailContent({ id }: { id: string }) {
  const { data: branch, isLoading, error } = useAdminBranch(id)
  const { data: metrics } = useAdminBranchMetrics(id)
  const activate = useActivateBranch()
  const deactivate = useDeactivateBranch()
  const maintenance = useMaintenanceBranch()

  if (isLoading) return <p className="p-6 text-gray-500">Loading branch…</p>
  if (error || !branch) return <p className="p-6 text-red-500">Branch not found.</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{branch.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{branch.slug}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_COLORS[branch.status]}`}>
          {branch.status}
        </span>
      </div>

      {/* Location */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">Location</h2>
        <p>{branch.location.address}</p>
        <p>{branch.location.city}, {branch.location.country}</p>
        {branch.location.postalCode && <p>Postal: {branch.location.postalCode}</p>}
      </section>

      {/* Contact */}
      {(branch.contact.phone || branch.contact.email || branch.contact.website) && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Contact</h2>
          {branch.contact.phone && <p>Phone: {branch.contact.phone}</p>}
          {branch.contact.email && <p>Email: {branch.contact.email}</p>}
          {branch.contact.website && <p>Website: {branch.contact.website}</p>}
        </section>
      )}

      {/* Settings */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">Settings</h2>
        <ul className="space-y-1 text-sm">
          <li>Delivery: {branch.settings.deliveryEnabled ? 'Enabled' : 'Disabled'}</li>
          <li>Pickup: {branch.settings.pickupEnabled ? 'Enabled' : 'Disabled'}</li>
          <li>Table Ordering: {branch.settings.tableOrderingEnabled ? 'Enabled' : 'Disabled'}</li>
          <li>Reservations: {branch.settings.reservationsEnabled ? 'Enabled' : 'Disabled'}</li>
          {branch.settings.maxCapacity !== undefined && (
            <li>Max Capacity: {branch.settings.maxCapacity}</li>
          )}
        </ul>
      </section>

      {/* Business Hours */}
      {branch.businessHours.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Business Hours</h2>
          <ul className="space-y-1 text-sm">
            {branch.businessHours.map((h) => (
              <li key={h.day} className="flex gap-4">
                <span className="w-24 font-medium">{h.day}</span>
                <span>{h.isClosed ? 'Closed' : `${h.open} – ${h.close}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metrics */}
      {metrics && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Metrics ({metrics.period})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-gray-500">Total Orders</p><p className="font-semibold">{metrics.totalOrders}</p></div>
            <div><p className="text-xs text-gray-500">Revenue</p><p className="font-semibold">${metrics.totalRevenue.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Customers</p><p className="font-semibold">{metrics.totalCustomers}</p></div>
            <div><p className="text-xs text-gray-500">Reservations</p><p className="font-semibold">{metrics.totalReservations}</p></div>
            <div><p className="text-xs text-gray-500">Staff</p><p className="font-semibold">{metrics.staffCount}</p></div>
            <div><p className="text-xs text-gray-500">Avg Order</p><p className="font-semibold">${metrics.averageOrderValue.toFixed(2)}</p></div>
          </div>
        </section>
      )}

      {/* Status Actions */}
      <PermissionGuard permission="branches.manage">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Status Actions</h2>
          <div className="flex flex-wrap gap-2">
            {branch.status !== 'active' && (
              <button
                onClick={() => activate.mutate(id)}
                disabled={activate.isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {branch.status !== 'maintenance' && (
              <button
                onClick={() => maintenance.mutate(id)}
                disabled={maintenance.isPending}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Set Maintenance
              </button>
            )}
            {branch.status !== 'inactive' && (
              <button
                onClick={() => deactivate.mutate(id)}
                disabled={deactivate.isPending}
                className="rounded-md bg-gray-500 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
          </div>
        </section>
      </PermissionGuard>
    </div>
  )
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Branch Detail">
      <PermissionGuard permission="branches.view">
        <BranchDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
