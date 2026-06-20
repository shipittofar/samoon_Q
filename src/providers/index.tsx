'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore, useThemeStore, useLangStore, useFavoritesStore, useTenantStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { userService } from '@/services/combined.service'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: (count, err: any) => {
          if (err?.response?.status === 401) return false
          return count < 2
        },
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore()
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else if (theme === 'light') root.classList.remove('dark')
    else {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', sys)
    }
  }, [theme])
  return <>{children}</>
}

function RTLProvider({ children }: { children: ReactNode }) {
  const { locale } = useLangStore()
  useEffect(() => {
    document.documentElement.dir = ['fa', 'ar'].includes(locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale])
  return <>{children}</>
}

/**
 * Loads the active tenant once at app startup.
 *
 * Phase 1A/1B: calls loadTenant() with no slug argument so the service resolves
 * the default tenant (mock mode) or the current tenant from the API.
 * Falls back to DEFAULT_TENANT automatically if the service call fails (M-1 fix).
 *
 * Phase 1B (P1B.3): middleware will inject X-Tenant-Slug from the subdomain;
 * this bootstrapper will be updated at that point to pass the slug from the header.
 * No environment-based multi-tenant switching is introduced here.
 */
function TenantBootstrapper({ children }: { children: ReactNode }) {
  const { loadTenant } = useTenantStore()
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    loadTenant()
  }, [loadTenant])
  return <>{children}</>
}

function AuthBootstrapper({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuthStore()
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) { setLoading(false); return }
    authService.getMe().then((user) => {
      setUser(user)
      userService.getFavorites().then(setFavorites).catch(() => {})
    }).catch(() => setLoading(false))
    const handleLogout = () => setUser(null)
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [setUser, setLoading, setFavorites])
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RTLProvider>
          <TenantBootstrapper>
            <AuthBootstrapper>
              {children}
              <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.875rem' }, success: { iconTheme: { primary: '#f97316', secondary: '#fff' } } }} />
            </AuthBootstrapper>
          </TenantBootstrapper>
        </RTLProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
