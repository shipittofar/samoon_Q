import { describe, it, expect } from 'vitest'
import { resolveReservationPageView } from '@/lib/reservation-page-state'

const base = {
  branchesPending: false,
  branchesError: false,
  activeBranchReservationsEnabled: undefined as boolean | undefined,
  reservationBranchCount: 2,
}

describe('resolveReservationPageView', () => {
  it('treats a pending query (including disabled wait for tenantId) as loading, not empty', () => {
    expect(resolveReservationPageView({ ...base, branchesPending: true, reservationBranchCount: 0 }))
      .toBe('loading')
  })

  it('does not show unavailable while pending even if the active branch currently looks disabled', () => {
    expect(resolveReservationPageView({
      ...base,
      branchesPending: true,
      activeBranchReservationsEnabled: false,
      reservationBranchCount: 0,
    })).toBe('loading')
  })

  it('shows error instead of empty when the branch request failed', () => {
    expect(resolveReservationPageView({ ...base, branchesError: true, reservationBranchCount: 0 }))
      .toBe('error')
  })

  it('shows the form when branches exist after a successful load', () => {
    expect(resolveReservationPageView({ ...base, reservationBranchCount: 3 })).toBe('ready')
  })

  it('shows tenant-wide unavailable only after load completes with zero reservation branches', () => {
    expect(resolveReservationPageView({ ...base, reservationBranchCount: 0 }))
      .toBe('unavailable-empty')
  })

  it('shows branch-unavailable after load when the active branch has reservations disabled', () => {
    expect(resolveReservationPageView({
      ...base,
      activeBranchReservationsEnabled: false,
      reservationBranchCount: 2,
    })).toBe('unavailable-branch')
  })

  it('prefers error over empty when both error and zero branches are present', () => {
    expect(resolveReservationPageView({
      ...base,
      branchesError: true,
      reservationBranchCount: 0,
    })).toBe('error')
  })
})
