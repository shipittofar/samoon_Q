import type { User } from '@/types'

/**
 * Platform Admin route/nav authorization.
 * Django `User.is_superuser` from GET /auth/me is the only grant.
 * Missing/undefined/false must never allow access.
 */
export function isPlatformSuperuser(user: User | null | undefined): boolean {
  return user?.is_superuser === true
}
