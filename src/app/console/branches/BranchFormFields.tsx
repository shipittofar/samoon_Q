'use client'

/**
 * Shared Branch form fields — used by both console/branches/new/page.tsx and
 * console/branches/[id]/edit/page.tsx. Extends the fieldset/native-input house
 * style already established by new/page.tsx (Branch Management's own existing
 * form pattern) rather than switching to the Modal/Input kit used by Menu/
 * Category/Extras Management — see docs/BRANCH_MANAGEMENT_ANALYSIS.md.
 */

import { useTranslations } from 'next-intl'
import type { BranchType, BranchBusinessHours, BranchSettings } from '@/types/branch'

export interface BranchFormState {
  name: string
  slug: string
  description: string
  type: BranchType
  address: string
  city: string
  country: string
  postalCode: string
  phone_number: string
  email: string
  image: string
  coverImage: string
  timeZone: string
  currency: string
  language: string
  isDefault: boolean
  businessHours: BranchBusinessHours[]
  settings: BranchSettings
}

const DAYS: BranchBusinessHours['day'][] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

export function defaultBranchFormBusinessHours(): BranchBusinessHours[] {
  return DAYS.map((day) => ({ day, open: '09:00', close: '22:00', isClosed: false }))
}

export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  deliveryEnabled: false,
  pickupEnabled: true,
  tableOrderingEnabled: false,
  reservationsEnabled: false,
  orderingEnabled: true,
  marketplaceVisible: true,
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIMPLE_PHONE_RE = /^[+]?[\d\s()-]{7,20}$/

/** Empty required fields, invalid email/phone format, or invalid working hours (open >= close on an open day). */
export function validateBranchForm(form: BranchFormState): string | null {
  if (!form.name.trim() || !form.slug.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
    return 'fillAllRequiredFieldsError'
  }
  if (!/^[a-z0-9-]+$/.test(form.slug.trim())) return 'invalidSlugError'
  if (form.email.trim() && !SIMPLE_EMAIL_RE.test(form.email.trim())) return 'invalidEmailError'
  if (form.phone_number.trim() && !SIMPLE_PHONE_RE.test(form.phone_number.trim())) return 'invalidPhoneError'
  for (const h of form.businessHours) {
    if (!h.isClosed && h.open >= h.close) return 'invalidWorkingHoursError'
  }
  return null
}

