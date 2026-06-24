'use client'

import { useState } from 'react'
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

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'percentage_discount', label: '% Discount' },
  { value: 'fixed_discount',      label: 'Fixed Discount' },
  { value: 'buy_one_get_one',     label: 'Buy One Get One' },
  { value: 'happy_hour',          label: 'Happy Hour' },
]

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-4 my-8">
        <h2 id="promo-modal-title" className="text-lg font-semibold text-[var(--fg)]">{title}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-1">Promotion Type</label>
            <select
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value as PromotionType })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              {PROMOTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {showPercent && (
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">Discount %</label>
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
              <label className="text-sm text-[var(--fg-muted)] block mb-1">Discount Amount ($)</label>
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
              <label className="text-sm text-[var(--fg-muted)] block mb-1">Start</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => onChange({ ...form, startAt: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">End (optional)</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => onChange({ ...form, endAt: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--fg-muted)] block mb-2">Weekdays (optional)</label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    form.weekdays.includes(d.value)
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">Time from (optional)</label>
              <input
                type="time"
                value={form.timeWindowStart}
                onChange={(e) => onChange({ ...form, timeWindowStart: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] block mb-1">Time to (optional)</label>
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
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !form.name || !form.description}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40"
          >
            {isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const TYPE_LABELS: Record<PromotionType, string> = {
  percentage_discount: '% Off',
  fixed_discount:      'Fixed',
  buy_one_get_one:     'BOGO',
  happy_hour:          'Happy Hour',
}

export default function AdminPromotionsPage() {
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

    <PermissionGuard permission="promotions.view">
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg)]">Promotion Management</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateForm(DEFAULT_FORM) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white"
          aria-label="Create promotion"
        >
          + Create Promotion
        </button>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">Loading promotions…</p>
      ) : !promotions?.length ? (
        <p className="text-[var(--fg-muted)]">No promotions configured.</p>
      ) : (
        <ul className="space-y-3">
          {promotions.map((promo) => (
            <li
              key={promo.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    {TYPE_LABELS[promo.type]}
                  </span>
                  {!promo.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="font-medium text-[var(--fg)] mt-1">{promo.name}</p>
                <p className="text-sm text-[var(--fg-muted)] truncate">{promo.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(promo)}
                  aria-label={`Edit ${promo.name}`}
                  className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] text-[var(--fg)]"
                >
                  Edit
                </button>
                {promo.active ? (
                  <button
                    onClick={() => disableMutation.mutate(promo.id)}
                    disabled={disableMutation.isPending}
                    aria-label={`Disable ${promo.name}`}
                    className="px-3 py-1 rounded-lg text-sm border border-red-300 text-red-600 disabled:opacity-40"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => activateMutation.mutate(promo.id)}
                    disabled={activateMutation.isPending}
                    aria-label={`Activate ${promo.name}`}
                    className="px-3 py-1 rounded-lg text-sm border border-green-300 text-green-700 disabled:opacity-40"
                  >
                    Activate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <PromotionModal
          title="Create Promotion"
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          submitLabel="Create"
        />
      )}

      {editTarget && (
        <PromotionModal
          title="Edit Promotion"
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
          isPending={updateMutation.isPending}
          submitLabel="Save"
        />
      )}
    </main>
  
    </PermissionGuard>

  )
}
