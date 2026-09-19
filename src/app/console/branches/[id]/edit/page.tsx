'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { BranchTenantContextCard } from '@/components/admin/BranchTenantContextCard'
import { useAdminBranch, useUpdateBranch, useBranchAccess } from '@/hooks'
import {
  BranchFormFields,
  validateBranchForm,
  branchFormToWriteRequest,
  branchToFormInput,
  type BranchFormState,
} from '../../BranchFormFields'
import { mapBranchUpdateError } from '@/types/branch-form'
import { tenantService } from '@/services/tenant.service'
import { tenantShowsCuisines } from '@/lib/branch-catalog'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { APP_URL } from '@/constants'
import toast from 'react-hot-toast'

function EditBranchContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const router = useRouter()
  const { data: branch, isLoading, error: loadError } = useAdminBranch(id)
  const { mutate: updateBranch, isPending } = useUpdateBranch()
  const tenantId = branch?.tenantId ?? ''

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenantById(tenantId),
    enabled: !!tenantId,
  })

  const [form, setForm] = useState<BranchFormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branch) setForm(branchToFormInput(branch))
  }, [branch])

  const showCuisines = tenantShowsCuisines(tenant?.businessTypes) || Boolean(form?.cuisines.length)

  if (isLoading || !form) return <p className="p-6 text-[var(--fg-muted)]">{t('loadingBranchEllipsis')}</p>
  if (loadError || !branch) return <p className="p-6 text-[var(--danger-text)]">{t('branchNotFoundPeriod')}</p>

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
          toast.error(t(mapBranchUpdateError(err)))
        },
      },
    )
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('editColonName', { name: branch.name })}</h1>
      </div>

      {tenant && <BranchTenantContextCard tenant={tenant} mode="edit" />}

      <form onSubmit={handleSubmit}>
        <BranchFormFields
          form={form}
          onChange={setForm}
          showLocale
          showMap
          showCuisines={showCuisines}
        />
        {error && <p className="text-sm text-[var(--danger-text)] mt-3">{t(error)}</p>}

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={() => router.push(`/console/branches/${id}`)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--card-hover)] transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {isPending ? <>{t('savingEllipsis')}</> : t('saveChanges')}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <QrManagementPanel
          scope="branch"
          entityId={branch.id}
          tenantId={tenantId || undefined}
          canManage
          publicUrl={tenant?.slug ? `${APP_URL}/${tenant.slug}/${branch.slug}` : undefined}
          publicUrlLabel={t('currentPublicPageLabel')}
          title={t('branchQrTitle')}
          description={t('branchQrDescription')}
          sectionAria={t('branchQrSectionAria')}
        />
      </div>
    </main>
  )
}

export default function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hasBranchAccess = useBranchAccess(id)
  return (
    <ErrorBoundary feature="Edit Branch">
      <PermissionGuard permission="branches.update" fallback={<AccessDenied />}>
        {hasBranchAccess ? <EditBranchContent id={id} /> : <AccessDenied />}
      </PermissionGuard>
    </ErrorBoundary>
  )
}
