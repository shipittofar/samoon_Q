'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { KitchenDisplay } from '@/components/admin/KitchenDisplay'
import { BranchSelector } from '@/components/common/BranchSelector'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTenantStore, useBranchStore } from '@/stores'
import { Maximize2, Minimize2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

const REFRESH_OPTIONS = [
  { label: '5s',  ms: 5_000  },
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: 'Off', ms: 0      },
]

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {connected ? 'Live' : 'Disconnected'}
    </div>
  )
}

function KitchenPageContent() {
  const { tenant } = useTenantStore()
  const activeBranch = useBranchStore((s) => s.activeBranch)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [refreshMs, setRefreshMs] = useState(10_000)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [tick, setTick] = useState(0)
  const [connected, setConnected] = useState(true)

  const branchId = activeBranch?.id ?? ''
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
      {!isFullscreen && <Header />}
      <div className={isFullscreen ? 'p-4' : 'pt-20 px-4 pb-6'}>
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--fg)]">Kitchen Display</h1>
            <ConnectionStatus connected={connected} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <BranchSelector />
            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
              <RefreshCw className="h-3 w-3" />
              <span>Auto-refresh:</span>
              {REFRESH_OPTIONS.map(({ label, ms }) => (
                <button
                  key={label}
                  onClick={() => setRefreshMs(ms)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    refreshMs === ms
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              title="Refresh now"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-xs text-[var(--fg-muted)] mb-4">
          Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          {activeBranch ? ` · ${activeBranch.name}` : ' · All Branches'}
        </p>

        {!branchId ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <p className="text-sm text-[var(--fg-muted)]">Select a branch to view kitchen queue.</p>
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
      <PermissionGuard permission="operations.view">
        <KitchenPageContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
