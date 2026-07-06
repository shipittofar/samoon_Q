'use client'

import { useTranslations } from 'next-intl'

export default function OfflinePage() {
  const t = useTranslations('errors')
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="h-24 w-24 rounded-full bg-[var(--card)] border-4 border-[var(--border)] flex items-center justify-center mx-auto">
            <span className="text-4xl">📡</span>
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-red-500 flex items-center justify-center mx-auto shadow-lg">
            <span className="text-white text-sm font-bold">!</span>
          </div>
        </div>
        <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-3">
          {t('offline')}
        </h1>
        <p className="text-[var(--fg-muted)] mb-8 leading-relaxed">
          {t('offlineDesc')}
        </p>
        <div className="space-y-3">
          <link
            href="/menu"
            className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl transition-colors shadow-lg"
          >
            {t('browseCachedMenu')}
          </link>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full border border-[var(--border)] text-[var(--fg)] font-semibold px-6 py-3.5 rounded-2xl hover:bg-[var(--card-hover)] transition-colors"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    </div>
  )
}
