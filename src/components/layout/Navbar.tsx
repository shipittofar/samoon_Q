'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, ShoppingCart, User, Calendar } from 'lucide-react'
import { cn } from '@/utils'

const NAV_ITEMS = [
  { href: '/',            icon: Home,            label: 'Home' },
  { href: '/menu',        icon: UtensilsCrossed, label: 'Menu' },
  { href: '/reservation', icon: Calendar,        label: 'Reserve' },
  { href: '/dashboard',   icon: User,            label: 'Account' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[var(--card)]/95 backdrop-blur-xl border-t border-[var(--border)]" aria-label="Mobile navigation">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={cn('flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors relative', active ? 'text-orange-500' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]')} aria-current={active ? 'page' : undefined}>
              <item.icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-orange-500 rounded-full" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
