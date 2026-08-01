'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection, SelectableOptionRow } from '@/components/ui'
import { MapSelector } from './MapSelector'
import { AddressSuggestionTile } from './AddressSuggestionTile'
import { useAddressSuggestions } from '@/hooks/address'
import { useAddressOwnerProfile } from '@/hooks/useAddressOwnerProfile'
import { ADDRESS_TYPES, userAddressSchema, type UserAddressFormData } from '@/lib/address-validation'
import { hasOptionalAddressData, sanitizeAddressInput } from '@/lib/address-fields'
import { getMissingAddressOwnerFields } from '@/lib/address-profile'
import type { AddressSuggestion, UserAddress, UserAddressInput } from '@/types/address'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/utils'

export interface AddressFormProps {
  initial?: Partial<UserAddress>
  onSubmit: (data: UserAddressInput) => void | Promise<void>
  onCancel?: () => void
  loading?: boolean
  submitLabel?: string
}

function toFormDefaults(initial?: Partial<UserAddress>): UserAddressFormData {
  return {
    address_type: initial?.address_type ?? 'home',
    custom_label: initial?.custom_label ?? '',
    country: initial?.country ?? 'US',
    province: initial?.province ?? '',
    city: initial?.city ?? '',
    district: initial?.district ?? '',
    street: initial?.street ?? '',
    building_number: initial?.building_number ?? '',
    unit: initial?.unit ?? '',
    floor: initial?.floor ?? '',
    postal_code: initial?.postal_code ?? '',
    delivery_notes: initial?.delivery_notes ?? '',
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    is_default: initial?.is_default ?? false,
  }
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)]">{title}</h3>
        {description && <p className="text-xs text-[var(--fg-muted)] mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function AddressForm({ initial, onSubmit, onCancel, loading, submitLabel }: AddressFormProps) {
  const t = useTranslations('address')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')
  const { authUser } = useAddressOwnerProfile()

  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(suggestionQuery, 350)
  const { data: suggestions = [], isFetching: suggestionsLoading } = useAddressSuggestions(
    debouncedQuery,
    debouncedQuery.length >= 2,
  )

  const profileMissing = useMemo(() => getMissingAddressOwnerFields(authUser), [authUser])
  const profileReady = profileMissing.length === 0

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<UserAddressFormData>({
    resolver: zodResolver(userAddressSchema),
    mode: 'onChange',
    defaultValues: toFormDefaults(initial),
  })

  const addressType = watch('address_type')
  const latitude = watch('latitude')
  const longitude = watch('longitude')

  useEffect(() => {
    if (initial) {
      const defaults = toFormDefaults(initial)
      Object.entries(defaults).forEach(([key, val]) => {
        setValue(key as keyof UserAddressFormData, val as never, { shouldValidate: true })
      })
      if (hasOptionalAddressData(defaults)) {
        setOptionalOpen(true)
      }
    }
  }, [initial, setValue])

  const applySuggestion = (s: AddressSuggestion) => {
    setValue('street', s.street ?? '', { shouldValidate: true })
    setValue('city', s.city ?? '', { shouldValidate: true })
    if (s.province) setValue('province', s.province, { shouldValidate: true })
    if (s.district) setValue('district', s.district, { shouldValidate: true })
    if (s.building_number) setValue('building_number', s.building_number, { shouldValidate: true })
    setValue('postal_code', s.postal_code ?? '', { shouldValidate: true })
    setValue('country', s.country ?? 'US', { shouldValidate: true })
    setValue('latitude', s.latitude, { shouldValidate: true })
    setValue('longitude', s.longitude, { shouldValidate: true })
    setSuggestionQuery(s.formatted_address)
    if (s.province || s.district) setOptionalOpen(true)
  }

  const typeOptions = useMemo(
    () => ADDRESS_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) })),
    [t],
  )

  const fieldError = (key: keyof UserAddressFormData) =>
    errors[key]?.message ? tValidation(String(errors[key]?.message)) : undefined

  const handleFormSubmit = (data: UserAddressFormData) => {
    if (!profileReady) return
    onSubmit(sanitizeAddressInput(data as UserAddressInput))
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {!profileReady && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">{t('profileIncompleteTitle')}</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">{t('profileIncomplete')}</p>
            <Link href="/dashboard/settings" className="text-orange-600 hover:underline text-xs font-medium mt-1 inline-block">
              {t('goToSettings')}
            </Link>
          </div>
        </div>
      )}

      <FormSection title={t('sections.required')} description={t('sections.requiredDesc')}>
        <div>
          <p className="text-sm font-medium text-[var(--fg)] mb-2">
            {t('addressType')}<span className="text-orange-500 ml-1">*</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {typeOptions.map((opt) => (
              <SelectableOptionRow
                key={opt.value}
                name={opt.label}
                selected={addressType === opt.value}
                selectionType="single"
                onClick={() => setValue('address_type', opt.value, { shouldValidate: true })}
              />
            ))}
          </div>
        </div>

        <div>
          <Input
            label={t('searchAddress')}
            value={suggestionQuery}
            onChange={(e) => setSuggestionQuery(e.target.value)}
            placeholder={t('searchAddressPlaceholder')}
            hint={t('searchAddressHint')}
          />
          {suggestionsLoading && (
            <p className="text-xs text-[var(--fg-muted)] mt-2">{t('searching')}</p>
          )}
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <AddressSuggestionTile key={`${s.formatted_address}-${i}`} suggestion={s} onSelect={applySuggestion} />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('country')} required {...register('country')} error={fieldError('country')} />
          <Input label={t('city')} required {...register('city')} error={fieldError('city')} />
        </div>

        <Input label={t('street')} required {...register('street')} error={fieldError('street')} />

        <Input label={t('postalCode')} required {...register('postal_code')} error={fieldError('postal_code')} />

        <MapSelector
          latitude={latitude}
          longitude={longitude}
          onChange={({ latitude: la, longitude: ln }) => {
            setValue('latitude', la, { shouldValidate: true })
            setValue('longitude', ln, { shouldValidate: true })
          }}
          disabled={loading}
        />
      </FormSection>

      <CollapsibleSection
        title={t('sections.optional')}
        open={optionalOpen}
        onToggle={() => setOptionalOpen((v) => !v)}
        className="border-t border-[var(--border)] pt-5"
      >
        <p className="text-xs text-[var(--fg-muted)] -mt-2 mb-4">{t('sections.optionalDesc')}</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('province')} {...register('province')} error={fieldError('province')} />
            <Input label={t('district')} {...register('district')} error={fieldError('district')} />
          </div>
          <Input
            label={t('customLabel')}
            placeholder={t('customLabelPlaceholder')}
            {...register('custom_label')}
            error={fieldError('custom_label')}
          />
          <Input label={t('buildingNumber')} {...register('building_number')} error={fieldError('building_number')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('floor')} {...register('floor')} error={fieldError('floor')} />
            <Input label={t('unit')} {...register('unit')} error={fieldError('unit')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('map.latitude')}
              type="number"
              step="any"
              {...register('latitude', { valueAsNumber: true })}
              error={fieldError('latitude')}
            />
            <Input
              label={t('map.longitude')}
              type="number"
              step="any"
              {...register('longitude', { valueAsNumber: true })}
              error={fieldError('longitude')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('deliveryNotes')}</label>
            <textarea
              {...register('delivery_notes')}
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              placeholder={t('deliveryNotesPlaceholder')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)] cursor-pointer">
            <input type="checkbox" {...register('is_default')} className="rounded border-[var(--border)]" />
            {t('setAsDefault')}
          </label>
        </div>
      </CollapsibleSection>

      <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1" disabled={loading}>
            {tCommon('cancel')}
          </Button>
        )}
        <Button
          type="submit"
          loading={loading}
          disabled={loading || !profileReady || !isValid}
          className="flex-1"
        >
          {submitLabel ?? t('saveAddress')}
        </Button>
      </div>
    </form>
  )
}
