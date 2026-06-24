'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode } from 'lucide-react'

export default function TableRootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/menu')
  }, [router])

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="text-center">
        <QrCode className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3 animate-pulse" />
        <p className="text-sm text-[var(--fg-muted)]">Scan a table QR code to continue…</p>
      </div>
    </div>
  )
}
