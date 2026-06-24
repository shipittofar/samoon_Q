'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'

export default function CartPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/menu')
  }, [router])

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="text-center">
        <ShoppingCart className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3 animate-pulse" />
        <p className="text-sm text-[var(--fg-muted)]">Redirecting to menu…</p>
      </div>
    </div>
  )
}
