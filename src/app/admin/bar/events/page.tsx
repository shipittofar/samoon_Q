'use client'

import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'

export default function BarEventsPage() {
  return (
    <ErrorBoundary feature="Bar Event Management">
      <PermissionGuard permission="operations.view" fallback={<AccessDenied />}>
        <main className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Event Management</h1>
            <PreviewButton href="/events" label="Preview Events" size="sm" />
          </div>
          <p className="text-gray-500 text-sm">Manage live events, ticketing, and schedules for bar tenants.</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            Coming soon
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