export function BranchFormFields({
  form,
  onChange,
}: {
  form: BranchFormState
  onChange: (next: BranchFormState) => void
}) {
  const t = useTranslations('console')

  const set = <K extends keyof BranchFormState>(field: K, value: BranchFormState[K]) =>
    onChange({ ...form, [field]: value })

  const setHour = (day: BranchBusinessHours['day'], patch: Partial<BranchBusinessHours>) =>
    onChange({
      ...form,
      businessHours: form.businessHours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    })

  const setSetting = <K extends keyof BranchSettings>(key: K, value: BranchSettings[K]) =>
    onChange({ ...form, settings: { ...form.settings, [key]: value } })

  const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('basicInformationLabel')}</legend>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branch-name">
            {t('nameLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            id="branch-name"
            type="text"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              set('name', name)
              if (!form.slug) set('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
            }}
            placeholder={t('downtownBranchPlaceholder')}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branch-slug">
            {t('slugLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            id="branch-slug"
            type="text"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder={t('downtownBranchSlugPlaceholder')}
            required
            className={`${inputClass} font-mono`}
          />
          <p className="text-xs text-gray-500 mt-1">{t('lowercaseSlugHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branch-description">{t('descriptionLabel')}</label>
          <textarea
            id="branch-description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <p className="block text-sm font-medium mb-2">{t('tableHeaders.type')} <span className="text-red-500">*</span></p>
          <div className="flex gap-3">
            {(['physical', 'mobile'] as BranchType[]).map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => set('type', bt)}
                className={`flex-1 border rounded-lg py-2 text-sm capitalize transition-colors ${
                  form.type === bt ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-gray-200 hover:border-gray-300'
                }`}
                aria-pressed={form.type === bt}
              >
                {bt === 'physical' ? t('branchTypePhysical') : t('branchTypeMobile')}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="rounded" />
          {t('defaultBranchLabel')}
        </label>
      </fieldset>

      {/* Location */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('locationLabel')}</legend>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branch-address">
            {t('addressLabel')} <span className="text-red-500">*</span>
          </label>
          <input id="branch-address" type="text" value={form.address} onChange={(e) => set('address', e.target.value)} required className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-city">
              {t('cityLabel')} <span className="text-red-500">*</span>
            </label>
            <input id="branch-city" type="text" value={form.city} onChange={(e) => set('city', e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-country">
              {t('countryLabel')} <span className="text-red-500">*</span>
            </label>
            <input id="branch-country" type="text" value={form.country} onChange={(e) => set('country', e.target.value)} required className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branch-postal">{t('postalCodeLabel')}</label>
          <input id="branch-postal" type="text" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={inputClass} />
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('contactOptionalLabel')}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-phone_number">{t('phoneLabel')}</label>
            <input id="branch-phone_number" type="tel" value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} placeholder="+1 212 555 0100" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-email">{t('emailLabel')}</label>
            <input id="branch-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="branch@example.com" className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Branding */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('brandingLabel')}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-image">{t('imageUrlLabel')}</label>
            <input id="branch-image" type="text" value={form.image} onChange={(e) => set('image', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-cover-image">{t('coverImageUrlLabel')}</label>
            <input id="branch-cover-image" type="text" value={form.coverImage} onChange={(e) => set('coverImage', e.target.value)} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Locale */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('localeLabel')}</legend>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-timezone">{t('timeZoneLabel')}</label>
            <input id="branch-timezone" type="text" value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} placeholder="America/New_York" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-currency">{t('currencyLabel')}</label>
            <input id="branch-currency" type="text" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} placeholder="USD" className={`${inputClass} font-mono`} maxLength={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-language">{t('languageLabel')}</label>
            <input id="branch-language" type="text" value={form.language} onChange={(e) => set('language', e.target.value.toLowerCase())} placeholder="en" className={`${inputClass} font-mono`} maxLength={5} />
          </div>
        </div>
      </fieldset>

      {/* Settings */}
      <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('settingsTitle')}</legend>
        {([
          ['orderingEnabled', 'orderingEnabledLabel'],
          ['deliveryEnabled', 'deliveryEnabledLabel'],
          ['pickupEnabled', 'pickupEnabledLabel'],
          ['tableOrderingEnabled', 'dineInEnabledLabel'],
          ['reservationsEnabled', 'reservationsEnabledLabel'],
          ['marketplaceVisible', 'marketplaceVisibleLabel'],
        ] as const).map(([key, labelKey]) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.settings[key]}
              onChange={(e) => setSetting(key, e.target.checked)}
              className="rounded"
            />
            {t(labelKey)}
          </label>
        ))}
        <div className="pt-2">
          <label className="block text-sm font-medium mb-1" htmlFor="branch-max-capacity">{t('maxCapacityLabel')}</label>
          <input
            id="branch-max-capacity"
            type="number"
            min={0}
            value={form.settings.maxCapacity ?? ''}
            onChange={(e) => setSetting('maxCapacity', e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className={`${inputClass} max-w-[10rem]`}
          />
        </div>
      </fieldset>

      {/* Working Hours */}
      <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('workingHoursLabel')}</legend>
        <div className="space-y-2">
          {form.businessHours.map((h) => (
            <div key={h.day} className="flex items-center gap-3 flex-wrap">
              <span className="w-24 text-sm font-medium shrink-0">{h.day}</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={h.isClosed}
                  onChange={(e) => setHour(h.day, { isClosed: e.target.checked })}
                  className="rounded"
                />
                {t('closedLabel')}
              </label>
              {!h.isClosed && (
                <>
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => setHour(h.day, { open: e.target.value })}
                    aria-label={t('openTimeAria', { day: h.day })}
                    className="border rounded-lg px-2 py-1 text-sm"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => setHour(h.day, { close: e.target.value })}
                    aria-label={t('closeTimeAria', { day: h.day })}
                    className="border rounded-lg px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
