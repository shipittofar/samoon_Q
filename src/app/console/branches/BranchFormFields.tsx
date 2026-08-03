'use client'

/**
 * Shared Branch form fields — used by both console/branches/new/page.tsx and
 * console/branches/[id]/edit/page.tsx. Extends the fieldset/native-input house
 * style already established by new/page.tsx (Branch Management's own existing
 * form pattern) rather than switching to the Modal/Input kit used by Menu/
 * Category/Extras Management — see docs/BRANCH_MANAGEMENT_ANALYSIS.md.
 */

import { useTranslations } from 'next-intl'
import { ImageUploader } from '@/components/ImageUploader'
import type { BranchBusinessHours } from '@/types/branch'
import type { BranchFormState } from '@/types/branch-form'
import {
  getCheckoutDeliveryConfigKeys,
  getCheckoutDeliveryOptionLabel,
  getCheckoutOrderTypeConfigKeyLabel,
  getCheckoutOrderTypeConfigKeys,
  getCheckoutPaymentConfigKeyLabel,
  getCheckoutPaymentConfigKeys,
  isOrderTypeConfigEnabled,
  isPaymentConfigEnabled,
} from '@/lib/checkout-options'

export type { BranchFormState } from '@/types/branch-form'
export {
  validateBranchForm,
  defaultBranchFormBusinessHours,
  EMPTY_BRANCH_FORM,
  branchFormToWriteRequest,
  branchToFormInput,
} from '@/types/branch-form'

