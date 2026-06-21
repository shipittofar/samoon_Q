import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

interface MainLayoutProps {
  children: ReactNode
  showCart?: boolean
  fullWidth?: boolean
}

export function MainLayout({ children, showCart = true, fullWidth = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      {showCart && (
        <>
          <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
          <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>
        </>
      )}
      <main className={`flex-1 pt-16 ${fullWidth ? '' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
