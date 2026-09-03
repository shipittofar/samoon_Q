'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  usePromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useDisablePromotion,
  useActivatePromotion,
} from '@/hooks'
import type { PromotionRule, PromotionType, Weekday } from '@/types'
import type { CreatePromotionPayload } from '@/services/promotion.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

const PROMOTION_TYPES: { value: PromotionType; labelKey: string }[] = [
  { value: 'percentage_discount', labelKey: 'promoTypePercentDiscount' },
  { value: 'fixed_discount',      labelKey: 'promoTypeFixedDiscount' },
  { value: 'buy_one_get_one',     labelKey: 'promoTypeBogo' },
  { value: 'happy_hour',          labelKey: 'promoTypeHappyHour' },
]

const WEEKDAYS: { value: Weekday; labelKey: string }[] = [
  { value: 1, labelKey: 'weekdayMonShort' },
  { value: 2, labelKey: 'weekdayTueShort' },
  { value: 3, labelKey: 'weekdayWedShort' },
  { value: 4, labelKey: 'weekdayThuShort' },
  { value: 5, labelKey: 'weekdayFriShort' },
  { value: 6, labelKey: 'weekdaySatShort' },
  { value: 7, labelKey: 'weekdaySunShort' },
]

interface FormState {
  name: string
  description: string
  type: PromotionType
  discountPercent: string
  discountAmount: string
  startAt: string
  endAt: string
  weekdays: Weekday[]
  timeWindowStart: string
  timeWindowEnd: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  type: 'percentage_discount',
  discountPercent: '10',
  discountAmount: '',
  startAt: new Date().toISOString().slice(0, 16),
  endAt: '',
  weekdays: [],
  timeWindowStart: '',
  timeWindowEnd: '',
}

function promoToForm(p: PromotionRule): FormState {
  return {
    name: p.name,
    description: p.description,
    type: p.type,
    discountPercent: p.discountPercent?.toString() ?? '',
    discountAmount: p.discountAmount?.toString() ?? '',
    startAt: p.schedule.startAt.slice(0, 16),
    endAt: p.schedule.endAt?.slice(0, 16) ?? '',
    weekdays: [...(p.schedule.weekdays ?? [])],
    timeWindowStart: p.schedule.timeWindowStart ?? '',
    timeWindowEnd: p.schedule.timeWindowEnd ?? '',
  }
}

function formToPayload(f: FormState): CreatePromotionPayload {
  return {
    name: f.name,
    description: f.description,
    type: f.type,
    discountPercent: ['percentage_discount', 'happy_hour'].includes(f.type) && f.discountPercent
      ? Number(f.discountPercent)
      : undefined,
    discountAmount: f.type === 'fixed_discount' && f.discountAmount
      ? Number(f.discountAmount)
      : undefined,
    applicableItemIds: [],
    active: true,
    schedule: {
      startAt: new Date(f.startAt).toISOString(),
      endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
      weekdays: f.weekdays.length ? f.weekdays : undefined,
      timeWindowStart: f.timeWindowStart || undefined,
      timeWindowEnd: f.timeWindowEnd || undefined,
    },
  }
}

