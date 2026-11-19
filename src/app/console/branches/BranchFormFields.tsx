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
import { MapSelector } from '@/components/address/MapSelector'
import { ServiceAreaEditor } from '@/components/console/ServiceAreaEditor'
import { parseMapCoordinates } from '@/lib/coordinates'
import { SelectableOptionRow } from '@/components/ui/SelectableOptionRow'
import { useReverseGeocode } from '@/hooks/address'
import {
  BRANCH_AMENITY_OPTIONS,
  BRANCH_CUISINE_OPTIONS,
  mergeCatalogOptions,
} from '@/lib/branch-catalog'
import type { BranchBusinessHours } from '@/types/branch'
import type { BranchCreateStep, BranchFormState } from '@/types/branch-form'
import {
  checkoutConfigKeyToWire,
  getCheckoutDeliveryOptionLabel,
  getCheckoutOrderTypeConfigKeyEnabledLabel,
  getCheckoutPaymentConfigKeyLabel,
} from '@/lib/checkout-options'

export type { BranchFormState, BranchCreateStep } from '@/types/branch-form'
export {
  validateBranchForm,
  validateBranchCreateForm,
  validateBranchCreateStep,
  defaultBranchFormBusinessHours,
  EMPTY_BRANCH_FORM,
  branchFormToWriteRequest,
  branchFormToCreateRequest,
  branchToFormInput,
} from '@/types/branch-form'

