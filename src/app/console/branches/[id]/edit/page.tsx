'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useAdminBranch, useUpdateBranch } from '@/hooks'
import {
  BranchFormFields, validateBranchForm, defaultBranchFormBusinessHours, DEFAULT_BRANCH_SETTINGS,
  type BranchFormState,
} from '../../BranchFormFields'
import type { Branch } from '@/types/branch'
import toast from 'react-hot-toast'

function branchToForm(branch: Branch): BranchFormState {
  return {
    name: branch.name,
    slug: branch.slug,
    description: branch.description ?? '',
    type: branch.type,
    address: branch.location.address,
    city: branch.location.city,
    country: branch.location.country,
    postalCode: branch.location.postalCode ?? '',
    phone_number: branch.contact.phone_number ?? '',
    email: branch.contact.email ?? '',
    image: branch.image ?? '',
    coverImage: branch.coverImage ?? '',
    timeZone: branch.timeZone ?? '',
    currency: branch.currency ?? '',
    language: branch.language ?? '',
    isDefault: branch.isDefault ?? false,
    businessHours: branch.businessHours.length > 0 ? branch.businessHours : defaultBranchFormBusinessHours(),
    settings: { ...DEFAULT_BRANCH_SETTINGS, ...branch.settings },
  }
}

function EditBranchContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const router = useRouter()
  const { data: branch, isLoading, error: loadError } = useAdminBranch(id)
  const { mutate: updateBranch, isPending } = useUpdateBranch()

  const [form, setForm] = useState<BranchFormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branch) setForm(branchToForm(branch))
  }, [branch])

  if (isLoading || !form) return <p className="p-6 text-gray-500">{t('loadingBranchEllipsis')}</p>
  if (loadError || !branch) return <p className="p-6 text-red-500">{t('branchNotFoundPeriod')}</p>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending || !form) return
    const validationError = validateBranchForm(form)
    if (validationError) {
      setError(validationError)
      toast.error(t(validationError))
      return
    }
    setError(null)
    updateBranch(
      {
        id,
        payload: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || undefined,
          location: {
            address: form.address.trim(), city: form.city.trim(), country: form.country.trim(),
            postalCode: form.postalCode.trim() || undefined,
          },
          contact: { phone_number: form.phone_number.trim() || undefined, email: form.email.trim() || undefined },
          businessHours: form.businessHours,
          settings: form.settings,
          image: form.image.trim() || undefined,
          coverImage: form.coverImage.trim() || undefined,
          isDefault: form.isDefault,
          timeZone: form.timeZone.trim() || undefined,
          currency: form.currency.trim() || undefined,
          language: form.language.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('branchUpdatedSuccessfully'))
          router.push(`/console/branches/${id}`)
        },
        onError: (err) => {
          toast.error(err instanceof Error && err.message === 'duplicate_slug' ? t('duplicateSlugError') : t('failedToUpdateBranchRetry'))
        },
      },
    )
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('editColonName', { name: branch.name })}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <BranchFormFields form={form} onChange={setForm} />
        {error && <p className="text-sm text-red-500 mt-3">{t(error)}</p>}

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={() => router.push(`/console/branches/${id}`)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 text-sm bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isPending ? <>{t('savingEllipsis')}</> : t('saveChanges')}
          </button>
        </div>
      </form>
    </main>
  )
}

export default function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Edit Branch">
      <PermissionGuard permission="branches.update" fallback={<AccessDenied />}>
        <EditBranchContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