interface PromotionModalProps {
  title: string
  form: FormState
  onChange: (f: FormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}

function PromotionModal({ title, form, onChange, onSubmit, onCancel, isPending, submitLabel }: PromotionModalProps) {
  const t = useTranslations('console')
  const showPercent = ['percentage_discount', 'happy_hour'].includes(form.type)
  const showFixed = form.type === 'fixed_discount'

  const toggleWeekday = (d: Weekday) => {
    const next = form.weekdays.includes(d)
      ? form.weekdays.filter((w) => w !== d)
      : [...form.weekdays, d].sort((a, b) => a - b) as Weekday[]
    onChange({ ...form, weekdays: next })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 space-y-4 my-8 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <h2 id="promo-modal-title"className="text-lg font-semibold text-[var(--fg)]">{title}</h2>

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
            <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('promotionType')}</label>
            <select
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value as PromotionType })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              {PROMOTION_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{t(pt.labelKey)}</option>
              ))}
            </select>
          </div>

          {showPercent && (
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('discountPercentLabel')}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.discountPercent}
                onChange={(e) => onChange({ ...form, discountPercent: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
          )}

          {showFixed && (
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('discountAmountLabel')}</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={form.discountAmount}
                onChange={(e) => onChange({ ...form, discountAmount: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('startLabel')}</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => onChange({ ...form, startAt: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('endOptionalLabel')}</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => onChange({ ...form, endAt: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-2">{t('weekdaysOptionalLabel')}</label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    form.weekdays.includes(d.value)
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent-border)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)]'
                  }`}
                >
                  {t(d.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('timeFromOptionalLabel')}</label>
              <input
                type="time"
                value={form.timeWindowStart}
                onChange={(e) => onChange({ ...form, timeWindowStart: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">{t('timeToOptionalLabel')}</label>
              <input
                type="time"
                value={form.timeWindowEnd}
                onChange={(e) => onChange({ ...form, timeWindowEnd: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
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
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)] disabled:opacity-40"
          >
            {isPending ? t('savingEllipsis') : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const TYPE_BADGE_KEY: Record<PromotionType, string> = {
  percentage_discount: 'promoBadgePercentOff',
  fixed_discount:      'promoBadgeFixed',
  buy_one_get_one:     'promoBadgeBogo',
  happy_hour:          'promoTypeHappyHour',
}

export default function AdminPromotionsPage() {
  const t = useTranslations('console')
  const { data: promotions, isLoading } = usePromotions()
  const createMutation = useCreatePromotion()
  const updateMutation = useUpdatePromotion()
  const disableMutation = useDisablePromotion()
  const activateMutation = useActivatePromotion()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<PromotionRule | null>(null)
  const [createForm, setCreateForm] = useState<FormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM)

  function handleCreate() {
    createMutation.mutate(formToPayload(createForm), {
      onSuccess: () => { setShowCreate(false); setCreateForm(DEFAULT_FORM) },
    })
  }

  function openEdit(p: PromotionRule) {
    setEditTarget(p)
    setEditForm(promoToForm(p))
  }

  function handleEdit() {
    if (!editTarget) return
    updateMutation.mutate(
      { id: editTarget.id, payload: formToPayload(editForm) },
      { onSuccess: () => setEditTarget(null) },
    )
  }

  return (
    <ErrorBoundary feature="Promotion Management">
    <PermissionGuard permission="promotions.view"fallback={<AccessDenied />}>
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg)]">{t('promotionManagement')}</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateForm(DEFAULT_FORM) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)]"
          aria-label={t('createPromotion')}
        >
          + {t('createPromotion')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">{t('loadingPromotions')}</p>
      ) : !promotions?.length ? (
        <p className="text-[var(--fg-muted)]">{t('noPromotionsConfigured')}</p>
      ) : (
        <ul className="space-y-3">
          {promotions.map((promo) => (
            <li
              key={promo.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)]">
                    {t(TYPE_BADGE_KEY[promo.type])}
                  </span>
                  {!promo.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger-subtle)] text-[var(--danger-text)]">
                      {t('disabled')}
                    </span>
                  )}
                </div>
                <p className="font-medium text-[var(--fg)] mt-1">{promo.name}</p>
                <p className="text-sm text-[var(--fg-muted)] truncate">{promo.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(promo)}
                  aria-label={t('editNameAria', { name: promo.name })}
                  className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] text-[var(--fg)]"
                >
                  {t('edit')}
                </button>
                {promo.active ? (
                  <button
                    onClick={() => disableMutation.mutate(promo.id)}
                    disabled={disableMutation.isPending}
                    aria-label={t('disableNameAria', { name: promo.name })}
                    className="px-3 py-1 rounded-lg text-sm border border-[var(--danger-border)] text-[var(--danger-text)] disabled:opacity-40"
                  >
                    {t('disable')}
                  </button>
                ) : (
                  <button
                    onClick={() => activateMutation.mutate(promo.id)}
                    disabled={activateMutation.isPending}
                    aria-label={t('activateNameAria', { name: promo.name })}
                    className="px-3 py-1 rounded-lg text-sm border border-[var(--success-border)] text-[var(--success-text)] disabled:opacity-40"
                  >
                    {t('activate')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <PromotionModal
          title={t('createPromotion')}
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          submitLabel={t('create')}
        />
      )}

      {editTarget && (
        <PromotionModal
          title={t('editPromotion')}
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
