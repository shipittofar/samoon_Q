'use client'

import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function BarEventsPage() {
  return (
    <ErrorBoundary feature="Bar Event Management">
      <PermissionGuard permission="operations.view">
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Event Management</h1>
          <p className="text-gray-500 text-sm">Manage live events, ticketing, and schedules for bar tenants.</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            Coming soon
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
