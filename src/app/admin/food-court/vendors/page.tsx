'use client'

import { useState } from 'react'
import {
  useVendors,
  useVendorStats,
  useVendorSettlements,
  useCreateVendor,
  useUpdateVendor,
  useDisableVendor,
  useCreateSettlement,
} from '@/hooks'
import type { Vendor, VendorCategory, VendorStatus } from '@/types'
import type { CreateVendorPayload } from '@/services/vendor.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'

const CATEGORIES: VendorCategory[] = [
  'asian', 'western', 'mediterranean', 'mexican', 'indian',
  'desserts', 'beverages', 'fast_food', 'healthy', 'other',
]

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  asian: 'Asian', western: 'Western', mediterranean: 'Mediterranean',
  mexican: 'Mexican', indian: 'Indian', desserts: 'Desserts',
  beverages: 'Beverages', fast_food: 'Fast Food', healthy: 'Healthy', other: 'Other',
}

const STATUS_COLORS: Record<VendorStatus, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  pending:   'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-600',
}

interface VendorFormState {
  name: string
  description: string
  category: VendorCategory
  status: VendorStatus
  commissionRate: string
  contactEmail: string
  contactPhone: string
  stallNumber: string
  featured: boolean
}

const DEFAULT_FORM: VendorFormState = {
  name: '', description: '', category: 'other', status: 'pending',
  commissionRate: '10', contactEmail: '', contactPhone: '', stallNumber: '', featured: false,
}

function vendorToForm(v: Vendor): VendorFormState {
  return {
    name: v.name, description: v.description, category: v.category, status: v.status,
    commissionRate: v.commissionRate.toString(), contactEmail: v.contactEmail,
    contactPhone: v.contactPhone ?? '', stallNumber: v.stallNumber ?? '', featured: v.featured,
  }
}

function formToPayload(f: VendorFormState): CreateVendorPayload {
  return {
    name: f.name, description: f.description, category: f.category, status: f.status,
    commissionRate: Number(f.commissionRate), contactEmail: f.contactEmail,
    contactPhone: f.contactPhone || undefined, stallNumber: f.stallNumber || undefined,
    featured: f.featured, rating: 0, ratingCount: 0,
  }
}

