/**
 * P8.9.7 — Customer 360° CRM Regression Tests
 *
 * Covers: timeline isolation, notes CRUD, tags integrity, analytics isolation,
 * marketing data, coupons, payments derivation, cross-tenant protection,
 * mock data integrity, service method correctness.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MOCK_CUSTOMER_NOTES,
  MOCK_CUSTOMER_TAG_DEFINITIONS,
  MOCK_CUSTOMER_TAG_ASSIGNMENTS,
  MOCK_CUSTOMER_ANALYTICS,
  MOCK_CUSTOMER_MARKETING,
  MOCK_CUSTOMER_COUPONS,
  MOCK_CUSTOMER_TIMELINE,
} from '@/lib/mock-data'
import { adminService } from '@/services/admin.service'

// ── 1. Mock data integrity ─────────────────────────────────────────────────

describe('P8.9.7 — Mock data integrity', () => {
  it('MOCK_CUSTOMER_NOTES: all records have required fields', () => {
    for (const note of MOCK_CUSTOMER_NOTES) {
      expect(note.id).toBeTruthy()
      expect(note.userId).toBeTruthy()
      expect(note.tenantId).toBeTruthy()
      expect(note.content).toBeTruthy()
      expect(note.authorId).toBeTruthy()
      expect(note.authorName).toBeTruthy()
      expect(note.created_at).toBeTruthy()
      expect(note.updated_at).toBeTruthy()
    }
  })

  it('MOCK_CUSTOMER_TAG_DEFINITIONS: all records have required fields and valid colors', () => {
    const validColors = ['gray', 'blue', 'green', 'yellow', 'red', 'purple', 'orange']
    for (const tag of MOCK_CUSTOMER_TAG_DEFINITIONS) {
      expect(tag.id).toBeTruthy()
      expect(tag.tenantId).toBeTruthy()
      expect(tag.label).toBeTruthy()
      expect(validColors).toContain(tag.color)
    }
  })

  it('MOCK_CUSTOMER_TAG_DEFINITIONS: no duplicate tag IDs', () => {
    const ids = MOCK_CUSTOMER_TAG_DEFINITIONS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('MOCK_CUSTOMER_TAG_ASSIGNMENTS: all assigned tag IDs exist in definitions', () => {
    const definedIds = new Set(MOCK_CUSTOMER_TAG_DEFINITIONS.map((t) => t.id))
    for (const [key, tagIds] of Object.entries(MOCK_CUSTOMER_TAG_ASSIGNMENTS)) {
      for (const tagId of tagIds) {
        expect(definedIds.has(tagId), `Tag ${tagId} in assignment ${key} not found in definitions`).toBe(true)
      }
    }
  })

  it('MOCK_CUSTOMER_ANALYTICS: all records have required numeric fields', () => {
    for (const a of MOCK_CUSTOMER_ANALYTICS) {
      expect(a.userId).toBeTruthy()
      expect(a.tenantId).toBeTruthy()
      expect(typeof a.lifetimeValue).toBe('number')
      expect(typeof a.avgOrderValue).toBe('number')
      expect(typeof a.visitFrequencyDays).toBe('number')
      expect(typeof a.daysSinceLastVisit).toBe('number')
      expect(Array.isArray(a.favoriteItems)).toBe(true)
      expect(Array.isArray(a.revenueByMonth)).toBe(true)
    }
  })

  it('MOCK_CUSTOMER_MARKETING: all records have 4 channel preferences', () => {
    const validChannels = ['email', 'sms', 'push', 'whatsapp']
    for (const m of MOCK_CUSTOMER_MARKETING) {
      expect(m.preferences).toHaveLength(4)
      const channels = m.preferences.map((p) => p.channel)
      for (const ch of validChannels) {
        expect(channels).toContain(ch)
      }
    }
  })

  it('MOCK_CUSTOMER_COUPONS: all records have valid discount types and statuses', () => {
    const validDiscountTypes = ['percent', 'fixed']
    const validStatuses = ['available', 'redeemed', 'expired']
    for (const coupon of MOCK_CUSTOMER_COUPONS) {
      expect(validDiscountTypes).toContain(coupon.discountType)
      expect(validStatuses).toContain(coupon.status)
      expect(coupon.discountValue).toBeGreaterThan(0)
    }
  })

  it('MOCK_CUSTOMER_TIMELINE: all records have valid event types', () => {
    const validTypes = new Set([
      'account_created', 'first_visit', 'order_placed', 'order_completed',
      'order_cancelled', 'order_refunded', 'reservation_made', 'reservation_confirmed',
      'reservation_completed', 'reservation_cancelled', 'reservation_no_show',
      'points_earned', 'points_redeemed', 'reward_redeemed', 'tier_upgraded',
      'tier_downgraded', 'coupon_received', 'coupon_redeemed', 'review_posted',
      'payment_completed', 'refund_issued', 'admin_note', 'tag_added', 'tag_removed',
      'marketing_email', 'marketing_sms', 'profile_updated', 'phone_verified', 'birthday',
    ])
    for (const event of MOCK_CUSTOMER_TIMELINE) {
      expect(validTypes.has(event.type), `Unknown event type: ${event.type}`).toBe(true)
    }
  })

  it('MOCK_CUSTOMER_TIMELINE: no duplicate event IDs', () => {
    const ids = MOCK_CUSTOMER_TIMELINE.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('MOCK_CUSTOMER_TIMELINE: Alice has at least 10 events', () => {
    const aliceEvents = MOCK_CUSTOMER_TIMELINE.filter(
      (e) => e.userId === 'pu-001' && e.tenantId === 'tenant-samoon-01'
    )
    expect(aliceEvents.length).toBeGreaterThanOrEqual(10)
  })
})

// ── 2. Timeline service ────────────────────────────────────────────────────

describe('P8.9.7 — getCustomerTimeline service', () => {
  it('returns only events for the requested (userId, tenantId)', async () => {
    const events = await adminService.getCustomerTimeline('pu-001', 'tenant-samoon-01')
    for (const e of events) {
      expect(e.userId).toBe('pu-001')
      expect(e.tenantId).toBe('tenant-samoon-01')
    }
  })

  it('returns events sorted descending by createdAt', async () => {
    const events = await adminService.getCustomerTimeline('pu-001', 'tenant-samoon-01')
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].created_at >= events[i].created_at).toBe(true)
    }
  })

  it('returns empty array for unknown user', async () => {
    const events = await adminService.getCustomerTimeline('pu-999', 'tenant-samoon-01')
    expect(events).toHaveLength(0)
  })

  it('cross-tenant isolation: pu-001 at tenant-brew gets no samoon events', async () => {
    const events = await adminService.getCustomerTimeline('pu-001', 'tenant-brew-cafe-01')
    // pu-001 has no mock timeline events for this tenant
    for (const e of events) {
      expect(e.tenantId).toBe('tenant-brew-cafe-01')
    }
  })

  it('Carol (pu-003) has timeline events', async () => {
    const events = await adminService.getCustomerTimeline('pu-003', 'tenant-samoon-01')
    expect(events.length).toBeGreaterThan(0)
  })
})

// ── 3. Notes service ───────────────────────────────────────────────────────

describe('P8.9.7 — Customer notes service', () => {
  it('getCustomerNotes returns only notes for (userId, tenantId)', async () => {
    const notes = await adminService.getCustomerNotes('pu-001', 'tenant-samoon-01')
    for (const n of notes) {
      expect(n.userId).toBe('pu-001')
      expect(n.tenantId).toBe('tenant-samoon-01')
    }
  })

  it('getCustomerNotes returns notes sorted descending by createdAt', async () => {
    const notes = await adminService.getCustomerNotes('pu-001', 'tenant-samoon-01')
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i - 1].created_at >= notes[i].created_at).toBe(true)
    }
  })

  it('getCustomerNotes returns empty for unknown user', async () => {
    const notes = await adminService.getCustomerNotes('pu-999', 'tenant-samoon-01')
    expect(notes).toHaveLength(0)
  })

  it('createCustomerNote creates a note with correct fields', async () => {
    const before = await adminService.getCustomerNotes('pu-001', 'tenant-samoon-01')
    const created = await adminService.createCustomerNote(
      'pu-001', 'tenant-samoon-01', 'Test note content', 'admin-test', 'Test Admin'
    )
    expect(created.userId).toBe('pu-001')
    expect(created.tenantId).toBe('tenant-samoon-01')
    expect(created.content).toBe('Test note content')
    expect(created.authorId).toBe('admin-test')
    expect(created.authorName).toBe('Test Admin')
    expect(created.id).toBeTruthy()

    const after = await adminService.getCustomerNotes('pu-001', 'tenant-samoon-01')
    expect(after.length).toBe(before.length + 1)
  })

  it('updateCustomerNote updates content and updatedAt', async () => {
    const created = await adminService.createCustomerNote(
      'pu-001', 'tenant-samoon-01', 'Original content', 'admin-test', 'Test Admin'
    )
    const updated = await adminService.updateCustomerNote(created.id, 'Updated content')
    expect(updated.content).toBe('Updated content')
    expect(updated.updated_at >= updated.created_at).toBe(true)
  })

  it('deleteCustomerNote removes the note', async () => {
    const created = await adminService.createCustomerNote(
      'pu-001', 'tenant-samoon-01', 'To be deleted', 'admin-test', 'Test Admin'
    )
    await adminService.deleteCustomerNote(created.id)
    const notes = await adminService.getCustomerNotes('pu-001', 'tenant-samoon-01')
    expect(notes.find((n) => n.id === created.id)).toBeUndefined()
  })

  it('cross-tenant note isolation: pu-001 notes at tenant-brew do not include samoon notes', async () => {
    const notes = await adminService.getCustomerNotes('pu-001', 'tenant-brew-cafe-01')
    for (const n of notes) {
      expect(n.tenantId).toBe('tenant-brew-cafe-01')
    }
  })
})

// ── 4. Tags service ────────────────────────────────────────────────────────

describe('P8.9.7 — Customer tags service', () => {
  it('getCustomerTags returns tag objects for assigned tag IDs', async () => {
    const assignment = await adminService.getCustomerTags('pu-001', 'tenant-samoon-01')
    expect(assignment.userId).toBe('pu-001')
    expect(assignment.tenantId).toBe('tenant-samoon-01')
    expect(Array.isArray(assignment.tags)).toBe(true)
    // Alice has VIP, High Value, Frequent Visitor
    const labels = assignment.tags.map((t) => t.label)
    expect(labels).toContain('VIP')
    expect(labels).toContain('High Value')
  })

  it('getTenantTagDefinitions returns all tags for tenant', async () => {
    const tags = await adminService.getTenantTagDefinitions('tenant-samoon-01')
    expect(tags.length).toBeGreaterThanOrEqual(9)
    for (const tag of tags) {
      expect(tag.tenantId).toBe('tenant-samoon-01')
    }
  })

  it('updateCustomerTags replaces tag assignments', async () => {
    const before = await adminService.getCustomerTags('pu-001', 'tenant-samoon-01')
    const newTagIds = ['tag-vip', 'tag-new']
    await adminService.updateCustomerTags('pu-001', 'tenant-samoon-01', newTagIds)
    const after = await adminService.getCustomerTags('pu-001', 'tenant-samoon-01')
    const afterIds = after.tags.map((t) => t.id)
    expect(afterIds).toContain('tag-vip')
    expect(afterIds).toContain('tag-new')
    expect(afterIds.length).toBe(2)

    // Restore original assignment
    const originalIds = before.tags.map((t) => t.id)
    await adminService.updateCustomerTags('pu-001', 'tenant-samoon-01', originalIds)
  })

  it('updateCustomerTags with empty array removes all tags', async () => {
    await adminService.updateCustomerTags('pu-009', 'tenant-samoon-01', [])
    const assignment = await adminService.getCustomerTags('pu-009', 'tenant-samoon-01')
    expect(assignment.tags).toHaveLength(0)

    // Restore
    await adminService.updateCustomerTags('pu-009', 'tenant-samoon-01', ['tag-freq'])
  })

  it('getCustomerTags returns empty tags for unassigned user', async () => {
    const assignment = await adminService.getCustomerTags('pu-999', 'tenant-samoon-01')
    expect(assignment.tags).toHaveLength(0)
  })
})

// ── 5. Analytics service ───────────────────────────────────────────────────

describe('P8.9.7 — Customer analytics service', () => {
  it('getCustomerAnalytics returns analytics for known user', async () => {
    const analytics = await adminService.getCustomerAnalytics('pu-001', 'tenant-samoon-01')
    expect(analytics).not.toBeNull()
    expect(analytics!.userId).toBe('pu-001')
    expect(analytics!.tenantId).toBe('tenant-samoon-01')
    expect(analytics!.lifetimeValue).toBeGreaterThan(0)
  })

  it('getCustomerAnalytics returns null for unknown user', async () => {
    const analytics = await adminService.getCustomerAnalytics('pu-999', 'tenant-samoon-01')
    expect(analytics).toBeNull()
  })

  it('cross-tenant analytics isolation: pu-001 at tenant-brew is independent', async () => {
    const samoon = await adminService.getCustomerAnalytics('pu-001', 'tenant-samoon-01')
    const brew = await adminService.getCustomerAnalytics('pu-001', 'tenant-brew-cafe-01')
    // Both can exist or brew can be null — they must not be the same object
    if (samoon && brew) {
      expect(samoon.tenantId).not.toBe(brew.tenantId)
    }
  })

  it('analytics favoriteItems sorted by count descending', async () => {
    const analytics = await adminService.getCustomerAnalytics('pu-001', 'tenant-samoon-01')
    if (analytics && analytics.favoriteItems.length > 1) {
      for (let i = 1; i < analytics.favoriteItems.length; i++) {
        expect(analytics.favoriteItems[i - 1].count >= analytics.favoriteItems[i].count).toBe(true)
      }
    }
  })
})

// ── 6. Marketing service ───────────────────────────────────────────────────

describe('P8.9.7 — Customer marketing service', () => {
  it('getCustomerMarketing returns marketing data for known user', async () => {
    const marketing = await adminService.getCustomerMarketing('pu-001', 'tenant-samoon-01')
    expect(marketing).not.toBeNull()
    expect(marketing!.userId).toBe('pu-001')
    expect(marketing!.preferences.length).toBeGreaterThan(0)
  })

  it('getCustomerMarketing returns null for unknown user', async () => {
    const marketing = await adminService.getCustomerMarketing('pu-999', 'tenant-samoon-01')
    expect(marketing).toBeNull()
  })

  it('marketing preferences cover all 4 channels', async () => {
    const marketing = await adminService.getCustomerMarketing('pu-001', 'tenant-samoon-01')
    if (marketing) {
      const channels = marketing.preferences.map((p) => p.channel)
      expect(channels).toContain('email')
      expect(channels).toContain('sms')
      expect(channels).toContain('push')
      expect(channels).toContain('whatsapp')
    }
  })

  it('cross-tenant marketing isolation', async () => {
    const m1 = await adminService.getCustomerMarketing('pu-001', 'tenant-samoon-01')
    const m2 = await adminService.getCustomerMarketing('pu-001', 'tenant-brew-cafe-01')
    // If both exist they must be different tenant-scoped objects
    if (m1 && m2) {
      expect(m1.tenantId).not.toBe(m2.tenantId)
    }
  })
})

// ── 7. Coupons service ─────────────────────────────────────────────────────

describe('P8.9.7 — Customer coupons service', () => {
  it('getCustomerCoupons returns coupons for (userId, tenantId)', async () => {
    const coupons = await adminService.getCustomerCoupons('pu-001', 'tenant-samoon-01')
    for (const c of coupons) {
      expect(c.userId).toBe('pu-001')
      expect(c.tenantId).toBe('tenant-samoon-01')
    }
  })

  it('getCustomerCoupons returns sorted descending by createdAt', async () => {
    const coupons = await adminService.getCustomerCoupons('pu-001', 'tenant-samoon-01')
    for (let i = 1; i < coupons.length; i++) {
      expect(coupons[i - 1].created_at >= coupons[i].created_at).toBe(true)
    }
  })

  it('getCustomerCoupons returns empty for unknown user', async () => {
    const coupons = await adminService.getCustomerCoupons('pu-999', 'tenant-samoon-01')
    expect(coupons).toHaveLength(0)
  })

  it('coupon discount values are positive', async () => {
    const coupons = await adminService.getCustomerCoupons('pu-001', 'tenant-samoon-01')
    for (const c of coupons) {
      expect(c.discountValue).toBeGreaterThan(0)
    }
  })
})

// ── 8. Payments service ────────────────────────────────────────────────────

describe('P8.9.7 — Customer payments service', () => {
  it('getCustomerPayments returns payment records for (userId, tenantId)', async () => {
    const payments = await adminService.getCustomerPayments('pu-001', 'tenant-samoon-01')
    for (const p of payments) {
      expect(p.userId).toBe('pu-001')
      expect(p.tenantId).toBe('tenant-samoon-01')
    }
  })

  it('getCustomerPayments: all payment amounts are positive', async () => {
    const payments = await adminService.getCustomerPayments('pu-001', 'tenant-samoon-01')
    for (const p of payments) {
      expect(p.amount).toBeGreaterThan(0)
    }
  })

  it('getCustomerPayments returns empty for unknown user', async () => {
    const payments = await adminService.getCustomerPayments('pu-999', 'tenant-samoon-01')
    expect(payments).toHaveLength(0)
  })
})

// ── 9. Orders and Reservations 360 ────────────────────────────────────────

describe('P8.9.7 — Customer orders and reservations 360', () => {
  it('getCustomerOrders returns paginated order data', async () => {
    const result = await adminService.getCustomerOrders('pu-001', 'tenant-samoon-01')
    expect(Array.isArray(result.results)).toBe(true)
    expect(typeof result.count).toBe('number')
  })

  it('getCustomerReservations returns paginated reservation data', async () => {
    const result = await adminService.getCustomerReservations('pu-001', 'tenant-samoon-01')
    expect(Array.isArray(result.results)).toBe(true)
    expect(typeof result.count).toBe('number')
  })
})

// ── 10. Cross-tenant isolation summary ────────────────────────────────────

describe('P8.9.7 — Cross-tenant isolation guarantees', () => {
  it('notes: no tenant-samoon-01 notes appear when querying tenant-brew-cafe-01', async () => {
    const notes = await adminService.getCustomerNotes('pu-001', 'tenant-brew-cafe-01')
    for (const n of notes) {
      expect(n.tenantId).not.toBe('tenant-samoon-01')
    }
  })

  it('timeline: no tenant-samoon-01 events appear when querying tenant-brew-cafe-01', async () => {
    const events = await adminService.getCustomerTimeline('pu-001', 'tenant-brew-cafe-01')
    for (const e of events) {
      expect(e.tenantId).not.toBe('tenant-samoon-01')
    }
  })

  it('coupons: no tenant-samoon-01 coupons appear when querying tenant-brew-cafe-01', async () => {
    const coupons = await adminService.getCustomerCoupons('pu-001', 'tenant-brew-cafe-01')
    for (const c of coupons) {
      expect(c.tenantId).not.toBe('tenant-samoon-01')
    }
  })

  it('tag definitions: getTenantTagDefinitions scoped to tenant', async () => {
    const samoonTags = await adminService.getTenantTagDefinitions('tenant-samoon-01')
    for (const tag of samoonTags) {
      expect(tag.tenantId).toBe('tenant-samoon-01')
    }
  })
})
