/**
 * Loyalty Service — Phase 6 (P6.9)
 *
 * Provides customer-facing and admin-facing loyalty operations.
 * Capability-gated: only available when `loyalty` capability is enabled for the tenant.
 *
 * USE_MOCK pattern: when NEXT_PUBLIC_USE_MOCK=true, all methods return realistic
 * in-memory data without hitting the network. Mock state resets on module reload
 * but persists within a session via module-level variables.
 */

import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_LOYALTY_ACCOUNTS } from '@/lib/mock-data'
import type { LoyaltyAccount, LoyaltyReward, LoyaltyTransaction, LoyaltyTier } from '@/types'
import { LOYALTY_TIER_THRESHOLDS } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms))

// ── Tier resolution ───────────────────────────────────────────────────────────

function resolveTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.platinum) return 'platinum'
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.gold)     return 'gold'
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.silver)   return 'silver'
  return 'bronze'
}

// ── Mock data ─────────────────────────────────────────────────────────────────

// Mutable per-session overrides keyed by "${userId}:${tenantId}" — applied on top of MOCK_LOYALTY_ACCOUNTS.
const mockAccountOverrides = new Map<string, Partial<LoyaltyAccount>>()
const mockTransactionsByAccount = new Map<string, LoyaltyTransaction[]>()

