import type { PublicCTALink, PublicCTASet } from './public-context'

/** Visual role for Branch page Quick Actions chips (not the journey primary CTA). */
export type BranchQuickActionRole = 'menu' | 'reservation' | 'loyalty' | 'other'

export type BranchQuickActionVariant = 'primary' | 'secondary'

export interface BranchQuickAction extends PublicCTALink {
  role: BranchQuickActionRole
  variant: BranchQuickActionVariant
}

/**
 * Branch Quick Actions bar order — independent of `orderCTAs()` / journey primary.
 *
 * 1. Menu / Order Online (`ctas.menu` — label already resolved by buildPublicCTAs)
 * 2. Reservation
 * 3. Loyalty
 * 4. Any remaining CTAs (e.g. locations), then leftover journey links not already listed
 *
 * Primary style: the menu/order CTA when present; otherwise reservation when it is
 * the first available customer action. Reservation never takes primary while a menu CTA exists.
 */
export function buildBranchQuickActions(
  ctas: PublicCTASet,
  remainingJourneyActions: Array<PublicCTALink | null> = [],
): BranchQuickAction[] {
  const ordered: Array<{ cta: PublicCTALink; role: BranchQuickActionRole }> = []
  const seen = new Set<string>()

  const push = (cta: PublicCTALink | null, role: BranchQuickActionRole) => {
    if (!cta || seen.has(cta.href)) return
    seen.add(cta.href)
    ordered.push({ cta, role })
  }

  push(ctas.menu, 'menu')
  push(ctas.reservation, 'reservation')
  push(ctas.loyalty, 'loyalty')
  push(ctas.locations, 'other')

  for (const extra of remainingJourneyActions) {
    push(extra, 'other')
  }

  const hasMenu = ordered.some((item) => item.role === 'menu')

  return ordered.map(({ cta, role }) => ({
    ...cta,
    role,
    variant:
      role === 'menu' || (role === 'reservation' && !hasMenu) ? 'primary' : 'secondary',
  }))
}
