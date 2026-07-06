'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Plus, Star, Trash2, Edit2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAddresses } from '@/hooks'
import { userService } from '@/services/combined.service'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { Address } from '@/types'

export default function AddressesPage() {
  const { data: addresses = [], isLoading } = useAddresses()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [formData, setFormData] = useState({ label: '', street: '', city: '', state: '', zip: '' })
  const [saving, setSaving] = useState(false)
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')

  const handleAdd = async () => {
    if (!formData.street || !formData.city) { toast.error(t('streetAndCityRequired')); return }
    setSaving(true)
    try {
      await userService.createAddress({ ...formData, is_default: addresses.length === 0 })
      qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success(t('addressAdded'))
      setAddOpen(false)
      setFormData({ label: '', street: '', city: '', state: '', zip: '' })
    } catch { toast.error(t('failedToAddAddress')) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await userService.deleteAddress(id)
      qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success(t('addressRemoved'))
    } catch { toast.error(t('failedToDeleteAddress')) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('savedAddresses')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('addressesSavedCount', { count: addresses.length })}</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>{t('addAddress')}</Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : addresses.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <MapPin className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">{t('noAddressesSaved')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">{t('addDeliveryAddressHint')}</p>
          <Button onClick={() => setAddOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>{t('addAddress')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr: Address, i: number) => (
            <motion.div key={addr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="!p-0 overflow-hidden">
                <div className="flex items-start gap-4 p-5">
                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[var(--fg)]">{addr.label || t('addressFallbackLabel')}</p>
                      {addr.is_default && <Badge variant="default" dot className="text-xs">{t('defaultLabel')}</Badge>}
                    </div>
                    <p className="text-sm text-[var(--fg-muted)]">{addr.street}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.zip}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!addr.is_default && (
                      <Button variant="ghost" size="icon-sm" aria-label={t('setAsDefaultAria')}><Star className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label={tCommon('edit')}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(addr.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" aria-label={tCommon('delete')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addNewAddress')} size="sm">
        <div className="space-y-4">
          <Input label={t('label')} placeholder={t('homeWorkOtherPlaceholder')} value={formData.label} onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))} />
          <Input label={t('streetAddress')} required placeholder="123 Main St" value={formData.street} onChange={(e) => setFormData((p) => ({ ...p, street: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('city')} required placeholder="New York" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
            <Input label={t('state')} placeholder="NY" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
          </div>
          <Input label={t('zipCode')} placeholder="10001" value={formData.zip} onChange={(e) => setFormData((p) => ({ ...p, zip: e.target.value }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)} className="flex-1">{tCommon('cancel')}</Button>
            <Button onClick={handleAdd} loading={saving} className="flex-1">{t('saveAddress')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