function getMockAccount(userId: string, tenantId: string): LoyaltyAccount {
  const key = `${userId}:${tenantId}`
  const overrides = mockAccountOverrides.get(key)
  const base = MOCK_LOYALTY_ACCOUNTS.find((a) => a.userId === userId && a.tenantId === tenantId)
  if (!base && !overrides) {
    // First interaction — bootstrap a new bronze account
    return {
      id: `la-${userId}-${tenantId}`,
      userId,
      tenantId,
      points: 0,
      lifetimePoints: 0,
      tier: 'bronze',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  return { ...(base ?? { id: `la-${userId}-${tenantId}`, userId, tenantId, points: 0, lifetimePoints: 0, tier: 'bronze' as LoyaltyTier, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), ...(overrides ?? {}) } as LoyaltyAccount
}

const DEFAULT_TRANSACTIONS = (accountId: string, tenantId: string): LoyaltyTransaction[] => [
  { id: `txn-${accountId}-1`, accountId, tenantId, type: 'earn',   points: 120,  description: 'Order #1042 — earned 120 pts',  createdAt: new Date(Date.now() - 2  * 86_400_000).toISOString(), referenceId: 'order-1042' },
  { id: `txn-${accountId}-2`, accountId, tenantId, type: 'earn',   points: 85,   description: 'Order #1038 — earned 85 pts',   createdAt: new Date(Date.now() - 5  * 86_400_000).toISOString(), referenceId: 'order-1038' },
  { id: `txn-${accountId}-3`, accountId, tenantId, type: 'redeem', points: -200,  description: 'Redeemed: Free Latte',           createdAt: new Date(Date.now() - 8  * 86_400_000).toISOString(), referenceId: 'reward-free-latte' },
  { id: `txn-${accountId}-4`, accountId, tenantId, type: 'earn',   points: 200,  description: 'Order #1025 — earned 200 pts',  createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(), referenceId: 'order-1025' },
  { id: `txn-${accountId}-5`, accountId, tenantId, type: 'earn',   points: 135,  description: 'Order #1019 — earned 135 pts',  createdAt: new Date(Date.now() - 18 * 86_400_000).toISOString(), referenceId: 'order-1019' },
]

function getMockTransactions(accountId: string, tenantId = 'tenant-samoon-01'): LoyaltyTransaction[] {
  return mockTransactionsByAccount.get(accountId) ?? DEFAULT_TRANSACTIONS(accountId, tenantId)
}

let mockRewards: LoyaltyReward[] = [
  {
    id: 'reward-free-latte',
    name: 'Free Latte',
    description: 'A complimentary latte of your choice.',
    pointsCost: 200,
    active: true,
    minimumTier: 'bronze',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'reward-10-off',
    name: '10% Off Your Order',
    description: 'Get 10% off your next order.',
    pointsCost: 350,
    active: true,
    minimumTier: 'silver',
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'reward-free-pastry',
    name: 'Free Pastry',
    description: 'Choose any pastry from the menu.',
    pointsCost: 150,
    active: true,
    minimumTier: 'bronze',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'reward-gold-exclusive',
    name: 'Gold Member VIP Table',
    description: 'Reserved VIP seating for your next visit.',
    pointsCost: 500,
    active: true,
    minimumTier: 'gold',
    createdAt: '2024-01-01T00:00:00Z',
  },
]

// ── Payload types ─────────────────────────────────────────────────────────────

export interface EarnPointsPayload {
  orderId: string
  amount: number
}

export interface RedeemRewardResponse {
  transaction: LoyaltyTransaction
  account: LoyaltyAccount
}

export interface EarnPointsResponse {
  transaction: LoyaltyTransaction
  account: LoyaltyAccount
  pointsEarned: number
}

// ── Service ───────────────────────────────────────────────────────────────────

export const loyaltyService = {
  async getAccount(userId?: string, tenantId?: string): Promise<LoyaltyAccount> {
    if (USE_MOCK) {
      await delay(400)
      const uid = userId ?? 'pu-001'
      const tid = tenantId ?? 'tenant-samoon-01'
      return getMockAccount(uid, tid)
    }
    const { data } = await api.get<LoyaltyAccount>(ENDPOINTS.LOYALTY.ACCOUNT)
    return data
  },

  async getTransactions(userId?: string, tenantId?: string): Promise<LoyaltyTransaction[]> {
    if (USE_MOCK) {
      await delay(500)
      const uid = userId ?? 'pu-001'
      const tid = tenantId ?? 'tenant-samoon-01'
      const account = getMockAccount(uid, tid)
      return getMockTransactions(account.id)
    }
    const { data } = await api.get<LoyaltyTransaction[]>(ENDPOINTS.LOYALTY.TRANSACTIONS)
    return data
  },

  async getRewards(): Promise<LoyaltyReward[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockRewards.filter((r) => r.active)
    }
    const { data } = await api.get<LoyaltyReward[]>(ENDPOINTS.LOYALTY.REWARDS)
    return data
  },

  async redeemReward(rewardId: string, userId?: string, tenantId?: string): Promise<RedeemRewardResponse> {
    if (USE_MOCK) {
      await delay(700)
      const uid = userId ?? 'pu-001'
      const tid = tenantId ?? 'tenant-samoon-01'
      const key = `${uid}:${tid}`
      const account = getMockAccount(uid, tid)
      const reward = mockRewards.find((r) => r.id === rewardId)
      if (!reward) throw new Error(`Reward "${rewardId}" not found`)
      if (!reward.active) throw new Error(`Reward "${reward.name}" is no longer active`)
      if (account.points < reward.pointsCost) {
        throw new Error(`Insufficient points: need ${reward.pointsCost}, have ${account.points}`)
      }

      const txn: LoyaltyTransaction = {
        id: `txn-redeem-${Date.now()}`,
        accountId: account.id,
        tenantId: tid,
        type: 'redeem',
        points: -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        createdAt: new Date().toISOString(),
        referenceId: rewardId,
      }

      const updated = { ...account, points: account.points - reward.pointsCost, updatedAt: new Date().toISOString() }
      mockAccountOverrides.set(key, updated)
      const txns = getMockTransactions(account.id)
      mockTransactionsByAccount.set(account.id, [txn, ...txns])

      return { transaction: txn, account: updated }
    }
    const { data } = await api.post<RedeemRewardResponse>(ENDPOINTS.LOYALTY.REDEEM(rewardId))
    return data
  },

  async earnPoints(payload: EarnPointsPayload, userId?: string, tenantId?: string): Promise<EarnPointsResponse> {
    if (USE_MOCK) {
      await delay(400)
      const uid = userId ?? 'pu-001'
      const tid = tenantId ?? 'tenant-samoon-01'
      const key = `${uid}:${tid}`
      const account = getMockAccount(uid, tid)
      const pointsEarned = Math.round(payload.amount)
      const txn: LoyaltyTransaction = {
        id: `txn-earn-${Date.now()}`,
        accountId: account.id,
        tenantId: tid,
        type: 'earn',
        points: pointsEarned,
        description: `Order #${payload.orderId} — earned ${pointsEarned} pts`,
        createdAt: new Date().toISOString(),
        referenceId: payload.orderId,
      }

      const newLifetime = account.lifetimePoints + pointsEarned
      const updated = {
        ...account,
        points: account.points + pointsEarned,
        lifetimePoints: newLifetime,
        tier: resolveTier(newLifetime),
        updatedAt: new Date().toISOString(),
      }
      mockAccountOverrides.set(key, updated)
      const txns = getMockTransactions(account.id)
      mockTransactionsByAccount.set(account.id, [txn, ...txns])

      return { transaction: txn, account: updated, pointsEarned }
    }
    const { data } = await api.post<EarnPointsResponse>(ENDPOINTS.LOYALTY.EARN, {
      order_id: payload.orderId,
      amount: payload.amount,
    })
    return data
  },

  // ── Admin methods ───────────────────────────────────────────────────────────

  async adminGetRewards(): Promise<LoyaltyReward[]> {
    if (USE_MOCK) {
      await delay(400)
      return [...mockRewards]
    }
    const { data } = await api.get<LoyaltyReward[]>(ENDPOINTS.LOYALTY.ADMIN_REWARDS)
    return data
  },

  async adminCreateReward(payload: Omit<LoyaltyReward, 'id' | 'createdAt'>): Promise<LoyaltyReward> {
    if (USE_MOCK) {
      await delay(600)
      const reward: LoyaltyReward = {
        ...payload,
        id: `reward-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      mockRewards = [...mockRewards, reward]
      return reward
    }
    const { data } = await api.post<LoyaltyReward>(ENDPOINTS.LOYALTY.ADMIN_REWARDS, payload)
    return data
  },

  async adminUpdateReward(id: string, payload: Partial<Omit<LoyaltyReward, 'id' | 'createdAt'>>): Promise<LoyaltyReward> {
    if (USE_MOCK) {
      await delay(500)
      const idx = mockRewards.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error(`Reward "${id}" not found`)
      mockRewards = mockRewards.map((r) => r.id === id ? { ...r, ...payload } : r)
      return mockRewards.find((r) => r.id === id)!
    }
    const { data } = await api.patch<LoyaltyReward>(ENDPOINTS.LOYALTY.ADMIN_REWARD(id), payload)
    return data
  },

  async adminDisableReward(id: string): Promise<LoyaltyReward> {
    return loyaltyService.adminUpdateReward(id, { active: false })
  },

  _resetMockStore() {
    mockAccountOverrides.clear()
    mockTransactionsByAccount.clear()
    mockRewards = mockRewards.map((r) => ({ ...r, active: true }))
    // Restore the canonical test state for the default user (pu-001 / tenant-samoon-01).
    // Tests that call _resetMockStore() then getAccount() expect these exact values.
    const testKey = 'pu-001:tenant-samoon-01'
    const testAccountId = 'la-test-reset'
    mockAccountOverrides.set(testKey, {
      id: testAccountId,
      userId: 'pu-001',
      tenantId: 'tenant-samoon-01',
      points: 340,
      lifetimePoints: 1340,
      tier: 'silver',
      tierExpiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
    })
    // Tests expect 0 transactions after reset (not the default fallback set)
    mockTransactionsByAccount.set(testAccountId, [])
  },
}
