'use client'

import { useCallback, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PaginationControls } from '@/components/ui/PaginationControls'
import {
  AddressCard,
  AddressEmptyState,
  AddressErrorState,
  AddressListSkeleton,
  AddressSearchBar,
  AddressForm,
} from '@/components/address'
import {
  useAddressList,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useRestoreAddress,
  useSetDefaultAddress,
} from '@/hooks'
import { handleAddressMutationError } from '@/lib/address-errors'
import { ENABLE_DELETED_ADDRESSES } from '@/lib/address-features'
import type { UserAddress } from '@/types/address'

const PAGE_SIZE = 10

export default function AddressesPage() {
  const t = useTranslations('address')
  const tCommon = useTranslations('common')

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<UserAddress | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useAddressList({
    page,
    page_size: PAGE_SIZE,
    search: search || undefined,
    ...(ENABLE_DELETED_ADDRESSES && includeDeleted ? { include_deleted: true } : {}),
  })

  const createMutation = useCreateAddress()
  const updateMutation = useUpdateAddress()
  const deleteMutation = useDeleteAddress()
  const restoreMutation = useRestoreAddress()
  const setDefaultMutation = useSetDefaultAddress()

  const addresses = data?.results ?? []

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success(t('addressRemoved'), ENABLE_DELETED_ADDRESSES ? { duration: 5000, icon: '↩️' } : undefined)
        if (ENABLE_DELETED_ADDRESSES) {
          toast(
            (toastInstance) => (
              <span className="flex items-center gap-2">
                {t('undoDelete')}
                <button
                  className="font-semibold text-orange-500 underline"
                  onClick={() => {
                    restoreMutation.mutate(id, {
                      onSuccess: () => {
                        toast.success(t('addressRestored'))
                        toast.dismiss(toastInstance.id)
                      },
                    })
                  }}
                >
                  {tCommon('undo')}
                </button>
              </span>
            ),
            { duration: 5000 },
          )
        }
      } catch {
        toast.error(t('failedToDelete'))
      }
    },
    [deleteMutation, restoreMutation, t, tCommon],
  )

  const handleRefresh = () => {
    refetch()
    toast.success(t('refreshed'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('title')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            {t('count', { count: data?.count ?? 0 })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={isFetching}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            aria-label={t('refresh')}
          >
            {t('refresh')}
          </Button>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            {t('addAddress')}
          </Button>
        </div>
      </div>

      <AddressSearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} />

      {ENABLE_DELETED_ADDRESSES && (
        <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1) }}
            className="rounded border-[var(--border)]"
          />
          {t('showDeleted')}
        </label>
      )}

      {isLoading ? (
        <AddressListSkeleton />
      ) : isError ? (
        <AddressErrorState onRetry={() => refetch()} />
      ) : addresses.length === 0 ? (
        <AddressEmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          <div className="space-y-4">
            {addresses.map((addr, i) => (
              <AddressCard
                key={addr.id}
                address={addr}
                index={i}
                href={`/dashboard/addresses/${addr.id}`}
                onEdit={(a) => setEditAddress(a)}
                onDelete={handleDelete}
                onSetDefault={(id) =>
                  setDefaultMutation.mutate(id, {
                    onSuccess: () => toast.success(t('defaultUpdated')),
                    onError: () => toast.error(t('failedToSetDefault')),
                  })
                }
                onRestore={
                  ENABLE_DELETED_ADDRESSES
                    ? (restoreId) =>
                        restoreMutation.mutate(restoreId, {
                          onSuccess: () => toast.success(t('addressRestored')),
                          onError: () => toast.error(t('failedToRestore')),
                        })
                    : undefined
                }
              />
            ))}
          </div>

          {data && data.count > PAGE_SIZE && (
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              count={data.count}
              next={data.next}
              previous={data.previous}
              onPageChange={setPage}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          )}
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addNewAddress')} size="lg">
        <AddressForm
          onCancel={() => setAddOpen(false)}
          loading={createMutation.isPending}
          onSubmit={async (input) => {
            try {
              await createMutation.mutateAsync(input)
              toast.success(t('addressAdded'))
              setAddOpen(false)
            } catch (err) {
              if (!handleAddressMutationError(err, t)) toast.error(t('failedToAdd'))
            }
          }}
        />
      </Modal>

      <Modal open={!!editAddress} onClose={() => setEditAddress(null)} title={t('editAddress')} size="lg">
        {editAddress && (
          <AddressForm
            initial={editAddress}
            onCancel={() => setEditAddress(null)}
            submitLabel={t('saveChanges')}
            loading={updateMutation.isPending}
            onSubmit={async (input) => {
              try {
                await updateMutation.mutateAsync({ id: editAddress.id, input, existingAddress: editAddress })
                toast.success(t('addressUpdated'))
                setEditAddress(null)
              } catch (err) {
                if (!handleAddressMutationError(err, t)) toast.error(t('failedToUpdate'))
              }
            }}
          />
        )}
      </Modal>
    </div>
  )
}