export function BranchFormFields({
  form,
  onChange,
  sections,
  showLocale = true,
  showMap = false,
  showCuisines = true,
}: {
  form: BranchFormState
  onChange: (next: BranchFormState) => void
  sections?: BranchCreateStep[]
  showLocale?: boolean
  showMap?: boolean
  showCuisines?: boolean
}) {
  const t = useTranslations('console')
  const tCheckout = useTranslations('checkout')
  const tAddressCapabilities = useTranslations('address.capabilities')

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

  const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]'
  const show = (step: BranchCreateStep) => !sections || sections.includes(step)

  return (
    <div className="space-y-5">
      {show('basic') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('basicInformationLabel')}</legend>

        <div>
          <label className="block text-sm font-medium mb-1"htmlFor="branch-name">
            {t('nameLabel')} <span className="text-[var(--danger-text)]">*</span>
          </label>
          <input
            id="branch-name"
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('downtownBranchPlaceholder')}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1"htmlFor="branch-description">{t('descriptionLabel')}</label>
          <textarea
            id="branch-description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <p className="block text-sm font-medium mb-2">{t('tableHeaders.type')} <span className="text-[var(--danger-text)]">*</span></p>
          <div className="flex gap-3">
            {(['physical', 'mobile'] as const).map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => set('type', bt)}
                className={`flex-1 border rounded-lg py-2 text-sm capitalize transition-colors ${
                  form.type === bt ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold' : 'border-[var(--border)] hover:border-[var(--border-input)]'
                }`}
                aria-pressed={form.type === bt}
              >
                {bt === 'physical' ? t('branchTypePhysical') : t('branchTypeMobile')}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox"checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="rounded"/>
          {t('defaultBranchLabel')}
        </label>
      </fieldset>
      )}

      {show('location') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('locationLabel')}</legend>

        <div>
          <label className="block text-sm font-medium mb-1"htmlFor="branch-address">
            {t('addressLabel')} <span className="text-[var(--danger-text)]">*</span>
          </label>
          <input id="branch-address"type="text"value={form.address} onChange={(e) => set('address', e.target.value)} required className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-city">
              {t('cityLabel')} <span className="text-[var(--danger-text)]">*</span>
            </label>
            <input id="branch-city"type="text"value={form.city} onChange={(e) => set('city', e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-country">
              {t('countryLabel')} <span className="text-[var(--danger-text)]">*</span>
            </label>
            <input id="branch-country"type="text"value={form.country} onChange={(e) => set('country', e.target.value)} required className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1"htmlFor="branch-postal">{t('postalCodeLabel')}</label>
          <input id="branch-postal"type="text"value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={inputClass} />
        </div>

        {showMap && (
          <BranchMapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            allowClear
            onClear={() => onChange({ ...form, latitude: null, longitude: null })}
            onCoords={({ latitude, longitude, address, city, country, postalCode }) => {
              onChange({
                ...form,
                latitude,
                longitude,
                address: form.address.trim() ? form.address : address,
                city: form.city.trim() ? form.city : city,
                country: form.country.trim() ? form.country : country,
                postalCode: form.postalCode.trim() ? form.postalCode : postalCode,
              })
            }}
          />
        )}
      </fieldset>
      )}

      {show('location') && showMap && (
        <ServiceAreaEditor
          value={form.serviceArea}
          checkout={form.checkout}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(serviceArea) => set('serviceArea', serviceArea)}
          // Moving the pin invalidates a previous "exact location" confirmation.
          onPinMove={({ lat, lng }) => onChange({ ...form, latitude: lat, longitude: lng, locationVerifiedAt: null })}
          locationVerifiedAt={form.locationVerifiedAt}
          onVerifyPin={() => set('locationVerifiedAt', new Date().toISOString())}
        />
      )}

      {show('contact') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('contactOptionalLabel')}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-phone_number">{t('phoneLabel')}</label>
            <input id="branch-phone_number"type="tel"value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} placeholder="+1 212 555 0100"className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-email">{t('emailLabel')}</label>
            <input id="branch-email"type="email"value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="branch@example.com"className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1"htmlFor="branch-website">{t('websiteLabel')}</label>
          <input
            id="branch-website"
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://example.com"
            className={inputClass}
          />
        </div>
      </fieldset>
      )}

      {show('media') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('brandingLabel')}</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImageUploader
            id="branch-image"
            label={t('branchImageLabel')}
            value={form.image}
            onChange={(image) => onChange({ ...form, image })}
            hint={t('branchImageHint')}
            purpose="branch_logo"
          />
          <ImageUploader
            id="branch-cover-image"
            label={t('branchCoverImageLabel')}
            value={form.coverImage}
            onChange={(coverImage) => onChange({ ...form, coverImage })}
            hint={t('branchCoverImageHint')}
            purpose="branch_cover"
          />
          <ImageUploader
            id="branch-hero-image"
            label={t('branchHeroLabel')}
            value={form.heroImage}
            onChange={(heroImage) => onChange({ ...form, heroImage })}
            hint={t('branchHeroImageHint')}
            purpose="branch_hero"
          />
        </div>
      </fieldset>
      )}

      {showLocale && show('basic') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('localeLabel')}</legend>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-timezone">{t('timeZoneLabel')}</label>
            <input id="branch-timezone"type="text"value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} placeholder="America/New_York"className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-currency">{t('currencyLabel')}</label>
            <input id="branch-currency"type="text"value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} placeholder="USD"className={`${inputClass} font-mono`} maxLength={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-language">{t('languageLabel')}</label>
            <input id="branch-language"type="text"value={form.language} onChange={(e) => set('language', e.target.value.toLowerCase())} placeholder="en"className={`${inputClass} font-mono`} maxLength={5} />
          </div>
        </div>
      </fieldset>
      )}

      {show('operations') && (
      <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('settingsTitle')}</legend>

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
          <p className="text-sm font-medium text-[var(--fg-secondary)]">{tCheckout('orderType')}</p>
          {Object.entries(form.checkout.orderTypes)
            .filter(([key]) => key !== 'default')
            .map(([key]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.checkout.orderTypes[key]}
                onChange={(e) => setOrderTypes({ [key]: e.target.checked })}
                className="rounded"
              />
              {getCheckoutOrderTypeConfigKeyEnabledLabel(key, t)}
            </label>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium text-[var(--fg-secondary)]">{tCheckout('paymentMethod')}</p>
          {Object.entries(form.checkout.payments)
            .filter(([key]) => key !== 'default')
            .map(([key]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.checkout.payments[key]}
                onChange={(e) => setPayments({ [key]: e.target.checked })}
                className="rounded"
              />
              {getCheckoutPaymentConfigKeyLabel(key, tCheckout)}
            </label>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium text-[var(--fg-secondary)]">{tCheckout('delivery')}</p>
          <div>
            <label className="block text-sm font-medium mb-1"htmlFor="branch-delivery-radius">{tCheckout('deliveryRadiusKm')}</label>
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
            <label className="block text-sm font-medium mb-1"htmlFor="branch-minimum-order">{tCheckout('minimumOrderAmount')}</label>
            <input
              id="branch-minimum-order"
              type="text"
              value={form.checkout.delivery.minimumOrder ?? ''}
              onChange={(e) => setDelivery({ minimumOrder: e.target.value || null })}
              className={`${inputClass} max-w-[10rem]`}
            />
          </div>
          {Object.entries(form.checkout.delivery)
            .filter(([key, value]) => key !== 'radius' && key !== 'minimumOrder' && typeof value === 'boolean')
            .map(([key]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.checkout.delivery[key]}
                onChange={(e) => setDelivery({ [key]: e.target.checked })}
                className="rounded"
              />
              {getCheckoutDeliveryOptionLabel(key, tAddressCapabilities)}
            </label>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1"htmlFor="branch-default-order-type">
                {tCheckout('orderType')} ({t('defaultLabel')})
              </label>
              <select
                id="branch-default-order-type"
                value={form.checkout.orderTypes.default ?? ''}
                onChange={(e) => setOrderTypes({ default: e.target.value || null })}
                className={inputClass}
              >
                <option value="">{t('notSetLabel')}</option>
                {Object.entries(form.checkout.orderTypes)
                  .filter(([key, value]) => key !== 'default' && value === true)
                  .map(([key]) => (
                    <option key={key} value={checkoutConfigKeyToWire(key)}>
                      {getCheckoutOrderTypeConfigKeyEnabledLabel(key, t)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1"htmlFor="branch-default-payment">
                {tCheckout('paymentMethod')} ({t('defaultLabel')})
              </label>
              <select
                id="branch-default-payment"
                value={form.checkout.payments.default ?? ''}
                onChange={(e) => setPayments({ default: e.target.value || null })}
                className={inputClass}
              >
                <option value="">{t('notSetLabel')}</option>
                {Object.entries(form.checkout.payments)
                  .filter(([key, value]) => key !== 'default' && value === true)
                  .map(([key]) => (
                    <option key={key} value={key}>
                      {getCheckoutPaymentConfigKeyLabel(key, tCheckout)}
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
          <label className="block text-sm font-medium mb-1"htmlFor="branch-max-capacity">{t('maxCapacityLabel')}</label>
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
      )}

      {show('catalog') && (
      <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('stepCategoriesFeatures')}</legend>
        {showCuisines && (
          <div>
            <p className="block text-sm font-medium mb-2">{t('cuisinesSpecialtiesLabel')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {mergeCatalogOptions(BRANCH_CUISINE_OPTIONS, form.cuisines).map((option) => (
                <SelectableOptionRow
                  key={option}
                  name={option}
                  selected={form.cuisines.includes(option)}
                  selectionType="multiple"
                  onClick={() =>
                    set(
                      'cuisines',
                      form.cuisines.includes(option)
                        ? form.cuisines.filter((c) => c !== option)
                        : [...form.cuisines, option],
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="block text-sm font-medium mb-2">{t('amenitiesLabel')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {mergeCatalogOptions(BRANCH_AMENITY_OPTIONS, form.amenities).map((option) => (
              <SelectableOptionRow
                key={option}
                name={option}
                selected={form.amenities.includes(option)}
                selectionType="multiple"
                onClick={() =>
                  set(
                    'amenities',
                    form.amenities.includes(option)
                      ? form.amenities.filter((a) => a !== option)
                      : [...form.amenities, option],
                  )
                }
              />
            ))}
          </div>
        </div>
      </fieldset>
      )}

      {show('operations') && (
      <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-4">
        <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('workingHoursLabel')}</legend>
        <div className="space-y-2">
          {form.businessHours.map((h) => (
            <div key={h.day} className="flex items-center gap-3 flex-wrap">
              <span className="w-24 text-sm font-medium shrink-0">{h.day}</span>
              <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] cursor-pointer shrink-0">
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
                  <span className="text-[var(--fg-subtle)] text-sm">–</span>
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
      )}
    </div>
  )
}

function BranchMapPicker({
  latitude,
  longitude,
  onCoords,
  allowClear = false,
  onClear,
}: {
  latitude: number | null
  longitude: number | null
  onCoords: (next: {
    latitude: number
    longitude: number
    address: string
    city: string
    country: string
    postalCode: string
  }) => void
  allowClear?: boolean
  onClear?: () => void
}) {
  const t = useTranslations('console')
  const reverseGeocode = useReverseGeocode()

  return (
    <div className="space-y-2">
    <MapSelector
      latitude={latitude}
      longitude={longitude}
      onChange={({ latitude: lat, longitude: lng }) => {
        reverseGeocode.mutate(
          { latitude: lat, longitude: lng },
          {
            onSuccess: (result) => {
              const street = [result.building_number, result.street].filter(Boolean).join(' ')
              onCoords({
                latitude: lat,
                longitude: lng,
                address: result.formatted_address || street,
                city: result.city ?? '',
                country: result.country ?? '',
                postalCode: result.postal_code ?? '',
              })
            },
            onError: () => {
              onCoords({
                latitude: lat,
                longitude: lng,
                address: '',
                city: '',
                country: '',
                postalCode: '',
              })
            },
          },
        )
      }}
    />
    {allowClear && parseMapCoordinates(latitude, longitude) && (
      <button
        type="button"
        onClick={onClear}
        className="text-sm text-[var(--fg-muted)] underline"
      >
        {t('clearMapCoordinatesLabel')}
      </button>
    )}
    </div>
  )
}
