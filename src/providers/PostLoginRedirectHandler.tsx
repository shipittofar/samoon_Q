'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { getPostLoginRedirect } from '@/utils/auth-redirect'
import { POST_LOGIN_REDIRECT_EVENT, type PostLoginRedirectDetail } from '@/lib/post-auth-navigation'

/**
 * Handles post-login navigation only — listens for `auth:post-login` events
 * dispatched by auth mutations (useLogin/useRegister/useVerifyOTP callers).
 * Never runs on session restore (AuthBootstrapper getMe) or manual routing.
 */
export function PostLoginRedirectHandler({ children }: { children: ReactNode }) {
  const router = useRouter()
  const navigatingRef = useRef(false)

  useEffect(() => {
    async function onPostLogin(event: Event) {
      if (navigatingRef.current) return
      navigatingRef.current = true
      try {
        const { user: eventUser, p7Roles } = (event as CustomEvent<PostLoginRedirectDetail>).detail
        let user = useAuthStore.getState().user ?? eventUser
        let roles = p7Roles

        if (!user?.accountType) {
          const me = await authService.getMe()
          useAuthStore.getState().setUser(me.user)
          user = me.user
        }

        if (!user?.accountType) return

        router.replace(getPostLoginRedirect(user.accountType, roles))
      } finally {
        navigatingRef.current = false
      }
    }

    window.addEventListener(POST_LOGIN_REDIRECT_EVENT, onPostLogin)
    return () => window.removeEventListener(POST_LOGIN_REDIRECT_EVENT, onPostLogin)
  }, [router])

  return <>{children}</>
}
