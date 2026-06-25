'use client'

import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function MobileCafeRoutesPage() {
  return (
    <ErrorBoundary feature="Mobile Cafe Route Management">
      <PermissionGuard permission="operations.view" fallback={<AccessDenied />}>
        <main className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Route Management</h1>
          <p className="text-gray-500 text-sm">Plan and manage daily routes and locations for mobile cafe tenants.</p>
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
            Coming soon
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
