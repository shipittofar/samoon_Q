'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useConsoleCreateBranch, useConsoleTenantId } from '@/hooks'
import {
  BranchFormFields,
  validateBranchForm,
  branchFormToWriteRequest,
  EMPTY_BRANCH_FORM,
} from '../BranchFormFields'
import toast from 'react-hot-toast'

export default function NewBranchPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const searchParams = useSearchParams()
  // Prefer explicit tenantId from Step 6 CTA so the new Branch attaches to the
  // newly provisioned Tenant, not whatever was previously active in the workspace.
  const queryTenantId = searchParams.get('tenantId')?.trim() || undefined
  const workspaceTenantId = useConsoleTenantId()
  const tenantId = queryTenantId || workspaceTenantId || ''
  const { mutate: createBranch, isPending } = useConsoleCreateBranch(tenantId)

  const [form, setForm] = useState(EMPTY_BRANCH_FORM)
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
    createBranch(branchFormToWriteRequest(form), {
      onSuccess: () => {
        toast.success(t('branchCreatedSuccessfully'))
        router.push('/console/branches')
      },
      onError: (err) => {
        toast.error(err instanceof Error && err.message === 'duplicate_slug' ? t('duplicateSlugError') : t('failedToCreateBranchRetry'))
      },
    })
  }

  return (
    <ErrorBoundary feature="New Branch">
      <PermissionGuard permission="branches.create"fallback={<AccessDenied />}>
        <main className="p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('addBranchLabel')}</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-1">{t('createNewBranchHint')}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <BranchFormFields form={form} onChange={setForm} />
            {error && <p className="text-sm text-[var(--danger-text)] mt-3">{t(error)}</p>}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => router.push('/console/branches')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--card-hover)] transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending || !tenantId}
                className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
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
