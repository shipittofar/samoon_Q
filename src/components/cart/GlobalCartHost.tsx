'use client'

import { usePathname } from 'next/navigation'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { CartConflictDialog } from '@/components/cart/CartConflictDialog'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

function isOperatorPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.startsWith('/console') || pathname.startsWith('/platform-admin')
}

/**
 * Application-level cart chrome. Pages must not mount their own CartDrawer.
 */
export function GlobalCartHost() {
  const pathname = usePathname()
  const operator = isOperatorPath(pathname)

  return (
    <>
      {!operator && (
        <>
          <ErrorBoundary feature="CartDrawer">
            <CartDrawer />
          </ErrorBoundary>
          <ErrorBoundary feature="FloatingCart">
            <FloatingCart />
          </ErrorBoundary>
        </>
      )}
      <CartConflictDialog />
    </>
  )
}
