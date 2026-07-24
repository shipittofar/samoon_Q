import type { User } from '@/types'
import type { Role } from '@/types/rbac'

/** Dispatched once per successful login/register/verify (not session restore). */
export const POST_LOGIN_REDIRECT_EVENT = 'auth:post-login'

export type PostLoginRedirectDetail = {
  user: User
  p7Roles?: Role[]
}

/**
 * Requests post-authentication redirect after GET /auth/me has hydrated the session.
 * `PostLoginRedirectHandler` navigates using the resolved profile — never on boot.
 */
export function dispatchPostLoginRedirect(user: User, p7Roles?: Role[] | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<PostLoginRedirectDetail>(POST_LOGIN_REDIRECT_EVENT, {
      detail: { user, p7Roles: p7Roles ?? undefined },
    }),
  )
}
