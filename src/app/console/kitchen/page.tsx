'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { KitchenDisplay } from '@/components/admin/KitchenDisplay'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTenantStore } from '@/stores'
import { useSelectedBranch, useBranchState, useIsBranchReady } from '@/hooks'
import { Maximize2, Minimize2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

const REFRESH_OPTIONS = [
  { key: 'refresh5s',  ms: 5_000  },
  { key: 'refresh10s', ms: 10_000 },
  { key: 'refresh30s', ms: 30_000 },
  { key: 'refreshOff', ms: 0      },
]

function ConnectionStatus({ connected }: { connected: boolean }) {
  const t = useTranslations('console')
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {connected ? t('connectionLive') : t('connectionOffline')}
    </div>
  )
}

function KitchenPageContent() {
  const t = useTranslations('console')
  const { tenant } = useTenantStore()
  // Phase 3 — the console's Kitchen Display is admin-context, not
  // customer-storefront: it must read the branch the AdminBranchSwitcher
  // (AdminContextBar, rendered once by the console layout) resolved, not
  // the unrelated customer-facing `activeBranch` slice. `branchState` is
  // consulted explicitly below rather than only checking `branchId`
  // truthiness, so a 'loading'/'error' state renders distinctly instead
  // of collapsing into the same "select a branch" empty copy.
  const selectedBranch = useSelectedBranch()
  const branchState = useBranchState()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [refreshMs, setRefreshMs] = useState(10_000)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [tick, setTick] = useState(0)
  const [connected, setConnected] = useState(true)

  const branchId = useIsBranchReady() ? selectedBranch?.id ?? '' : ''
  const tenantId = tenant?.id ?? ''

  const refresh = useCallback(() => {
    setLastRefresh(Date.now())
    setTick((t) => t + 1)
    setConnected(true)
  }, [])

  useEffect(() => {
    if (!refreshMs) return
    const id = setInterval(refresh, refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, refresh])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* AdminHeader is rendered by the layout; no per-page header needed */}
      <div className={isFullscreen ? 'p-4' : 'pt-20 px-4 pb-6'}>
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--fg)]">{t('kitchenDisplay')}</h1>
            <ConnectionStatus connected={connected} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Branch selection lives once in AdminContextBar's AdminBranchSwitcher
                (console layout) — this page only reads the resolved selection. */}
            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
              <RefreshCw className="h-3 w-3" />
              <span>{t('autoRefreshLabel')}</span>
              {REFRESH_OPTIONS.map(({ key, ms }) => (
                <button
                  key={key}
                  onClick={() => setRefreshMs(ms)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    refreshMs === ms
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              title={t('refreshNow')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-xs text-[var(--fg-muted)] mb-4">
          {t('lastUpdatedLabel', { time: new Date(lastRefresh).toLocaleTimeString() })}
          {selectedBranch ? ` · ${selectedBranch.name}` : ` · ${t('allBranches')}`}
        </p>

        {branchState === 'loading' ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <p className="text-sm text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</p>
          </div>
        ) : branchState === 'error' ? (
          <div className="rounded-xl border border-red-300 bg-[var(--card)] p-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{t('failedToLoadBranches')}</p>
          </div>
        ) : !branchId ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <p className="text-sm text-[var(--fg-muted)]">{t('selectBranchToViewKitchenQueue')}</p>
          </div>
        ) : (
          /* key={tick} forces remount on manual refresh */
          <KitchenDisplay key={tick} branchId={branchId} tenantId={tenantId} />
        )}
      </div>
    </div>
  )
}

export default function KitchenPage() {
  return (
    <ErrorBoundary feature="Kitchen Display">
      <PermissionGuard permission="operations.view" fallback={<AccessDenied />}>
        <KitchenPageContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