export function BranchFormFields({
  form,
  onChange,
}: {
  form: BranchFormState
  onChange: (next: BranchFormState) => void
}) {
  const t = useTranslations('console')
  const tCheckout = useTranslations('checkout')

  const set = <K extends keyof BranchFormState>(field: K, value: BranchFormState[K]) =>
    onChange({ ...form, [field]: value })

  const setHour = (day: BranchBusinessHours['day'], patch: Partial<BranchBusinessHours>) =>
    onChange({
      ...form,
      businessHours: form.businessHours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    })

  const setCheckout = (patch: Partial<BranchFormState['checkout']>) =>
    onChange({ ...form, checkout: { ...form.checkout, ...patch } })

  const setOrderTypes = (patch: Partial<BranchFormState['checkout']['orderTypes']>) =>
    onChange({
      ...form,
      checkout: { ...form.checkout, orderTypes: { ...form.checkout.orderTypes, ...patch } },
    })

  const setPayments = (patch: Partial<BranchFormState['checkout']['payments']>) =>
    onChange({
      ...form,
      checkout: { ...form.checkout, payments: { ...form.checkout.payments, ...patch } },
    })

  const setDelivery = (patch: Partial<BranchFormState['checkout']['delivery']>) =>
    onChange({
      ...form,
      checkout: { ...form.checkout, delivery: { ...form.checkout.delivery, ...patch } },
    })

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
            {(['physical', 'mobile'] as const).map((bt) => (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImageUploader
            id="branch-image"
            label={t('imageLabel')}
            value={form.image}
            onChange={(image) => onChange({ ...form, image })}
          />
          <ImageUploader
            id="branch-cover-image"
            label={t('coverImageUrlLabel')}
            value={form.coverImage}
            onChange={(coverImage) => onChange({ ...form, coverImage })}
            hint={t('coverImageHint')}
          />
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

      {/* Checkout / ordering */}
      <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-semibold text-gray-700 px-1">{t('settingsTitle')}</legend>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.checkout.orderingEnabled}
            onChange={(e) => setCheckout({ orderingEnabled: e.target.checked })}
            className="rounded"
          />
          {t('orderingEnabledLabel')}
        </label>

        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium text-gray-700">{tCheckout('orderType')}</p>
          {getCheckoutOrderTypeConfigKeys(form.checkout.orderTypes).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isOrderTypeConfigEnabled(form.checkout.orderTypes[key])}
                onChange={(e) => {
                  const current = form.checkout.orderTypes[key]
                  if (isOrderTypeConfigEnabled(current) || (current && typeof current === 'object')) {
                    setOrderTypes({
                      [key]: typeof current === 'object' && current !== null
                        ? { ...current, enabled: e.target.checked }
                        : e.target.checked,
                    })
                  } else {
                    setOrderTypes({ [key]: e.target.checked })
                  }
                }}
                className="rounded"
              />
              {getCheckoutOrderTypeConfigKeyLabel(key)}
            </label>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium text-gray-700">{tCheckout('paymentMethod')}</p>
          {getCheckoutPaymentConfigKeys(form.checkout.payments).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isPaymentConfigEnabled(form.checkout.payments[key])}
                onChange={(e) => {
                  const current = form.checkout.payments[key]
                  if (isPaymentConfigEnabled(current) || (current && typeof current === 'object')) {
                    setPayments({
                      [key]: typeof current === 'object' && current !== null
                        ? { ...current, enabled: e.target.checked }
                        : e.target.checked,
                    })
                  } else {
                    setPayments({ [key]: e.target.checked })
                  }
                }}
                className="rounded"
              />
              {getCheckoutPaymentConfigKeyLabel(key)}
            </label>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium text-gray-700">{tCheckout('delivery')}</p>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-delivery-radius">{tCheckout('deliveryRadiusKm')}</label>
            <input
              id="branch-delivery-radius"
              type="number"
              min={0}
              value={form.checkout.delivery.radius ?? ''}
              onChange={(e) => setDelivery({ radius: e.target.value ? parseFloat(e.target.value) : null })}
              className={`${inputClass} max-w-[10rem]`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="branch-minimum-order">{tCheckout('minimumOrderAmount')}</label>
            <input
              id="branch-minimum-order"
              type="text"
              value={form.checkout.delivery.minimumOrder ?? ''}
              onChange={(e) => setDelivery({ minimumOrder: e.target.value || null })}
              className={`${inputClass} max-w-[10rem]`}
            />
          </div>
          {getCheckoutDeliveryConfigKeys(form.checkout.delivery).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.checkout.delivery[key] === true}
                onChange={(e) => setDelivery({ [key]: e.target.checked })}
                className="rounded"
              />
              {getCheckoutDeliveryOptionLabel(key)}
            </label>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="branch-default-order-type">
                {tCheckout('orderType')} ({t('defaultLabel')})
              </label>
              <select
                id="branch-default-order-type"
                value={form.checkout.orderTypes.default ?? ''}
                onChange={(e) => setOrderTypes({ default: e.target.value || null })}
                className={inputClass}
              >
                <option value="">{t('notSetLabel')}</option>
                {getCheckoutOrderTypeConfigKeys(form.checkout.orderTypes)
                  .filter((key) => isOrderTypeConfigEnabled(form.checkout.orderTypes[key]))
                  .map((key) => (
                    <option key={key} value={key}>
                      {getCheckoutOrderTypeConfigKeyLabel(key)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="branch-default-payment">
                {tCheckout('paymentMethod')} ({t('defaultLabel')})
              </label>
              <select
                id="branch-default-payment"
                value={form.checkout.payments.default ?? ''}
                onChange={(e) => setPayments({ default: e.target.value || null })}
                className={inputClass}
              >
                <option value="">{t('notSetLabel')}</option>
                {getCheckoutPaymentConfigKeys(form.checkout.payments)
                  .filter((key) => isPaymentConfigEnabled(form.checkout.payments[key]))
                  .map((key) => (
                    <option key={key} value={key}>
                      {getCheckoutPaymentConfigKeyLabel(key)}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.reservationsEnabled}
            onChange={(e) => set('reservationsEnabled', e.target.checked)}
            className="rounded"
          />
          {t('reservationsEnabledLabel')}
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.marketplaceVisible}
            onChange={(e) => set('marketplaceVisible', e.target.checked)}
            className="rounded"
          />
          {t('marketplaceVisibleLabel')}
        </label>

        <div className="pt-2">
          <label className="block text-sm font-medium mb-1" htmlFor="branch-max-capacity">{t('maxCapacityLabel')}</label>
          <input
            id="branch-max-capacity"
            type="number"
            min={0}
            value={form.maxCapacity ?? ''}
            onChange={(e) => set('maxCapacity', e.target.value ? parseInt(e.target.value, 10) : undefined)}
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
