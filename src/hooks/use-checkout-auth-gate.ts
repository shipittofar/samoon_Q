'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'

export const CHECKOUT_PATH = '/checkout'

/**
 * Primary Cart → Checkout authentication gate.
 * Guests see AuthModal on the current page; only authenticated users navigate.
 */
export function useCheckoutAuthGate() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const pendingHrefRef = useRef(CHECKOUT_PATH)
  const didNavigateRef = useRef(false)

  const goToCheckout = useCallback((href: string) => {
    if (didNavigateRef.current) return
    didNavigateRef.current = true
    router.push(href)
  }, [router])

  const requestCheckout = useCallback((href: string = CHECKOUT_PATH) => {
    pendingHrefRef.current = href
    didNavigateRef.current = false
    if (useAuthStore.getState().isAuthenticated) {
      goToCheckout(href)
      return
    }
    setAuthModalOpen(true)
  }, [goToCheckout])

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false)
    goToCheckout(pendingHrefRef.current)
  }, [goToCheckout])

  const handleAuthClose = useCallback(() => {
    setAuthModalOpen(false)
  }, [])

  return {
    authModalOpen,
    isAuthenticated,
    requestCheckout,
    handleAuthSuccess,
    handleAuthClose,
  }
}
