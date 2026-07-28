'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTenantStore } from '@/stores'
import { useCreateBranch, useConsoleCreateBranch } from '@/hooks'
import {
  BranchFormFields, validateBranchForm, defaultBranchFormBusinessHours, DEFAULT_BRANCH_SETTINGS,
  type BranchFormState,
} from '../BranchFormFields'
import toast from 'react-hot-toast'

const EMPTY_FORM: BranchFormState = {
  name: '', slug: '', description: '', type: 'physical',
  address: '', city: '', country: '', postalCode: '',
  phone_number: '', email: '', image: '', coverImage: '',
  timeZone: '', currency: '', language: '', isDefault: false,
  businessHours: defaultBranchFormBusinessHours(),
  settings: { ...DEFAULT_BRANCH_SETTINGS },
}

export default function NewBranchPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { mutate: createBranch, isPending } = useConsoleCreateBranch(tenantId)

  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    const validationError = validateBranchForm(form)
    if (validationError) {
      setError(validationError)
      toast.error(t(validationError))
      return
    }
    setError(null)
    createBranch(
      {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
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
      {
        onSuccess: () => {
          toast.success(t('branchCreatedSuccessfully'))
          router.push('/console/branches')
        },
        onError: (err) => {
          toast.error(err instanceof Error && err.message === 'duplicate_slug' ? t('duplicateSlugError') : t('failedToCreateBranchRetry'))
        },
      },
    )
  }

  return (
    <ErrorBoundary feature="New Branch">
      <PermissionGuard permission="branches.create" fallback={<AccessDenied />}>
        <main className="p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('addBranchLabel')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('createNewBranchHint')}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <BranchFormFields form={form} onChange={setForm} />
            {error && <p className="text-sm text-red-500 mt-3">{t(error)}</p>}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => router.push('/console/branches')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2 text-sm bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? t('creatingEllipsis') : t('createBranchLabel')}
              </button>
            </div>
          </form>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
