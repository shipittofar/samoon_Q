'use client'

import { useTranslations } from 'next-intl'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import {
  useLoyaltyAccount,
  useLoyaltyTransactions,
  useLoyaltyRewards,
  useRedeemReward,
} from '@/hooks'

const TIER_KEYS: Record<string, string> = {
  bronze:   'bronze',
  silver:   'silver',
  gold:     'gold',
  platinum: 'platinum',
}

const TIER_COLORS: Record<string, string> = {
  bronze:   'text-[var(--warning-text)]',
  silver:   'text-[var(--fg-muted)]',
  gold:     'text-[var(--rating)]',
  platinum: 'text-[var(--chart-5)]',
}

function LoyaltyContent() {
  const t = useTranslations('loyalty')
  const { data: account, isLoading: accountLoading } = useLoyaltyAccount()
  const { data: transactions, isLoading: txLoading } = useLoyaltyTransactions()
  const { data: rewards, isLoading: rewardsLoading } = useLoyaltyRewards()
  const redeemMutation = useRedeemReward()

  if (accountLoading) {
    return <p className="text-[var(--fg-muted)]">{t('loadingAccount')}</p>
  }

  if (!account) {
    return <p className="text-[var(--fg-muted)]">{t('noAccountFound')}</p>
  }

  const tierColor = TIER_COLORS[account.tier] ?? 'text-[var(--fg)]'

  return (
    <div className="space-y-8">
      {/* Current Points */}
      <section aria-labelledby="points-heading">
        <h2 id="points-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('currentPoints')}
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex items-center gap-6">
          <div className="text-5xl font-bold text-[var(--accent-text)]">{account.points}</div>
          <div>
            <p className="text-[var(--fg-muted)] text-sm">{t('availablePoints')}</p>
            <p className="text-[var(--fg-muted)] text-sm mt-1">
              {t('lifetime')} <span className="font-medium text-[var(--fg)]">{account.lifetimePoints}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Tier Status */}
      <section aria-labelledby="tier-heading">
        <h2 id="tier-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('tierStatus')}
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--fg-muted)] mb-1">{t('currentTier')}</p>
          <p className={`text-3xl font-bold ${tierColor}`}>{TIER_KEYS[account.tier] ? t(`tiers.${TIER_KEYS[account.tier]}`) : account.tier}</p>
          {account.tierExpiresAt && (
            <p className="text-xs text-[var(--fg-muted)] mt-2">
              {t('tierExpires', { date: new Date(account.tierExpiresAt).toLocaleDateString() })}
            </p>
          )}
        </div>
      </section>

      {/* Available Rewards */}
      <section aria-labelledby="rewards-heading">
        <h2 id="rewards-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('availableRewards')}
        </h2>
        {rewardsLoading ? (
          <p className="text-[var(--fg-muted)]">{t('loadingRewards')}</p>
        ) : !rewards?.length ? (
          <p className="text-[var(--fg-muted)]">{t('noRewardsAvailable')}</p>
        ) : (
          <ul className="space-y-3">
            {rewards.map((reward) => {
              const canAfford = account.points >= reward.pointsCost
              const isRedeeming = redeemMutation.isPending && redeemMutation.variables === reward.id
              return (
                <li
                  key={reward.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-[var(--fg)]">{reward.name}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{reward.description}</p>
                    {reward.minimumTier && (
                      <p className="text-xs text-[var(--fg-muted)] mt-1">
                        {t('requiresTier', { tier: TIER_KEYS[reward.minimumTier] ? t(`tiers.${TIER_KEYS[reward.minimumTier]}`) : reward.minimumTier })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-sm font-semibold text-[var(--accent-text)]">
                      {t('pointsSuffix', { count: reward.pointsCost })}
                    </span>
                    <button
                      onClick={() => redeemMutation.mutate(reward.id)}
                      disabled={!canAfford || isRedeeming}
                      aria-label={t('redeemAria', { name: reward.name })}
                      className="px-3 py-1 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRedeeming ? t('redeeming') : t('redeem')}
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
        <h2 id="history-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('transactionHistory')}
        </h2>
        {txLoading ? (
          <p className="text-[var(--fg-muted)]">{t('loadingTransactions')}</p>
        ) : !transactions?.length ? (
          <p className="text-[var(--fg-muted)]">{t('noTransactionsYet')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            {transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--fg)]">{txn.description}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {new Date(txn.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${txn.points >= 0 ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}
                >
                  {t('pointsSuffix', { count: txn.points >= 0 ? `+${txn.points}` : txn.points })}
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
  const t = useTranslations('loyalty')
  return (
    <CapabilityGuard
      capability="loyalty"
      fallback={<CapabilityNotAvailable capability="loyalty"/>}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">{t('loyaltyProgram')}</h1>
        <LoyaltyContent />
      </main>
    </CapabilityGuard>
  )
}
