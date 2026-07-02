'use client'
import { useEffect } from 'react'
import { RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[App Error]', error) }, [error])
  return (
    <html><body className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <span className="text-6xl block mb-6" aria-hidden="true">💥</span>
        <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-3">Something went wrong</h1>
        <p className="text-[var(--fg-muted)] mb-8">An unexpected error occurred. Please try again.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try Again
          </button>
          <Link href="/" className="inline-flex items-center gap-2 border border-[var(--border)] text-[var(--fg)] font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors">
            <Home className="h-4 w-4" aria-hidden="true" /> Home
          </Link>
        </div>
        {error.digest && <p className="text-xs text-[var(--fg-subtle)] mt-6">Error ID: {error.digest}</p>}
      </div>
    </body></html>
  )
}
