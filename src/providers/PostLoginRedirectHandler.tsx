'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { resolvePostAuthDestination } from '@/utils/auth-redirect'
import { POST_LOGIN_REDIRECT_EVENT, type PostLoginRedirectDetail } from '@/lib/post-auth-navigation'

/**
 * Handles post-login navigation only — listens for `auth:post-login` events
 * dispatched after GET /auth/me has resolved (see establishAuthenticatedSession).
 * Never runs on session restore or manual routing.
 */
export function PostLoginRedirectHandler({ children }: { children: ReactNode }) {
  const router = useRouter()
  const redirectedRef = useRef(false)

  useEffect(() => {
    function onPostLogin(event: Event) {
      if (redirectedRef.current) return
      const { user, p7Roles } = (event as CustomEvent<PostLoginRedirectDetail>).detail
      if (!user?.accountType) return

      redirectedRef.current = true
      router.replace(resolvePostAuthDestination(user.accountType, p7Roles))
    }

    window.addEventListener(POST_LOGIN_REDIRECT_EVENT, onPostLogin)
    return () => window.removeEventListener(POST_LOGIN_REDIRECT_EVENT, onPostLogin)
  }, [router])

  return <>{children}</>
}
