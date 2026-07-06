'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useAdminLoyaltyRewards,
  useAdminCreateReward,
  useAdminUpdateReward,
  useAdminDisableReward,
} from '@/hooks'
import type { LoyaltyReward, LoyaltyTier } from '@/types'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'

const TIERS: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']

interface RewardFormState {
  name: string
  description: string
  pointsCost: number
  minimumTier: LoyaltyTier | ''
  expiresAt: string
}

const DEFAULT_FORM: RewardFormState = {
  name: '',
  description: '',
  pointsCost: 100,
  minimumTier: '',
  expiresAt: '',
}

function rewardToForm(r: LoyaltyReward): RewardFormState {
  return {
    name: r.name,
    description: r.description,
    pointsCost: r.pointsCost,
    minimumTier: r.minimumTier ?? '',
    expiresAt: r.expiresAt ? r.expiresAt.slice(0, 10) : '',
  }
}

function formToPayload(f: RewardFormState): Omit<LoyaltyReward, 'id' | 'createdAt'> {
  return {
    name: f.name,
    description: f.description,
    pointsCost: f.pointsCost,
    active: true,
    minimumTier: f.minimumTier || undefined,
    expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : undefined,
  }
}

interface RewardModalProps {
  title: string
  form: RewardFormState
  onChange: (f: RewardFormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}

function RewardModal({ title, form, onChange, onSubmit, onCancel, isPending, submitLabel }: RewardModalProps) {
  const t = useTranslations('console')
  const tLoyalty = useTranslations('loyalty')
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-4">
        <h2 id="modal-title" className="text-lg font-semibold text-[var(--fg)]">{title}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('name')}</label>
            <input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('pointsCost')}</label>
            <input
              type="number"
              min={1}
              value={form.pointsCost}
              onChange={(e) => onChange({ ...form, pointsCost: Number(e.target.value) })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('minimumTierOptional')}</label>
            <select
              value={form.minimumTier}
              onChange={(e) => onChange({ ...form, minimumTier: e.target.value as LoyaltyTier | '' })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              <option value="">{t('anyTier')}</option>
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>{tLoyalty(`tiers.${tier}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('expiresAtOptional')}</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => onChange({ ...form, expiresAt: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[var(--fg-muted)] border border-[var(--border)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !form.name || !form.description}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40"
          >
            {isPending ? t('savingEllipsis') : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoyaltyPage() {
  const t = useTranslations('console')
  const tLoyalty = useTranslations('loyalty')
  const { data: rewards, isLoading } = useAdminLoyaltyRewards()
  const createMutation = useAdminCreateReward()
  const updateMutation = useAdminUpdateReward()
  const disableMutation = useAdminDisableReward()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<LoyaltyReward | null>(null)
  const [createForm, setCreateForm] = useState<RewardFormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<RewardFormState>(DEFAULT_FORM)

  function handleCreate() {
    createMutation.mutate(formToPayload(createForm), {
      onSuccess: () => {
        setShowCreate(false)
        setCreateForm(DEFAULT_FORM)
      },
    })
  }

  function openEdit(reward: LoyaltyReward) {
    setEditTarget(reward)
    setEditForm(rewardToForm(reward))
  }

  function handleEdit() {
    if (!editTarget) return
    updateMutation.mutate(
      { id: editTarget.id, payload: formToPayload(editForm) },
      { onSuccess: () => setEditTarget(null) },
    )
  }

  return (
    <ErrorBoundary feature="Loyalty Management">
    <PermissionGuard permission="loyalty.view" fallback={<AccessDenied />}>
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg)]">{t('loyaltyManagement')}</h1>
        <div className="flex items-center gap-2">
          <PreviewButton href="/loyalty" label={t('previewLoyalty')} size="sm" />
        <button
          onClick={() => { setShowCreate(true); setCreateForm(DEFAULT_FORM) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white"
          aria-label={t('createReward')}
        >
          + {t('createReward')}
        </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">{t('loadingRewards')}</p>
      ) : !rewards?.length ? (
        <p className="text-[var(--fg-muted)]">{t('noRewardsConfigured')}</p>
      ) : (
        <ul className="space-y-3">
          {rewards.map((reward) => (
            <li
              key={reward.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--fg)]">{reward.name}</p>
                  {!reward.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      {t('disabled')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--fg-muted)] truncate">{reward.description}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-1">{tLoyalty('pointsSuffix', { count: reward.pointsCost })}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(reward)}
                  aria-label={t('editNameAria', { name: reward.name })}
                  className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] text-[var(--fg)]"
                >
                  {t('edit')}
                </button>
                {reward.active && (
                  <button
                    onClick={() => disableMutation.mutate(reward.id)}
                    disabled={disableMutation.isPending}
                    aria-label={t('disableNameAria', { name: reward.name })}
                    className="px-3 py-1 rounded-lg text-sm border border-red-300 text-red-600 disabled:opacity-40"
                  >
                    {t('disable')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <RewardModal
          title={t('createReward')}
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          submitLabel={t('create')}
        />
      )}

      {editTarget && (
        <RewardModal
          title={t('editReward')}
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
          isPending={updateMutation.isPending}
          submitLabel={t('save')}
        />
      )}
    </main>
  
    </PermissionGuard>
    </ErrorBoundary>

  )
}
