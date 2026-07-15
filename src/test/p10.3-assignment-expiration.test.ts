// ============================================================
// P10.3 Phase I — Assignment Expiration — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { getNextAssignmentExpiry, resolveOwnershipIdentity } from '@/services/ownership-resolution.service'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
})

describe('P10.3 Phase I — getNextAssignmentExpiry', () => {
  it('returns null for a staff member with no temporary assignments', () => {
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    expect(getNextAssignmentExpiry(identity.staffMember!.id)).toBeNull()
  })

  it("returns lee.line's (staff-kitchen-02) temporary assignment expiry (assign-008, validUntil set)", () => {
    const identity = resolveOwnershipIdentity('lee.line@samoon.com')
    const expiry = getNextAssignmentExpiry(identity.staffMember!.id)
    expect(expiry).not.toBeNull()
    expect(expiry!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns null once the temporary assignment has actually expired (not effective at that "now")', () => {
    const identity = resolveOwnershipIdentity('lee.line@samoon.com')
    const farFuture = new Date(Date.now() + 365 * 86_400_000)
    expect(getNextAssignmentExpiry(identity.staffMember!.id, farFuture)).toBeNull()
  })

  it('returns null for an unknown staff id', () => {
    expect(getNextAssignmentExpiry('staff-does-not-exist')).toBeNull()
  })
})
