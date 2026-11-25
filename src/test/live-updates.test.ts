import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const getMe = vi.fn()
vi.mock('@/services/auth.service', async (orig) => {
  const actual = await orig<typeof import('@/services/auth.service')>()
  return { ...actual, authService: { ...actual.authService, getMe: () => getMe() } }
})

import { applyLiveChange, onLiveChange, refreshSession } from '@/lib/live-updates'
import { notificationTarget, notificationsPage } from '@/lib/notification-target'
import { isBusinessAccount } from '@/lib/console-account-access'
import { getDashboardNav } from '@/modules/registry'
import { useAuthStore } from '@/stores'

const customer = { id: 'u1', email: 'a@b.c', accountType: 'customer' }

describe('live updates', () => {
  beforeEach(() => {
    getMe.mockReset()
    useAuthStore.setState({ isAuthenticated: true, user: customer } as never)
  })

  it('an approved owner becomes a business account without a reload', async () => {
    getMe.mockResolvedValue({ user: { ...customer, accountType: 'business' }, memberships: [] })
    expect(isBusinessAccount(useAuthStore.getState().user)).toBe(false)
    const qc = new QueryClient()
    await Promise.all([refreshSession(qc), refreshSession(qc)])
    expect(getMe).toHaveBeenCalledOnce() // concurrent refreshes share one request
    expect(isBusinessAccount(useAuthStore.getState().user)).toBe(true)
  })

  it('ignores a session that arrives after another account signed in', async () => {
    getMe.mockImplementation(async () => {
      useAuthStore.setState({ user: { ...customer, id: 'u2' } } as never)
      return { user: { ...customer, accountType: 'business' }, memberships: [] }
    })
    await refreshSession(new QueryClient())
    expect(useAuthStore.getState().user?.id).toBe('u2')
    expect(isBusinessAccount(useAuthStore.getState().user)).toBe(false)
  })

  it('refetches only the changed topics and tells listeners', () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const onWallet = vi.fn()
    const onSettlement = vi.fn()
    const off = [onLiveChange(['wallet'], onWallet), onLiveChange(['settlement'], onSettlement)]
    applyLiveChange(qc, ['wallet'])
    expect(invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])).toEqual(['wallet'])
    expect(onWallet).toHaveBeenCalledOnce()
    expect(onSettlement).not.toHaveBeenCalled()
    expect(getMe).not.toHaveBeenCalled()
    off.forEach((fn) => fn())
  })
})

describe('where a notification leads', () => {
  it('its own link, or the notifications page of the current area', () => {
    const link = (href: string) => ({ deepLink: { type: 'order', id: '1', href } }) as never
    expect(notificationTarget(link('/order/1/track'), '/')).toBe('/order/1/track')
    expect(notificationTarget({}, '/dashboard')).toBe('/dashboard/notifications')
    expect(notificationTarget({}, '/console/orders')).toBe('/console/notifications')
    expect(notificationTarget(link('https://evil.example'), '/')).toBe('/dashboard/notifications')
    expect(notificationTarget(link('//evil.example'), '/')).toBe('/dashboard/notifications')
    expect(notificationsPage('/')).toBe('/dashboard/notifications')
  })

  it('the bell no longer sends customers to the console', () => {
    const bell = readFileSync(resolve(__dirname, '../components/layout/NotificationBell.tsx'), 'utf8')
    expect(bell).not.toContain('href="/console/notifications"')
    expect(getDashboardNav().some((i) => i.href === '/dashboard/notifications')).toBe(true)
  })
})
