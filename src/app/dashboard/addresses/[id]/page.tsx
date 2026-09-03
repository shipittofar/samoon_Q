'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Phone, Calendar, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import {
  AddressTypeChip,
  VerificationBadge,
  CapabilityBadgeList,
  AddressForm,
  AddressErrorState,
  AddressSkeleton,
  DefaultAddressBadge,
} from '@/components/address'
import {
  useAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from '@/hooks'
import { handleAddressMutationError } from '@/lib/address-errors'
import { ENABLE_DELETED_ADDRESSES } from '@/lib/address-features'
import { formatDate } from '@/utils'

export default function AddressDetailPage() {
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('address')
  const tCommon = useTranslations('common')

  const { data: address, isLoading, isError, refetch } = useAddress(id)
  const updateMutation = useUpdateAddress()
  const deleteMutation = useDeleteAddress()
  const setDefaultMutation = useSetDefaultAddress()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AddressSkeleton />
      </div>
    )
  }

  if (isError || !address) {
    return <AddressErrorState onRetry={() => refetch()} />
  }

  if (!ENABLE_DELETED_ADDRESSES && address.is_deleted) {
    return <AddressErrorState onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/addresses">
          <Button variant="ghost"size="icon-sm"aria-label={tCommon('back')}>
            <ArrowLeft className="h-4 w-4"/>
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <AddressTypeChip type={address.address_type} label={address.custom_label} />
            {address.is_default && <DefaultAddressBadge />}
            <VerificationBadge status={address.verification_status} />
          </div>
          <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)] truncate">
            {address.formatted_address}
          </h1>
        </div>
      </div>

      <Card className="space-y-5">
        <section>
          <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-2">
            {t('formattedAddress')}
          </h2>
          <p className="text-[var(--fg)] leading-relaxed">{address.formatted_address}</p>
        </section>

        {(address.latitude != null && address.longitude != null) && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4"/> {t('coordinates')}
            </h2>
            <p className="text-sm text-[var(--fg)] font-mono">
              {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
            </p>
          </section>
        )}

        {address.phone && (
          <section className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <Phone className="h-4 w-4 text-[var(--accent-text)]"/>
            {address.phone}
          </section>
        )}

        {address.delivery_notes && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4"/> {t('deliveryNotes')}
            </h2>
            <p className="text-sm text-[var(--fg)]">{address.delivery_notes}</p>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-2">
            {t('capabilitiesTitle')}
          </h2>
          <CapabilityBadgeList capabilities={address.capabilities} />
        </section>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border)] text-sm text-[var(--fg-muted)]">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4"/>
            <div>
              <p className="text-xs">{t('createdAt')}</p>
              <p className="text-[var(--fg)]">{formatDate(address.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4"/>
            <div>
              <p className="text-xs">{t('updatedAt')}</p>
              <p className="text-[var(--fg)]">{formatDate(address.updated_at)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setEditOpen(true)}>{tCommon('edit')}</Button>
        {!address.is_default && (
          <Button
            variant="secondary"
            loading={setDefaultMutation.isPending}
            onClick={() =>
              setDefaultMutation.mutate(id, {
                onSuccess: () => toast.success(t('defaultUpdated')),
              })
            }
          >
            {t('setAsDefault')}
          </Button>
        )}
        <Button
          variant="destructive"
          loading={deleteMutation.isPending}
          onClick={() =>
            deleteMutation.mutate(id, {
              onSuccess: () => {
                toast.success(t('addressRemoved'))
                window.location.href = '/dashboard/addresses'
              },
            })
          }
        >
          {tCommon('delete')}
        </Button>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('editAddress')} size="lg">
        <AddressForm
          initial={address}
          loading={updateMutation.isPending}
          onCancel={() => setEditOpen(false)}
          submitLabel={t('saveChanges')}
          onSubmit={async (input) => {
            try {
              await updateMutation.mutateAsync({ id, input, existingAddress: address })
              toast.success(t('addressUpdated'))
              setEditOpen(false)
            } catch (err) {
              if (!handleAddressMutationError(err, t)) toast.error(t('failedToUpdate'))
            }
          }}
        />
      </Modal>
    </div>
  )
}