interface VendorFormModalProps {
  title: string
  form: VendorFormState
  onChange: (f: VendorFormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}

function VendorFormModal({ title, form, onChange, onSubmit, onCancel, isPending, submitLabel }: VendorFormModalProps) {
  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="text-sm text-[var(--fg-muted)] block mb-1">{label}</label>
      {node}
    </div>
  )
  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="vendor-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-4 my-8">
        <h2 id="vendor-modal-title" className="text-lg font-semibold text-[var(--fg)]">{title}</h2>
        <div className="space-y-3">
          {field('Name', <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} className={inputCls} />)}
          {field('Description', <textarea value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} rows={2} className={inputCls} />)}
          <div className="grid grid-cols-2 gap-3">
            {field('Category', (
              <select value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value as VendorCategory })} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            ))}
            {field('Status', (
              <select value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value as VendorStatus })} className={inputCls}>
                {(['active', 'inactive', 'pending', 'suspended'] as VendorStatus[]).map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Commission Rate (%)', <input type="number" min={0} max={100} value={form.commissionRate} onChange={(e) => onChange({ ...form, commissionRate: e.target.value })} className={inputCls} />)}
            {field('Stall Number', <input value={form.stallNumber} onChange={(e) => onChange({ ...form, stallNumber: e.target.value })} className={inputCls} />)}
          </div>
          {field('Contact Email', <input type="email" value={form.contactEmail} onChange={(e) => onChange({ ...form, contactEmail: e.target.value })} className={inputCls} />)}
          {field('Contact Phone', <input value={form.contactPhone} onChange={(e) => onChange({ ...form, contactPhone: e.target.value })} className={inputCls} />)}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={(e) => onChange({ ...form, featured: e.target.checked })} className="rounded" />
            <span className="text-sm text-[var(--fg)]">Featured vendor</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-[var(--fg-muted)] border border-[var(--border)]">Cancel</button>
          <button onClick={onSubmit} disabled={isPending || !form.name || !form.contactEmail}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40">
            {isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function VendorStatsPanel({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const { data: stats, isLoading: statsLoading } = useVendorStats(vendorId)
  const { data: settlements, isLoading: settleLoading } = useVendorSettlements(vendorId)
  const createSettlement = useCreateSettlement()
  const [grossRevenue, setGrossRevenue] = useState('')

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stats-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-5 my-8">
        <div className="flex items-center justify-between">
          <h2 id="stats-modal-title" className="text-lg font-semibold text-[var(--fg)]">Vendor Statistics</h2>
          <button onClick={onClose} className="text-[var(--fg-muted)] text-xl leading-none">×</button>
        </div>

        {statsLoading ? <p className="text-[var(--fg-muted)]">Loading stats…</p> : stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Orders', value: stats.ordersCount.toLocaleString() },
              { label: 'Revenue', value: `$${stats.revenue.toLocaleString()}` },
              { label: 'Commission Paid', value: `$${stats.commissionPaid.toLocaleString()}` },
              { label: 'Active Products', value: stats.activeProducts },
              { label: 'Avg Rating', value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—' },
              { label: 'Period', value: stats.period },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-semibold text-[var(--fg)]">{value}</p>
                <p className="text-xs text-[var(--fg-muted)]">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">Settlements</h3>
          {settleLoading ? <p className="text-[var(--fg-muted)]">Loading…</p> : (
            <ul className="space-y-2 max-h-40 overflow-y-auto mb-3">
              {settlements?.length ? settlements.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm border-b border-[var(--border)] pb-2">
                  <div>
                    <span className="text-[var(--fg)]">${s.amount.toLocaleString()}</span>
                    <span className="text-[var(--fg-muted)] ml-2">{new Date(s.settlementDate).toLocaleDateString()}</span>
                    {s.payoutReference && <span className="text-xs text-[var(--fg-muted)] ml-2">{s.payoutReference}</span>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.status === 'paid' ? 'bg-green-100 text-green-700' :
                    s.status === 'failed' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{s.status}</span>
                </li>
              )) : <p className="text-[var(--fg-muted)] text-sm">No settlements yet.</p>}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Gross revenue ($)"
              value={grossRevenue}
              onChange={(e) => setGrossRevenue(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)]"
              aria-label="Settlement gross revenue"
            />
            <button
              onClick={() => {
                if (!grossRevenue) return
                createSettlement.mutate({ vendorId, grossRevenue: Number(grossRevenue) }, {
                  onSuccess: () => setGrossRevenue(''),
                })
              }}
              disabled={createSettlement.isPending || !grossRevenue}
              aria-label="Create settlement"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40"
            >
              {createSettlement.isPending ? 'Creating…' : 'Settle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminVendorsPage() {
  const { data: vendors, isLoading } = useVendors()
  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()
  const disableMutation = useDisableVendor()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Vendor | null>(null)
  const [statsVendorId, setStatsVendorId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<VendorFormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<VendorFormState>(DEFAULT_FORM)

  return (

    <PermissionGuard permission="vendors.view">
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg)]">Vendor Management</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateForm(DEFAULT_FORM) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white"
          aria-label="Create vendor"
        >
          + Add Vendor
        </button>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">Loading vendors…</p>
      ) : !vendors?.length ? (
        <p className="text-[var(--fg-muted)]">No vendors configured.</p>
      ) : (
        <ul className="space-y-3">
          {vendors.map((vendor) => (
            <li key={vendor.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[vendor.status]}`}>
                    {vendor.status}
                  </span>
                  {vendor.featured && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)] text-white">Featured</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    {CATEGORY_LABELS[vendor.category]}
                  </span>
                </div>
                <p className="font-medium text-[var(--fg)] mt-1">{vendor.name}</p>
                <p className="text-sm text-[var(--fg-muted)] truncate">{vendor.description}</p>
                {vendor.stallNumber && (
                  <p className="text-xs text-[var(--fg-muted)]">Stall {vendor.stallNumber} · ★ {vendor.rating > 0 ? vendor.rating.toFixed(1) : '—'}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => setStatsVendorId(vendor.id)}
                  aria-label={`View stats for ${vendor.name}`}
                  className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] text-[var(--fg)]"
                >
                  Stats
                </button>
                <button
                  onClick={() => { setEditTarget(vendor); setEditForm(vendorToForm(vendor)) }}
                  aria-label={`Edit ${vendor.name}`}
                  className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] text-[var(--fg)]"
                >
                  Edit
                </button>
                {vendor.status === 'active' && (
                  <button
                    onClick={() => disableMutation.mutate(vendor.id)}
                    disabled={disableMutation.isPending}
                    aria-label={`Disable ${vendor.name}`}
                    className="px-3 py-1 rounded-lg text-sm border border-red-300 text-red-600 disabled:opacity-40"
                  >
                    Disable
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <VendorFormModal
          title="Add Vendor"
          form={createForm}
          onChange={setCreateForm}
          onSubmit={() => createMutation.mutate(formToPayload(createForm), {
            onSuccess: () => { setShowCreate(false); setCreateForm(DEFAULT_FORM) },
          })}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          submitLabel="Add Vendor"
        />
      )}

      {editTarget && (
        <VendorFormModal
          title="Edit Vendor"
          form={editForm}
          onChange={setEditForm}
          onSubmit={() => updateMutation.mutate(
            { id: editTarget.id, payload: formToPayload(editForm) },
            { onSuccess: () => setEditTarget(null) },
          )}
          onCancel={() => setEditTarget(null)}
          isPending={updateMutation.isPending}
          submitLabel="Save"
        />
      )}

      {statsVendorId && (
        <VendorStatsPanel vendorId={statsVendorId} onClose={() => setStatsVendorId(null)} />
      )}
    </main>
  
    </PermissionGuard>

  )
}
