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

let mockAccount: LoyaltyAccount = {
  id: 'loyalty-account-mock-1',
  userId: 'user-mock-1',
  points: 340,
  lifetimePoints: 1340,
  tier: 'silver',
  tierExpiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: new Date().toISOString(),
}

let mockTransactions: LoyaltyTransaction[] = [
  {
    id: 'txn-1',
    accountId: mockAccount.id,
    type: 'earn',
    points: 120,
    description: 'Order #1042 — earned 120 pts',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    referenceId: 'order-1042',
  },
  {
    id: 'txn-2',
    accountId: mockAccount.id,
    type: 'earn',
    points: 85,
    description: 'Order #1038 — earned 85 pts',
    createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    referenceId: 'order-1038',
  },
  {
    id: 'txn-3',
    accountId: mockAccount.id,
    type: 'redeem',
    points: -200,
    description: 'Redeemed: Free Latte',
    createdAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    referenceId: 'reward-free-latte',
  },
  {
    id: 'txn-4',
    accountId: mockAccount.id,
    type: 'earn',
    points: 200,
    description: 'Order #1025 — earned 200 pts',
    createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    referenceId: 'order-1025',
  },
  {
    id: 'txn-5',
    accountId: mockAccount.id,
    type: 'earn',
    points: 135,
    description: 'Order #1019 — earned 135 pts',
    createdAt: new Date(Date.now() - 18 * 86_400_000).toISOString(),
    referenceId: 'order-1019',
  },
]

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
  async getAccount(): Promise<LoyaltyAccount> {
    if (USE_MOCK) {
      await delay(400)
      return { ...mockAccount }
    }
    const { data } = await api.get<LoyaltyAccount>(ENDPOINTS.LOYALTY.ACCOUNT)
    return data
  },

  async getTransactions(): Promise<LoyaltyTransaction[]> {
    if (USE_MOCK) {
      await delay(500)
      return [...mockTransactions]
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

  async redeemReward(rewardId: string): Promise<RedeemRewardResponse> {
    if (USE_MOCK) {
      await delay(700)
      const reward = mockRewards.find((r) => r.id === rewardId)
      if (!reward) throw new Error(`Reward "${rewardId}" not found`)
      if (!reward.active) throw new Error(`Reward "${reward.name}" is no longer active`)
      if (mockAccount.points < reward.pointsCost) {
        throw new Error(`Insufficient points: need ${reward.pointsCost}, have ${mockAccount.points}`)
      }

      const txn: LoyaltyTransaction = {
        id: `txn-redeem-${Date.now()}`,
        accountId: mockAccount.id,
        type: 'redeem',
        points: -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        createdAt: new Date().toISOString(),
        referenceId: rewardId,
      }

      mockAccount = {
        ...mockAccount,
        points: mockAccount.points - reward.pointsCost,
        updatedAt: new Date().toISOString(),
      }
      mockTransactions = [txn, ...mockTransactions]

      return { transaction: txn, account: { ...mockAccount } }
    }
    const { data } = await api.post<RedeemRewardResponse>(ENDPOINTS.LOYALTY.REDEEM(rewardId))
    return data
  },

  async earnPoints(payload: EarnPointsPayload): Promise<EarnPointsResponse> {
    if (USE_MOCK) {
      await delay(400)
      // 1 point per unit of currency (rounded)
      const pointsEarned = Math.round(payload.amount)
      const txn: LoyaltyTransaction = {
        id: `txn-earn-${Date.now()}`,
        accountId: mockAccount.id,
        type: 'earn',
        points: pointsEarned,
        description: `Order #${payload.orderId} — earned ${pointsEarned} pts`,
        createdAt: new Date().toISOString(),
        referenceId: payload.orderId,
      }

      const newLifetime = mockAccount.lifetimePoints + pointsEarned
      mockAccount = {
        ...mockAccount,
        points: mockAccount.points + pointsEarned,
        lifetimePoints: newLifetime,
        tier: resolveTier(newLifetime),
        updatedAt: new Date().toISOString(),
      }
      mockTransactions = [txn, ...mockTransactions]

      return { transaction: txn, account: { ...mockAccount }, pointsEarned }
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
    mockAccount = {
      id: 'loyalty-account-mock-1',
      userId: 'user-mock-1',
      points: 340,
      lifetimePoints: 1340,
      tier: 'silver',
      tierExpiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
    }
    mockTransactions = []
    mockRewards = mockRewards.map((r) => ({ ...r, active: true }))
  },
}
