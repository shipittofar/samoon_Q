'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useMarkNotificationRead } from '@/hooks'
import { useAuthStore } from '@/stores'
import { isBusinessAccount } from '@/lib/console-account-access'
import { refreshSession } from '@/lib/live-updates'
import { notificationTarget } from '@/lib/notification-target'
import type { RichNotification } from '@/types/notification'

/** Open what a notification is about: mark it read and go there without a page reload. */
export function useOpenNotification() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { mutate: markRead } = useMarkNotificationRead()

  return useCallback(
    async (n: Partial<RichNotification>) => {
      if (n.id && n.status !== 'read' && n.status !== 'archived') markRead(n.id)
      const href = notificationTarget(n, window.location.pathname)
      // Just became a business account: the console would refuse a stale session.
      if (href.startsWith('/console') && !isBusinessAccount(useAuthStore.getState().user)) {
        await refreshSession(queryClient).catch(() => undefined)
      }
      router.push(href)
    },
    [router, queryClient, markRead],
  )
}
