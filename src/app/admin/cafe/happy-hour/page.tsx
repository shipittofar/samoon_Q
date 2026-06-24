'use client'

import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function CafeHappyHourPage() {
  return (
    <ErrorBoundary feature="Cafe Happy Hour Settings">
      <PermissionGuard permission="promotions.view">
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Happy Hour Settings</h1>
          <p className="text-gray-500 text-sm">Configure happy hour schedules and discounts for cafe tenants.</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            Coming soon
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
