/**
 * Phase 5.4 — Admin Reservations Management Tests
 *
 * Verifies:
 *   A. No MOCK_RESERVATIONS dependency remains
 *   B. useAdminReservations integrated
 *   C. useConfirmReservation integrated
 *   D. Loading state exists
 *   E. Error state exists
 *   F. Empty state exists
 *   G. Filters drive query inputs
 *   H. Query invalidation exists
 *   I. Optimistic update exists (confirm + cancel)
 *   J. Branch filtering wired (useBranches + branch name lookup)
 *   K. Cancel flow preserved via useCancelReservation
 *
 * Regression:
 *   - Customer reservation flow unchanged
 *   - Reservation creation unchanged
 *   - Available slots unchanged
 *   - Admin auth unchanged
 *   - P5.1–P5.3 hooks unchanged
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function src(rel: string) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

const page = src('src/app/admin/reservations/page.tsx')
const hooks = src('src/hooks/index.ts')

// ── A. No MOCK_RESERVATIONS ───────────────────────────────────────────────────

describe('Admin reservations page — no hardcoded data', () => {
  it('A: does not import MOCK_RESERVATIONS', () => {
    expect(page).not.toContain('MOCK_RESERVATIONS')
  })

  it('A: does not import MOCK_BRANCHES', () => {
    expect(page).not.toContain('MOCK_BRANCHES')
  })

  it('A: does not import from @/lib/mock-data', () => {
    expect(page).not.toMatch(/from '@\/lib\/mock-data'/)
  })

  it('A: no inline ALL_RESERVATIONS array', () => {
    expect(page).not.toContain('ALL_RESERVATIONS')
  })
})

// ── B. useAdminReservations integrated ───────────────────────────────────────

describe('Admin reservations page — useAdminReservations', () => {
  it('B: imports useAdminReservations', () => {
    expect(page).toMatch(/useAdminReservations/)
  })

  it('B: calls useAdminReservations with filters', () => {
    expect(page).toMatch(/useAdminReservations\s*\(\s*filters\s*\)/)
  })

  it('B: consumes data.results', () => {
    expect(page).toMatch(/data\?\.results/)
  })
})

// ── C. useConfirmReservation integrated ──────────────────────────────────────

describe('Admin reservations page — useConfirmReservation', () => {
  it('C: imports useConfirmReservation', () => {
    expect(page).toMatch(/useConfirmReservation/)
  })

  it('C: calls confirmMutation.mutate with reservation id', () => {
    expect(page).toMatch(/confirmMutation\.mutate\s*\(/)
  })
})

// ── D. Loading state ──────────────────────────────────────────────────────────

describe('Admin reservations page — loading state', () => {
  it('D: isLoading from useAdminReservations', () => {
    expect(page).toMatch(/isLoading/)
  })

  it('D: renders loading UI', () => {
    expect(page).toMatch(/isLoading\s*&&/)
  })

  it('D: uses Loader2 spinner', () => {
    expect(page).toContain('Loader2')
  })
})

// ── E. Error state ────────────────────────────────────────────────────────────

describe('Admin reservations page — error state', () => {
  it('E: isError from useAdminReservations', () => {
    expect(page).toMatch(/isError/)
  })

  it('E: renders error UI', () => {
    expect(page).toMatch(/isError.*&&/)
  })

  it('E: error UI has retry affordance', () => {
    expect(page).toMatch(/Retry|refetch/)
  })
})

// ── F. Empty state ────────────────────────────────────────────────────────────

describe('Admin reservations page — empty state', () => {
  it('F: empty state when reservations.length === 0', () => {
    expect(page).toMatch(/reservations\.length\s*===\s*0/)
  })

  it('F: empty state has user-facing message', () => {
    expect(page).toMatch(/No reservations found/)
  })
})

// ── G. Filters drive query inputs ─────────────────────────────────────────────

describe('Admin reservations page — filter state → query params', () => {
  it('G: useMemo for filters object', () => {
    expect(page).toMatch(/useMemo/)
  })

  it('G: statusFilter wired to AdminReservationFilters.status', () => {
    expect(page).toMatch(/statusFilter/)
  })

  it('G: search wired to filters', () => {
    expect(page).toMatch(/search/)
  })

  it('G: date wired from date navigator', () => {
    expect(page).toMatch(/todayStr|date.*todayStr|date:/)
  })

  it('G: filters object passed to useAdminReservations', () => {
    expect(page).toMatch(/useAdminReservations\s*\(\s*filters\s*\)/)
  })
})

// ── H. Query invalidation in hooks ────────────────────────────────────────────

describe('Hooks — query invalidation', () => {
  it('H: useConfirmReservation invalidates admin-reservations', () => {
    expect(hooks).toMatch(/useConfirmReservation[\s\S]{0,1100}invalidateQueries.*admin-reservations/)
  })

  it('H: useConfirmReservation invalidates reservations', () => {
    expect(hooks).toMatch(/useConfirmReservation[\s\S]{0,1100}invalidateQueries.*['"]reservations['"]/)
  })

  it('H: useCancelReservation invalidates admin-reservations', () => {
    expect(hooks).toMatch(/useCancelReservation[\s\S]{0,1100}invalidateQueries.*admin-reservations/)
  })

  it('H: useCancelReservation invalidates reservations', () => {
    expect(hooks).toMatch(/useCancelReservation[\s\S]{0,1100}invalidateQueries.*['"]reservations['"]/)
  })
})

// ── I. Optimistic update in hooks ─────────────────────────────────────────────

describe('Hooks — optimistic updates', () => {
  it('I: useConfirmReservation has onMutate', () => {
    const block = hooks.slice(hooks.indexOf('useConfirmReservation'))
    expect(block.slice(0, 800)).toMatch(/onMutate/)
  })

  it('I: useConfirmReservation has onError rollback', () => {
    const block = hooks.slice(hooks.indexOf('useConfirmReservation'))
    expect(block.slice(0, 900)).toMatch(/onError/)
  })

  it('I: useConfirmReservation sets status to confirmed optimistically', () => {
    const block = hooks.slice(hooks.indexOf('useConfirmReservation'))
    expect(block.slice(0, 900)).toMatch(/confirmed/)
  })

  it('I: useCancelReservation has onMutate', () => {
    const block = hooks.slice(hooks.indexOf('useCancelReservation'))
    expect(block.slice(0, 800)).toMatch(/onMutate/)
  })

  it('I: useCancelReservation sets status to cancelled optimistically', () => {
    const block = hooks.slice(hooks.indexOf('useCancelReservation'))
    expect(block.slice(0, 800)).toMatch(/cancelled/)
  })

  it('I: useCancelReservation has onError rollback', () => {
    const block = hooks.slice(hooks.indexOf('useCancelReservation'))
    expect(block.slice(0, 900)).toMatch(/onError/)
  })
})

// ── J. Branch filtering wired ─────────────────────────────────────────────────

describe('Admin reservations page — branch integration', () => {
  it('J: imports useBranches', () => {
    expect(page).toMatch(/useBranches/)
  })

  it('J: uses getBranchName helper or equivalent lookup', () => {
    expect(page).toMatch(/getBranchName|branches.*find|find.*branch/)
  })

  it('J: branch name rendered in table', () => {
    expect(page).toMatch(/getBranchName\s*\(|branch.*name/)
  })
})

// ── K. Cancel flow preserved ──────────────────────────────────────────────────

describe('Admin reservations page — cancel flow', () => {
  it('K: imports useCancelReservation', () => {
    expect(page).toMatch(/useCancelReservation/)
  })

  it('K: calls cancelMutation.mutate with id', () => {
    expect(page).toMatch(/cancelMutation\.mutate/)
  })

  it('K: useCancelReservation hook exists in hooks/index.ts', () => {
    expect(hooks).toMatch(/export function useCancelReservation/)
  })

  it('K: useCancelReservation uses reservationService.cancelReservation', () => {
    const block = hooks.slice(hooks.indexOf('useCancelReservation'))
    expect(block.slice(0, 300)).toMatch(/cancelReservation/)
  })
})

// ── Backend blocker documentation ─────────────────────────────────────────────

describe('Confirm endpoint backend blocker', () => {
  it('page documents undeployed confirm endpoint with TODO', () => {
    expect(page).toMatch(/TODO.*confirm|confirm.*TODO|not.*deployed|backend/i)
  })
})

// ── Mock mode compatibility ───────────────────────────────────────────────────

describe('Mock mode compatibility', () => {
  it('adminService.getAdminReservations works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminReservations()
    expect(result).toHaveProperty('results')
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('adminService.confirmReservation works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const res = await adminService.confirmReservation('res-001')
    expect(res.status).toBe('confirmed')
    expect(res.confirmation_code).toMatch(/^SAV-/)
  })

  it('reservationService.cancelReservation works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { reservationService } = await import('@/services/combined.service')
    const res = await reservationService.cancelReservation('res-001')
    expect(res.status).toBe('cancelled')
  })

  it('filter by status works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminReservations({ status: 'confirmed' })
    result.results.forEach((r) => expect(r.status).toBe('confirmed'))
  })
})

// ── Regression: customer reservation flow ─────────────────────────────────────

describe('Regression — customer reservation flow', () => {
  it('useCreateReservation still present in hooks', () => {
    expect(hooks).toMatch(/export function useCreateReservation/)
  })

  it('useAvailableSlots still present in hooks', () => {
    expect(hooks).toMatch(/export function useAvailableSlots/)
  })

  it('useReservations still present in hooks', () => {
    expect(hooks).toMatch(/export function useReservations/)
  })
})

// ── Regression: branches ──────────────────────────────────────────────────────

describe('Regression — branch hooks', () => {
  it('useBranches still present', () => {
    expect(hooks).toMatch(/export function useBranches/)
  })

  it('useBranch still present', () => {
    expect(hooks).toMatch(/export function useBranch\b/)
  })
})

// ── Regression: admin auth guard ─────────────────────────────────────────────

describe('Regression — admin auth guard', () => {
  it('admin layout still enforces dashboard:access', () => {
    const layout = src('src/app/admin/layout.tsx')
    expect(layout).toMatch(/dashboard:access/)
  })
})

// ── Regression: P5.1–P5.3 hooks ──────────────────────────────────────────────

describe('Regression — P5.1–P5.3 hooks', () => {
  it('useAdminOrders still present', () => {
    expect(hooks).toMatch(/export function useAdminOrders/)
  })

  it('useUpdateOrderStatus still present', () => {
    expect(hooks).toMatch(/export function useUpdateOrderStatus/)
  })

  it('useCreateMenuItem still present', () => {
    expect(hooks).toMatch(/export function useCreateMenuItem/)
  })

  it('useUpdateMenuItem still present', () => {
    expect(hooks).toMatch(/export function useUpdateMenuItem/)
  })

  it('useDeleteMenuItem still present', () => {
    expect(hooks).toMatch(/export function useDeleteMenuItem/)
  })
})
