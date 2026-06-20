import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <p className="font-[var(--font-display)] text-[10rem] font-bold text-[var(--border)] leading-none select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        </div>
        <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-3">Page Not Found</h1>
        <p className="text-[var(--fg-muted)] mb-8">
          Looks like this page went missing — just like the last slice of pizza. Lets get you back on track.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-[var(--shadow-brand)]">
            <Home className="h-4 w-4" /> Go Home
          </Link>
          <Link href="/menu" className="inline-flex items-center gap-2 border border-[var(--border)] text-[var(--fg)] font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors">
            Browse Menu
          </Link>
        </div>
      </div>
    </div>
  )
}
