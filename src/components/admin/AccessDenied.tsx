'use client'

import Link from 'next/link'

interface AccessDeniedProps {
  resource?: string
}

export function AccessDenied({ resource }: AccessDeniedProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Access denied</h2>
        <p className="mt-1 text-sm text-gray-500">
          {resource
            ? `You don't have permission to access ${resource}.`
            : "You don't have permission to view this page."}
        </p>
      </div>
      <Link
        href="/admin/orders"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        Go to Orders
      </Link>
    </div>
  )
}
