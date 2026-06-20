'use client'

/**
 * ErrorBoundary — Phase 3 (P3.12)
 *
 * Localized React class-based Error Boundary that catches render errors in
 * feature subtrees and renders a contained fallback instead of crashing the
 * whole page.
 *
 * Designed to wrap individual features (CartDrawer, NotificationCenter,
 * menu listings) so one broken component cannot bring down the entire UI.
 *
 * @example
 * <ErrorBoundary feature="CartDrawer">
 *   <CartDrawer />
 * </ErrorBoundary>
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { captureException } from '@/lib/sentry'
import { VERSION } from '@/lib/version'
import { useTenantStore } from '@/stores'
// useTenantStore.getState() is used in componentDidCatch (class component — no hooks allowed)

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Human-readable feature name used in the fallback message and console log. */
  feature?: string
  /** Custom fallback UI. When omitted a default minimal fallback is rendered. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const feature = this.props.feature ?? 'Unknown'
    console.error(`[ErrorBoundary:${feature}] Caught render error:`, error, info.componentStack)

    // P4.6.5 — Enrich Sentry events with observability context.
    // Only non-sensitive fields: no tokens, no PII beyond what's already in user context.
    const pathname =
      typeof window !== 'undefined' ? window.location.pathname : undefined

    // P4.9.4 — Enrich error context with tenant slug and environment.
    // Uses getState() since class components cannot call hooks.
    const tenantSlug = useTenantStore.getState().tenant?.slug
    const environment = process.env.NODE_ENV ?? 'unknown'

    captureException(error, {
      feature,
      componentStack: info.componentStack ?? undefined,
      // Route context
      pathname,
      // Tenant / env context (P4.9.4)
      tenantSlug,
      environment,
      // Build context
      release: VERSION,
    })
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return <>{this.props.fallback}</>

    const feature = this.props.feature ?? 'This feature'
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-center"
      >
        <p className="text-sm font-medium text-[var(--fg)]">{feature} is temporarily unavailable.</p>
        <button
          onClick={this.reset}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }
}
