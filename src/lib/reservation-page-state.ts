/**
 * Public Reservation page view-state. Empty branch lists must not be treated as
 * "unavailable" until the tenant branch query has finished (including the
 * disabled-query wait for tenantId).
 */
export type ReservationPageView =
  | 'loading'
  | 'error'
  | 'unavailable-branch'
  | 'unavailable-empty'
  | 'ready'

export function resolveReservationPageView(input: {
  branchesPending: boolean
  branchesError: boolean
  activeBranchReservationsEnabled: boolean | undefined
  reservationBranchCount: number
}): ReservationPageView {
  if (input.branchesPending) return 'loading'
  if (input.branchesError) return 'error'
  if (input.activeBranchReservationsEnabled === false) return 'unavailable-branch'
  if (input.reservationBranchCount === 0) return 'unavailable-empty'
  return 'ready'
}
