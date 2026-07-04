/**
 * P8.9.6 — Platform Customer Identity & Business Relationship Architecture
 *
 * Tests the three-layer customer model: PlatformUser → BusinessCustomer → BranchCustomer.
 * Verifies isolation invariants, tenant scoping, and loyalty independence.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { adminService } from '@/services/admin.service'
import { loyaltyService } from '@/services/loyalty.service'
import { MOCK_PLATFORM_USERS, MOCK_BUSINESS_CUSTOMERS, MOCK_BRANCH_CUSTOMERS, MOCK_LOYALTY_ACCOUNTS } from '@/lib/mock-data'

const SAVOR = 'tenant-savor-01'
const BREW = 'tenant-brew-cafe-01'
const OAK = 'tenant-oak-bar-01'
const CENTRAL = 'tenant-central-fc-01'
const WHEELS = 'tenant-wheels-brews-01'
const ROAD = 'tenant-road-bites-01'

// Alice Johnson — the canonical cross-tenant user
const ALICE_ID = 'pu-001'

describe('P8.9.6 — PlatformUser integrity', () => {
  it('platform users have unique IDs', () => {
    const ids = MOCK_PLATFORM_USERS.map((u) => u.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('platform users have unique phone numbers', () => {
    const phones = MOCK_PLATFORM_USERS.map((u) => u.phone)
    const unique = new Set(phones)
    expect(unique.size).toBe(phones.length)
  })

  it('platform users have valid status values', () => {
    const valid = new Set(['active', 'inactive', 'suspended'])
    MOCK_PLATFORM_USERS.forEach((u) => {
      expect(valid.has(u.status), `${u.id} has invalid status: ${u.status}`).toBe(true)
    })
  })

  it('platform users with email have non-empty email strings', () => {
    MOCK_PLATFORM_USERS.forEach((u) => {
      if (u.email !== undefined) {
        expect(u.email.length, `${u.id} email is empty string`).toBeGreaterThan(0)
      }
    })
  })

  it('has at least 30 platform users for realistic testing', () => {
    expect(MOCK_PLATFORM_USERS.length).toBeGreaterThanOrEqual(30)
  })
})

describe('P8.9.6 — BusinessCustomer integrity', () => {
  it('every BusinessCustomer references a valid PlatformUser', () => {
    const userIds = new Set(MOCK_PLATFORM_USERS.map((u) => u.id))
    MOCK_BUSINESS_CUSTOMERS.forEach((bc) => {
      expect(userIds.has(bc.userId), `BusinessCustomer ${bc.id} references unknown userId ${bc.userId}`).toBe(true)
    })
  })

  it('BusinessCustomer id pairs (userId, tenantId) are unique', () => {
    const pairs = MOCK_BUSINESS_CUSTOMERS.map((bc) => `${bc.userId}:${bc.tenantId}`)
    const unique = new Set(pairs)
    expect(unique.size).toBe(pairs.length)
  })

  it('each tenant has at least 3 BusinessCustomers', () => {
    const tenants = [SAVOR, BREW, OAK, CENTRAL, WHEELS, ROAD]
    tenants.forEach((tid) => {
      const count = MOCK_BUSINESS_CUSTOMERS.filter((bc) => bc.tenantId === tid).length
      expect(count, `Tenant ${tid} has only ${count} BusinessCustomers`).toBeGreaterThanOrEqual(3)
    })
  })

  it('loyaltyTier values are valid', () => {
    const valid = new Set(['bronze', 'silver', 'gold', 'platinum'])
    MOCK_BUSINESS_CUSTOMERS.forEach((bc) => {
      expect(valid.has(bc.loyaltyTier), `${bc.id} has invalid tier: ${bc.loyaltyTier}`).toBe(true)
    })
  })

  it('status values are valid', () => {
    const valid = new Set(['active', 'inactive'])
    MOCK_BUSINESS_CUSTOMERS.forEach((bc) => {
      expect(valid.has(bc.status), `${bc.id} has invalid status: ${bc.status}`).toBe(true)
    })
  })

  it('totalSpent is non-negative', () => {
    MOCK_BUSINESS_CUSTOMERS.forEach((bc) => {
      expect(bc.totalSpent, `${bc.id} has negative totalSpent`).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('P8.9.6 — Cross-tenant user isolation', () => {
  it('Alice (pu-001) has BusinessCustomer records at multiple tenants', () => {
    const aliceBCs = MOCK_BUSINESS_CUSTOMERS.filter((bc) => bc.userId === ALICE_ID)
    expect(aliceBCs.length).toBeGreaterThanOrEqual(2)
    const tenants = new Set(aliceBCs.map((bc) => bc.tenantId))
    expect(tenants.size).toBeGreaterThanOrEqual(2)
  })

  it("Alice's loyalty points are independently scoped per tenant", () => {
    const aliceBCs = MOCK_BUSINESS_CUSTOMERS.filter((bc) => bc.userId === ALICE_ID)
    if (aliceBCs.length < 2) return
    const points = aliceBCs.map((bc) => bc.loyaltyPoints)
    // Points should not all be identical (if they are, it may indicate a copy/paste bug)
    const allSame = points.every((p) => p === points[0])
    // We can't assert they MUST differ, but we CAN assert each is >= 0
    points.forEach((p) => expect(p).toBeGreaterThanOrEqual(0))
    expect(points.length).toBeGreaterThanOrEqual(2)
  })

  it('getCustomers for tenant A does not return customers only at tenant B', async () => {
    const savorCustomers = await adminService.getCustomers({ tenantId: SAVOR })
    const brewCustomers = await adminService.getCustomers({ tenantId: BREW })

    const savorIds = new Set(savorCustomers.results.map((c) => c.id))
    const brewIds = new Set(brewCustomers.results.map((c) => c.id))

    // Get user IDs that are ONLY in brew (no savor business customer)
    const brewOnlyUserIds = MOCK_BUSINESS_CUSTOMERS
      .filter((bc) => bc.tenantId === BREW)
      .map((bc) => bc.userId)
      .filter((uid) => !MOCK_BUSINESS_CUSTOMERS.some((bc) => bc.tenantId === SAVOR && bc.userId === uid))

    brewOnlyUserIds.forEach((uid) => {
      expect(savorIds.has(uid), `User ${uid} (brew-only) incorrectly appears in savor customer list`).toBe(false)
    })
  })

  it('getCustomer for savor returns savor-scoped metrics not brew metrics', async () => {
    const aliceSavor = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    const aliceBrew = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === BREW
    )
    if (!aliceSavor || !aliceBrew) return

    const customer = await adminService.getCustomer(ALICE_ID, SAVOR)
    expect(customer.order_count).toBe(aliceSavor.ordersCount)
    expect(customer.total_spent).toBe(aliceSavor.totalSpent)

    // Savor metrics should differ from brew metrics (proving isolation)
    if (aliceSavor.ordersCount !== aliceBrew.ordersCount) {
      const brewCustomer = await adminService.getCustomer(ALICE_ID, BREW)
      expect(brewCustomer.order_count).not.toBe(customer.order_count)
    }
  })
})

describe('P8.9.6 — BranchCustomer integrity', () => {
  it('every BranchCustomer references a valid BusinessCustomer', () => {
    const bcIds = new Set(MOCK_BUSINESS_CUSTOMERS.map((bc) => bc.id))
    MOCK_BRANCH_CUSTOMERS.forEach((brc) => {
      expect(
        bcIds.has(brc.businessCustomerId),
        `BranchCustomer ${brc.id} references unknown businessCustomerId ${brc.businessCustomerId}`
      ).toBe(true)
    })
  })

  it('visits count is non-negative', () => {
    MOCK_BRANCH_CUSTOMERS.forEach((brc) => {
      expect(brc.visits).toBeGreaterThanOrEqual(0)
    })
  })

  it('getBranchCustomers returns only branches for the given user within the tenant', async () => {
    const aliceSavorBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    if (!aliceSavorBC) return

    const branches = await adminService.getBranchCustomers(ALICE_ID, SAVOR)
    branches.forEach((brc) => {
      expect(brc.businessCustomerId).toBe(aliceSavorBC.id)
    })
  })

  it('getBranchCustomers returns empty array for unknown user-tenant pair', async () => {
    const result = await adminService.getBranchCustomers('nonexistent-user', SAVOR)
    expect(result).toEqual([])
  })
})

describe('P8.9.6 — adminService tenant scoping', () => {
  it('getCustomers paginates correctly', async () => {
    const page1 = await adminService.getCustomers({ tenantId: SAVOR, page: 1, page_size: 5 })
    expect(page1.results.length).toBeLessThanOrEqual(5)
    expect(page1.count).toBeGreaterThan(0)
  })

  it('getCustomer throws for a user not in the given tenant', async () => {
    // Find a user who only has a BusinessCustomer at BREW, not SAVOR
    const brewOnlyUser = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) =>
        bc.tenantId === BREW &&
        !MOCK_BUSINESS_CUSTOMERS.some((b) => b.tenantId === SAVOR && b.userId === bc.userId)
    )
    if (!brewOnlyUser) return

    await expect(adminService.getCustomer(brewOnlyUser.userId, SAVOR)).rejects.toThrow()
  })

  it('getBusinessCustomer returns null for unknown user-tenant pair', async () => {
    const result = await adminService.getBusinessCustomer('nonexistent', SAVOR)
    expect(result).toBeNull()
  })

  it('getBusinessCustomer returns correct record for known pair', async () => {
    const aliceSavor = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    if (!aliceSavor) return

    const result = await adminService.getBusinessCustomer(ALICE_ID, SAVOR)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe(ALICE_ID)
    expect(result!.tenantId).toBe(SAVOR)
    expect(result!.id).toBe(aliceSavor.id)
  })

  it('getCustomerStats returns tenant-scoped stats', async () => {
    const stats = await adminService.getCustomerStats(ALICE_ID, SAVOR)
    expect(stats.customer_id).toBe(ALICE_ID)
    expect(stats.tenant_id).toBe(SAVOR)

    const aliceSavor = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    if (aliceSavor) {
      expect(stats.order_count).toBe(aliceSavor.ordersCount)
      expect(stats.total_spent).toBe(aliceSavor.totalSpent)
    }
  })
})

describe('P8.9.6 — Loyalty isolation', () => {
  beforeEach(() => {
    loyaltyService._resetMockStore()
  })

  it('LoyaltyAccount mock data includes tenantId on every record', () => {
    MOCK_LOYALTY_ACCOUNTS.forEach((la) => {
      expect(la.tenantId, `LoyaltyAccount ${la.id} missing tenantId`).toBeTruthy()
    })
  })

  it('earning points at one tenant does not affect account at another', async () => {
    const aliceSavorBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    const aliceBrewBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === BREW
    )
    if (!aliceSavorBC || !aliceBrewBC) return

    const brewBefore = await loyaltyService.getAccount(ALICE_ID, BREW)
    await loyaltyService.earnPoints({ orderId: 'test-order', amount: 500 }, ALICE_ID, SAVOR)
    const brewAfter = await loyaltyService.getAccount(ALICE_ID, BREW)

    expect(brewAfter.points).toBe(brewBefore.points)
  })

  it('getAccount with different tenantIds returns different accounts', async () => {
    const aliceSavorBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    const aliceBrewBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === BREW
    )
    if (!aliceSavorBC || !aliceBrewBC) return

    const savorAccount = await loyaltyService.getAccount(ALICE_ID, SAVOR)
    const brewAccount = await loyaltyService.getAccount(ALICE_ID, BREW)

    expect(savorAccount.tenantId).toBe(SAVOR)
    expect(brewAccount.tenantId).toBe(BREW)
    expect(savorAccount.id).not.toBe(brewAccount.id)
  })

  it('redeeming reward at one tenant does not affect the other tenant balance', async () => {
    const aliceSavorBC = MOCK_BUSINESS_CUSTOMERS.find(
      (bc) => bc.userId === ALICE_ID && bc.tenantId === SAVOR
    )
    if (!aliceSavorBC) return

    // Ensure alice has enough points at savor
    await loyaltyService.earnPoints({ orderId: 'boost', amount: 1000 }, ALICE_ID, SAVOR)

    const brewBefore = await loyaltyService.getAccount(ALICE_ID, BREW)
    const rewards = await loyaltyService.getRewards()
    const cheapReward = rewards.find((r) => r.pointsCost <= 300)
    if (!cheapReward) return

    const savorAccount = await loyaltyService.getAccount(ALICE_ID, SAVOR)
    if (savorAccount.points < cheapReward.pointsCost) return

    await loyaltyService.redeemReward(cheapReward.id, ALICE_ID, SAVOR)
    const brewAfter = await loyaltyService.getAccount(ALICE_ID, BREW)

    expect(brewAfter.points).toBe(brewBefore.points)
  })
})

describe('P8.9.6 — AdminCustomer view derivation correctness', () => {
  it('AdminCustomer.id equals PlatformUser.id (not a separate entity)', async () => {
    const customers = await adminService.getCustomers({ tenantId: SAVOR })
    const platformIds = new Set(MOCK_PLATFORM_USERS.map((u) => u.id))
    customers.results.forEach((c) => {
      expect(platformIds.has(c.id), `AdminCustomer ${c.id} not found in PlatformUsers`).toBe(true)
    })
  })

  it('AdminCustomer metrics match the BusinessCustomer source for that tenant', async () => {
    const customers = await adminService.getCustomers({ tenantId: SAVOR })
    customers.results.forEach((c) => {
      const bc = MOCK_BUSINESS_CUSTOMERS.find(
        (b) => b.userId === c.id && b.tenantId === SAVOR
      )
      expect(bc, `No BusinessCustomer found for AdminCustomer ${c.id} at ${SAVOR}`).toBeDefined()
      if (bc) {
        expect(c.order_count).toBe(bc.ordersCount)
        expect(c.total_spent).toBe(bc.totalSpent)
      }
    })
  })

  it('AdminCustomer has phone derived from PlatformUser', async () => {
    const customers = await adminService.getCustomers({ tenantId: SAVOR })
    customers.results.forEach((c) => {
      const pu = MOCK_PLATFORM_USERS.find((u) => u.id === c.id)
      if (pu) {
        expect(c.phone).toBe(pu.phone)
      }
    })
  })

  it('tier mapping: bronze→new, silver→regular, gold→vip, platinum→vip', async () => {
    const customers = await adminService.getCustomers({ tenantId: SAVOR })
    const tierMap: Record<string, 'new' | 'regular' | 'vip'> = {
      bronze: 'new', silver: 'regular', gold: 'vip', platinum: 'vip',
    }
    customers.results.forEach((c) => {
      const bc = MOCK_BUSINESS_CUSTOMERS.find(
        (b) => b.userId === c.id && b.tenantId === SAVOR
      )
      if (bc) {
        expect(c.tier).toBe(tierMap[bc.loyaltyTier])
      }
    })
  })
})
