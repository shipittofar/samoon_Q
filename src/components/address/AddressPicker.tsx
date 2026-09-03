'use client'

import { useState } from 'react'
import { Plus, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AddressCard } from './AddressCard'
import { AddressForm } from './AddressForm'
import { Modal } from '@/components/ui/Modal'
import { useAddressList } from '@/hooks/address'
import type { DeliveryAddressOverride, UserAddress, UserAddressInput } from '@/types/address'
import { cn } from '@/utils'

export type CheckoutAddressMode = 'saved' | 'temporary'

export interface AddressPickerValue {
  mode: CheckoutAddressMode
  addressId?: string
  temporaryAddress?: UserAddressInput
  override?: DeliveryAddressOverride
}

export interface AddressPickerProps {
  value: AddressPickerValue
  onChange: (value: AddressPickerValue) => void
  className?: string
}

export function AddressPicker({ value, onChange, className }: AddressPickerProps) {
  const t = useTranslations('address.checkout')
  const { data, isLoading } = useAddressList({ page_size: 20 })
  const addresses = data?.results ?? []
  const [addOpen, setAddOpen] = useState(false)

  const selected = addresses.find((a) => a.id === value.addressId)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-2">
        {(['saved', 'temporary'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...value, mode, addressId: mode === 'saved' ? value.addressId : undefined })}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all',
              value.mode === mode
                ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50',
            )}
          >
            {t(mode === 'saved' ? 'savedAddresses' : 'temporaryAddress')}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {value.mode === 'saved' ? (
          <motion.div key="saved"initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-[var(--fg-muted)]">{t('loadingAddresses')}</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[var(--border)] rounded-2xl">
                <MapPin className="h-8 w-8 text-[var(--fg-subtle)] mx-auto mb-2"/>
                <p className="text-sm text-[var(--fg-muted)] mb-3">{t('noSavedAddresses')}</p>
                <Button size="sm"onClick={() => setAddOpen(true)} leftIcon={<Plus className="h-4 w-4"/>}>
                  {t('addAddress')}
                </Button>
              </div>
            ) : (
              <>
                {addresses.map((addr, i) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => onChange({ ...value, addressId: addr.id })}
                    className={cn(
                      'w-full text-start rounded-2xl transition-all',
                      value.addressId === addr.id && 'ring-2 ring-[var(--focus-ring)] ring-offset-2 ring-offset-[var(--bg)]',
                    )}
                  >
                    <AddressCard address={addr} index={i} />
                  </button>
                ))}
                <Button variant="secondary"size="sm"onClick={() => setAddOpen(true)} leftIcon={<Plus className="h-4 w-4"/>}>
                  {t('addAddress')}
                </Button>
              </>
            )}

            {selected && (
              <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                <p className="text-sm font-medium text-[var(--fg)]">{t('deliveryOverrides')}</p>
                <Input
                  label={t('unit')}
                  value={value.override?.unit ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, override: { ...value.override, unit: e.target.value || null } })
                  }
                />
                <Input
                  label={t('floor')}
                  value={value.override?.floor ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, override: { ...value.override, floor: e.target.value || null } })
                  }
                />
                <Input
                  label={t('buildingNumber')}
                  value={value.override?.building_number ?? ''}
                  onChange={(e) =>
                    onChange({ ...value, override: { ...value.override, building_number: e.target.value || null } })
                  }
                />
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('deliveryNotes')}</label>
                  <textarea
                    value={value.override?.delivery_notes ?? ''}
                    onChange={(e) =>
                      onChange({ ...value, override: { ...value.override, delivery_notes: e.target.value || null } })
                    }
                    rows={2}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
                  />
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="temp"initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AddressForm
              initial={value.temporaryAddress as Partial<UserAddress>}
              onSubmit={(data) => onChange({ ...value, temporaryAddress: data })}
              submitLabel={t('useThisAddress')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addAddress')} size="lg">
        <AddressForm
          onCancel={() => setAddOpen(false)}
          onSubmit={(data) => {
            onChange({ mode: 'temporary', temporaryAddress: data })
            setAddOpen(false)
          }}
        />
      </Modal>
    </div>
  )
}
