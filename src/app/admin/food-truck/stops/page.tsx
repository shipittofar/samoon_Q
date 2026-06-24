'use client'

import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function FoodTruckStopsPage() {
  return (
    <ErrorBoundary feature="Food Truck Stop Management">
      <PermissionGuard permission="operations.view">
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Stop Management</h1>
          <p className="text-gray-500 text-sm">Configure scheduled stops and arrival times for food truck tenants.</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            Coming soon
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
