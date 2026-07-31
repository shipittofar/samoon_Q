/**
 * Authentication transition phases for login UI — HTTP 200 alone is not "logged in".
 */

export type AuthTransitionPhase =
  | 'idle'
  | 'authenticating'
  | 'storing_session'
  | 'loading_user'
  | 'redirecting'
  | 'authenticated'
  | 'failed'

export const ACTIVE_AUTH_TRANSITION_PHASES: readonly AuthTransitionPhase[] = [
  'authenticating',
  'storing_session',
  'loading_user',
  'redirecting',
]

export function isAuthTransitionActive(phase: AuthTransitionPhase): boolean {
  return ACTIVE_AUTH_TRANSITION_PHASES.includes(phase)
}

export type AuthTransitionLabelKey =
  | 'authTransitionSigningIn'
  | 'authTransitionLoadingAccount'
  | 'authTransitionRedirecting'

export function authTransitionLabelKey(phase: AuthTransitionPhase): AuthTransitionLabelKey | null {
  switch (phase) {
    case 'authenticating':
    case 'storing_session':
      return 'authTransitionSigningIn'
    case 'loading_user':
      return 'authTransitionLoadingAccount'
    case 'redirecting':
      return 'authTransitionRedirecting'
    default:
      return null
  }
}

function normalizePath(path: string): string {
  if (!path) return '/'
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Navigates to `targetPath` and resolves when the browser pathname matches
 * (or is a child of) the destination — i.e. the route has mounted.
 */
export function redirectAndAwaitMount(
  router: { replace: (path: string) => void },
  targetPath: string,
  timeoutMs = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const normalizedTarget = normalizePath(targetPath)

    const matchesTarget = () => {
      if (typeof window === 'undefined') return false
      const current = normalizePath(window.location.pathname)
      return current === normalizedTarget || current.startsWith(`${normalizedTarget}/`)
    }

    if (matchesTarget()) {
      resolve()
      return
    }

    router.replace(targetPath)

    const deadline = Date.now() + timeoutMs
    const poll = () => {
      if (matchesTarget()) {
        resolve()
        return
      }
      if (Date.now() > deadline) {
        reject(new Error('redirect_timeout'))
        return
      }
      setTimeout(poll, 50)
    }
    setTimeout(poll, 50)
  })
}
