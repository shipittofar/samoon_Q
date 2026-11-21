'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Clock, MapPin, XCircle } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui'
import { MapViewLazy } from '@/components/maps'
import { ErrorBox, StatusBadge, formatDate, selectClass } from '@/components/superadmin/shared'
import {
  BUSINESS_TYPE_VALUES,
  apiErrorMessage,
  businessRequestService,
  type BusinessRequest,
  type BusinessTypeValue,
} from '@/services/superadmin.service'
import type { GeoPoint } from '@/types/branch'

/** Tehran: where the map starts before the applicant picks a point. */
const DEFAULT_CENTER: GeoPoint = { lat: 35.6892, lng: 51.389 }

interface FormState {
  name: string
  business_type: BusinessTypeValue
  description: string
  phone: string
  city: string
  address: string
  point: GeoPoint | null
  radius: string
}

const EMPTY_FORM: FormState = {
  name: '',
  business_type: 'restaurant',
  description: '',
  phone: '',
  city: '',
  address: '',
  point: null,
  radius: '',
}

function RequestStatusCard({ item }: { item: BusinessRequest }) {
  const t = useTranslations('superadmin')
  const locale = useLocale()
  const icon =
    item.status === 'approved' ? (
      <CheckCircle2 className="h-6 w-6 text-[var(--success-text)]" aria-hidden="true" />
    ) : item.status === 'rejected' ? (
      <XCircle className="h-6 w-6 text-[var(--danger-text)]" aria-hidden="true" />
    ) : (
      <Clock className="h-6 w-6 text-[var(--warning-text)]" aria-hidden="true" />
    )
  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--fg)]">{item.name}</span>
            <StatusBadge status={item.status} />
            <span className="text-xs text-[var(--fg-muted)]">{formatDate(item.created_at, locale)}</span>
          </div>
          {item.status === 'pending' && (
            <>
              <p className="text-sm font-medium text-[var(--fg)]">{t('register.pendingTitle')}</p>
              <p className="text-sm text-[var(--fg-muted)]">{t('register.pendingDesc')}</p>
            </>
          )}
          {item.status === 'approved' && (
            <>
              <p className="text-sm font-medium text-[var(--fg)]">{t('register.approvedTitle')}</p>
              <p className="text-sm text-[var(--fg-muted)]">{t('register.approvedDesc')}</p>
              {/* Full navigation so the session (now a business account) reloads. */}
              <a href="/console" className="inline-block pt-1">
                <Button size="sm">{t('register.openConsole')}</Button>
              </a>
            </>
          )}
          {item.status === 'rejected' && (
            <>
              <p className="text-sm font-medium text-[var(--fg)]">{t('register.rejectedTitle')}</p>
              {item.rejection_reason && (
                <p className="text-sm text-[var(--fg-muted)]">
                  {t('requests.reason')}: {item.rejection_reason}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function RegisterBusinessContent() {
  const t = useTranslations('superadmin')
  const [requests, setRequests] = useState<BusinessRequest[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    setLoadError(false)
    businessRequestService
      .mine()
      .then(setRequests)
      .catch(() => setLoadError(true))
  }, [])
  useEffect(load, [load])

  const hasPending = requests?.some((r) => r.status === 'pending') ?? false
  const hasApproved = requests?.some((r) => r.status === 'approved') ?? false
  const formVisible = requests !== null && !hasPending && (showForm || requests.length === 0 || !hasApproved)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.name.trim()) next.name = t('common.required')
    if (!form.city.trim()) next.city = t('common.required')
    if (!form.phone.trim()) next.phone = t('common.required')
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await businessRequestService.create({
        name: form.name.trim(),
        business_type: form.business_type,
        description: form.description.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        latitude: form.point ? form.point.lat.toFixed(6) : null,
        longitude: form.point ? form.point.lng.toFixed(6) : null,
        service_radius_km: form.radius ? Number(form.radius) : null,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    } catch (err) {
      setSubmitError(apiErrorMessage(err, t('common.error')))
    } finally {
      setSubmitting(false)
    }
  }

  const radiusKm = Number(form.radius) || 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('register.title')}</h1>
      <p className="mt-1 mb-6 text-sm text-[var(--fg-muted)]">{t('register.subtitle')}</p>

      {loadError && (
        <div className="mb-4">
          <ErrorBox message={t('common.error')} onRetry={load} />
        </div>
      )}
      {requests === null && !loadError && <p className="text-sm text-[var(--fg-muted)]">{t('common.loading')}</p>}

      {requests && requests.length > 0 && (
        <section className="mb-8 space-y-3" aria-label={t('register.myRequests')}>
          <h2 className="text-sm font-semibold text-[var(--fg)]">{t('register.myRequests')}</h2>
          {requests.map((r) => (
            <RequestStatusCard key={r.id} item={r} />
          ))}
          {!hasPending && hasApproved && !showForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
              {t('register.newRequest')}
            </Button>
          )}
        </section>
      )}

      {formVisible && (
        <form onSubmit={submit} noValidate>
          <Card padding="md" className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('register.name')}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
                required
                maxLength={255}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="business-type" className="text-sm font-medium text-[var(--fg)]">
                  {t('register.businessType')}
                </label>
                <select
                  id="business-type"
                  className={selectClass}
                  value={form.business_type}
                  onChange={(e) => set('business_type', e.target.value as BusinessTypeValue)}
                >
                  {BUSINESS_TYPE_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {t(`businessTypes.${v}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Textarea
              label={t('register.description')}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('register.phone')}
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
                required
                maxLength={30}
              />
              <Input
                label={t('register.city')}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                error={errors.city}
                required
                maxLength={100}
              />
            </div>
            <Textarea label={t('register.address')} value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--fg)] inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('register.location')}
                </span>
                {form.point && (
                  <button type="button" className="text-xs text-[var(--fg-muted)] underline" onClick={() => set('point', null)}>
                    {t('register.clearLocation')}
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--fg-muted)]">{t('register.locationHint')}</p>
              <div className="h-64 overflow-hidden rounded-xl border border-[var(--border)]">
                <MapViewLazy
                  center={form.point ?? DEFAULT_CENTER}
                  zoom={form.point ? 14 : 11}
                  keepView
                  scrollWheelZoom={false}
                  onMapClick={(p) => set('point', p)}
                  markers={form.point ? [{ id: 'business', position: form.point, emoji: '📍' }] : []}
                  circles={form.point && radiusKm > 0 ? [{ id: 'radius', center: form.point, radiusKm }] : []}
                  ariaLabel={t('register.location')}
                />
              </div>
            </div>

            <Input
              label={t('register.radius')}
              hint={t('register.radiusHint')}
              type="number"
              min={0}
              max={200}
              value={form.radius}
              onChange={(e) => set('radius', e.target.value)}
            />

            {submitError && <ErrorBox message={submitError} />}
            <div className="flex justify-end gap-2">
              {showForm && (
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="submit" loading={submitting}>
                {t('register.submit')}
              </Button>
            </div>
          </Card>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-[var(--fg-muted)]">
        <Link href="/dashboard" className="hover:underline">
          {t('common.back')}
        </Link>
      </p>
    </div>
  )
}

export default function RegisterBusinessPage() {
  return (
    <AuthGuard>
      <RegisterBusinessContent />
    </AuthGuard>
  )
}
