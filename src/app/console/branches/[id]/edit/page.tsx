'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useAdminBranch, useUpdateBranch, useBranchAccess } from '@/hooks'
import {
  BranchFormFields,
  validateBranchForm,
  branchFormToWriteRequest,
  branchToFormInput,
  type BranchFormState,
} from '../../BranchFormFields'
import toast from 'react-hot-toast'

function EditBranchContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const router = useRouter()
  const { data: branch, isLoading, error: loadError } = useAdminBranch(id)
  const { mutate: updateBranch, isPending } = useUpdateBranch()

  const [form, setForm] = useState<BranchFormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branch) setForm(branchToFormInput(branch))
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
        payload: branchFormToWriteRequest(form),
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
  // Phase 9.4 — defense-in-depth only (see useBranchAccess()'s doc
  // comment): a direct navigation to a branch outside the session's
  // branchAccess must not reach EditBranchContent (and therefore must not
  // fire useAdminBranch()/useUpdateBranch()) at all. The backend remains
  // the actual enforcement point for these endpoints.
  const hasBranchAccess = useBranchAccess(id)
  return (
    <ErrorBoundary feature="Edit Branch">
      <PermissionGuard permission="branches.update" fallback={<AccessDenied />}>
        {hasBranchAccess ? <EditBranchContent id={id} /> : <AccessDenied />}
      </PermissionGuard>
    </ErrorBoundary>
  )
}
