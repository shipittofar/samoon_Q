import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

interface MainLayoutProps {
  children: ReactNode
  /** @deprecated Cart chrome is mounted globally via GlobalCartHost. */
  showCart?: boolean
  fullWidth?: boolean
}

export function MainLayout({ children, fullWidth = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Header />
      <main className={`flex-1 ${fullWidth ? '' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
