'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SelectableOptionRow } from '@/components/ui'
import { MapSelector } from './MapSelector'
import { AddressSuggestionTile } from './AddressSuggestionTile'
import { useAddressSuggestions } from '@/hooks/address'
import { ADDRESS_TYPES, userAddressSchema, type UserAddressFormData } from '@/lib/address-validation'
import type { AddressSuggestion, UserAddress, UserAddressInput } from '@/types/address'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

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
    phone: initial?.phone ?? '',
    delivery_notes: initial?.delivery_notes ?? '',
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    is_default: initial?.is_default ?? false,
  }
}

export function AddressForm({ initial, onSubmit, onCancel, loading, submitLabel }: AddressFormProps) {
  const t = useTranslations('address')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')

  const [suggestionQuery, setSuggestionQuery] = useState('')
  const debouncedQuery = useDebouncedValue(suggestionQuery, 350)
  const { data: suggestions = [], isFetching: suggestionsLoading } = useAddressSuggestions(
    debouncedQuery,
    debouncedQuery.length >= 2,
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserAddressFormData>({
    resolver: zodResolver(userAddressSchema),
    defaultValues: toFormDefaults(initial),
  })

  const addressType = watch('address_type')
  const latitude = watch('latitude')
  const longitude = watch('longitude')

  useEffect(() => {
    if (initial) {
      const defaults = toFormDefaults(initial)
      Object.entries(defaults).forEach(([key, val]) => {
        setValue(key as keyof UserAddressFormData, val as never)
      })
    }
  }, [initial, setValue])

  const applySuggestion = (s: AddressSuggestion) => {
    setValue('street', s.street ?? '')
    setValue('city', s.city ?? '')
    setValue('province', s.province ?? '')
    setValue('district', s.district ?? '')
    setValue('building_number', s.building_number ?? '')
    setValue('postal_code', s.postal_code ?? '')
    setValue('country', s.country ?? 'US')
    setValue('latitude', s.latitude)
    setValue('longitude', s.longitude)
    setSuggestionQuery(s.formatted_address)
  }

  const typeOptions = useMemo(
    () => ADDRESS_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) })),
    [t],
  )

  const fieldError = (key: keyof UserAddressFormData) =>
    errors[key]?.message ? tValidation(String(errors[key]?.message)) : undefined

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as UserAddressInput))}
      className="space-y-5"
    >
      <div>
        <p className="text-sm font-medium text-[var(--fg)] mb-2">{t('addressType')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {typeOptions.map((opt) => (
            <SelectableOptionRow
              key={opt.value}
              name={opt.label}
              selected={addressType === opt.value}
              selectionType="single"
              onClick={() => setValue('address_type', opt.value)}
            />
          ))}
        </div>
      </div>

      <Input
        label={t('customLabel')}
        placeholder={t('customLabelPlaceholder')}
        {...register('custom_label')}
        error={fieldError('custom_label')}
      />

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
        <Input label={t('province')} {...register('province')} error={fieldError('province')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('city')} required {...register('city')} error={fieldError('city')} />
        <Input label={t('district')} {...register('district')} error={fieldError('district')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('street')} required {...register('street')} error={fieldError('street')} className="sm:col-span-2" />
        <Input label={t('buildingNumber')} {...register('building_number')} />
        <Input label={t('unit')} {...register('unit')} />
        <Input label={t('floor')} {...register('floor')} />
        <Input label={t('postalCode')} {...register('postal_code')} />
      </div>
      <Input label={t('phone')} type="tel" {...register('phone')} error={fieldError('phone')} />
      <div>
        <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('deliveryNotes')}</label>
        <textarea
          {...register('delivery_notes')}
          rows={2}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          placeholder={t('deliveryNotesPlaceholder')}
        />
      </div>

      <MapSelector
        latitude={latitude}
        longitude={longitude}
        onChange={({ latitude: la, longitude: ln }) => {
          setValue('latitude', la)
          setValue('longitude', ln)
        }}
      />

      <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)] cursor-pointer">
        <input type="checkbox" {...register('is_default')} className="rounded border-[var(--border)]" />
        {t('setAsDefault')}
      </label>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            {tCommon('cancel')}
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          {submitLabel ?? t('saveAddress')}
        </Button>
      </div>
    </form>
  )
}
