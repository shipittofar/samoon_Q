'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'

export default function OrderRootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/orders')
  }, [router])

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="text-center">
        <Package className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3 animate-pulse" />
        <p className="text-sm text-[var(--fg-muted)]">Redirecting to your orders…</p>
      </div>
    </div>
  )
}
