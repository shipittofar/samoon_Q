'use client'

import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import {
  useLoyaltyAccount,
  useLoyaltyTransactions,
  useLoyaltyRewards,
  useRedeemReward,
} from '@/hooks'

const TIER_LABELS: Record<string, string> = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
}

const TIER_COLORS: Record<string, string> = {
  bronze:   'text-amber-700',
  silver:   'text-slate-500',
  gold:     'text-yellow-500',
  platinum: 'text-purple-500',
}

function LoyaltyContent() {
  const { data: account, isLoading: accountLoading } = useLoyaltyAccount()
  const { data: transactions, isLoading: txLoading } = useLoyaltyTransactions()
  const { data: rewards, isLoading: rewardsLoading } = useLoyaltyRewards()
  const redeemMutation = useRedeemReward()

  if (accountLoading) {
    return <p className="text-[var(--fg-muted)]">Loading your loyalty account…</p>
  }

  if (!account) {
    return <p className="text-[var(--fg-muted)]">No loyalty account found.</p>
  }

  const tierColor = TIER_COLORS[account.tier] ?? 'text-[var(--fg)]'

  return (
    <div className="space-y-8">
      {/* Current Points */}
      <section aria-labelledby="points-heading">
        <h2 id="points-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Current Points
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex items-center gap-6">
          <div className="text-5xl font-bold text-[var(--primary)]">{account.points}</div>
          <div>
            <p className="text-[var(--fg-muted)] text-sm">Available points</p>
            <p className="text-[var(--fg-muted)] text-sm mt-1">
              Lifetime: <span className="font-medium text-[var(--fg)]">{account.lifetimePoints}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Tier Status */}
      <section aria-labelledby="tier-heading">
        <h2 id="tier-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Tier Status
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--fg-muted)] mb-1">Current tier</p>
          <p className={`text-3xl font-bold ${tierColor}`}>{TIER_LABELS[account.tier] ?? account.tier}</p>
          {account.tierExpiresAt && (
            <p className="text-xs text-[var(--fg-muted)] mt-2">
              Tier expires {new Date(account.tierExpiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </section>

      {/* Available Rewards */}
      <section aria-labelledby="rewards-heading">
        <h2 id="rewards-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Available Rewards
        </h2>
        {rewardsLoading ? (
          <p className="text-[var(--fg-muted)]">Loading rewards…</p>
        ) : !rewards?.length ? (
          <p className="text-[var(--fg-muted)]">No rewards available.</p>
        ) : (
          <ul className="space-y-3">
            {rewards.map((reward) => {
              const canAfford = account.points >= reward.pointsCost
              const isRedeeming = redeemMutation.isPending && redeemMutation.variables === reward.id
              return (
                <li
                  key={reward.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-[var(--fg)]">{reward.name}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{reward.description}</p>
                    {reward.minimumTier && (
                      <p className="text-xs text-[var(--fg-muted)] mt-1">
                        Requires: {TIER_LABELS[reward.minimumTier] ?? reward.minimumTier} tier
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-sm font-semibold text-[var(--primary)]">
                      {reward.pointsCost} pts
                    </span>
                    <button
                      onClick={() => redeemMutation.mutate(reward.id)}
                      disabled={!canAfford || isRedeeming}
                      aria-label={`Redeem ${reward.name}`}
                      className="px-3 py-1 rounded-lg text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRedeeming ? 'Redeeming…' : 'Redeem'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Transaction History */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Transaction History
        </h2>
        {txLoading ? (
          <p className="text-[var(--fg-muted)]">Loading transactions…</p>
        ) : !transactions?.length ? (
          <p className="text-[var(--fg-muted)]">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--fg)]">{txn.description}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {new Date(txn.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${txn.points >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  {txn.points >= 0 ? `+${txn.points}` : txn.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function LoyaltyPage() {
  return (
    <CapabilityGuard
      capability="loyalty"
      fallback={<CapabilityNotAvailable capability="loyalty" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Loyalty Program</h1>
        <LoyaltyContent />
      </main>
    </CapabilityGuard>
  )
}
