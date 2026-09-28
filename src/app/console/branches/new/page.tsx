'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { BranchTenantContextCard } from '@/components/admin/BranchTenantContextCard'
import { useConsoleCreateBranch, useConsoleTenantId } from '@/hooks'
import {
  BranchFormFields,
  validateBranchCreateStep,
  validateBranchCreateForm,
  branchFormToCreateRequest,
  EMPTY_BRANCH_FORM,
  type BranchCreateStep,
} from '../BranchFormFields'
import { mapBranchCreateError } from '@/types/branch-form'
import { uploadImageFields, type AssetWriteValue } from '@/lib/image-asset-write'
import { useIdempotencyKeys, useSubmissionGuard } from '@/hooks/use-submission-guard'
import { toUploadError } from '@/lib/upload-errors'
import { tenantService } from '@/services/tenant.service'
import { tenantShowsCuisines } from '@/lib/branch-catalog'
import { scrollWizardToTop } from '@/lib/wizard-scroll'
import toast from 'react-hot-toast'

const STEP_ORDER: BranchCreateStep[] = [
  'basic',
  'location',
  'contact',
  'media',
  'operations',
  'catalog',
]

const STEP_LABEL_KEYS: Record<BranchCreateStep, string> = {
  basic: 'stepBasicInformation',
  location: 'stepLocation',
  contact: 'stepContact',
  media: 'stepMedia',
  operations: 'stepOperations',
  catalog: 'stepCategoriesFeatures',
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const t = useTranslations('console')
  return (
    <div className="flex items-center gap-2 mb-6" aria-label={t('stepOfTotalAria', { current, total })}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${i < current ? 'bg-accent' : 'bg-[var(--border)]'}`}
        />
      ))}
      <span className="text-sm text-[var(--fg-muted)] whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  )
}

export default function NewBranchPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryTenantId = searchParams.get('tenantId')?.trim() || undefined
  const workspaceTenantId = useConsoleTenantId()
  const tenantId = queryTenantId || workspaceTenantId || ''
  const { mutateAsync: createBranch, isPending } = useConsoleCreateBranch(tenantId)
  const wizardRef = useRef<HTMLDivElement>(null)
  const readyAssetsRef = useRef<Record<string, AssetWriteValue> | null>(null)
  const readyAssetsSigRef = useRef('')
  const createGuard = useSubmissionGuard(tenantId ? `branch-create:${tenantId}` : undefined)
  const uploadKeys = useIdempotencyKeys()

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenantById(tenantId),
    enabled: !!tenantId,
  })

  const [form, setForm] = useState(EMPTY_BRANCH_FORM)
  const [error, setError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = STEP_ORDER[stepIndex]!
  const showCuisines = tenantShowsCuisines(tenant?.businessTypes)

  function go(index: number) {
    setStepIndex(index)
    scrollWizardToTop(wizardRef.current)
  }

  function next() {
    const validationError = validateBranchCreateStep(form, currentStep)
    if (validationError) {
      setError(validationError)
      toast.error(t(validationError))
      return
    }
    setError(null)
    if (stepIndex < STEP_ORDER.length - 1) go(stepIndex + 1)
  }

  function back() {
    setError(null)
    if (stepIndex > 0) go(stepIndex - 1)
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (stepIndex < STEP_ORDER.length - 1) {
      next()
    }
  }

  function submitCreate() {
    void createGuard.run(async ({ signal, isCurrent }) => {
      if (!tenantId) return
      const validationError = validateBranchCreateForm(form)
      if (validationError) {
        setError(validationError)
        toast.error(t(validationError))
        return
      }
      setError(null)
      const payload = branchFormToCreateRequest(form)
      if (!showCuisines) payload.cuisines = []
      try {
        const sig = [
          form.image.file?.name,
          form.image.file?.size,
          form.image.cleared,
          form.coverImage.file?.name,
          form.coverImage.file?.size,
          form.coverImage.cleared,
          form.heroImage.file?.name,
          form.heroImage.file?.size,
          form.heroImage.cleared,
        ].join('|')
        if (!readyAssetsRef.current || readyAssetsSigRef.current !== sig) {
          readyAssetsRef.current = await uploadImageFields(
            [
              { key: 'image_asset_id', field: form.image, purpose: 'branch_logo', idempotencyKey: uploadKeys.keyFor('branch-logo', form.image.file) },
              { key: 'cover_image_asset_id', field: form.coverImage, purpose: 'branch_cover', idempotencyKey: uploadKeys.keyFor('branch-cover', form.coverImage.file) },
              { key: 'hero_image_asset_id', field: form.heroImage, purpose: 'branch_hero', idempotencyKey: uploadKeys.keyFor('branch-hero', form.heroImage.file) },
            ],
            // Branch does not exist yet. Bind later via image_asset_id on create.
            // Sending entity_type=branch without entity_id makes initiate reject the upload.
            { tenantId, signal },
          )
          readyAssetsSigRef.current = sig
        }
        Object.assign(payload, readyAssetsRef.current)
      } catch (err) {
        if (!isCurrent()) return
        toast.error(t(toUploadError(err).messageKey))
        return
      }
      if (!isCurrent()) return
      try {
        await createBranch(payload)
        uploadKeys.reset()
        toast.success(t('branchCreatedSuccessfully'))
        router.push('/console/branches')
      } catch (err) {
        if (!isCurrent()) return
        toast.error(t(mapBranchCreateError(err)))
      }
    })
  }

  return (
    <ErrorBoundary feature="New Branch">
      <PermissionGuard permission="branches.create" fallback={<AccessDenied />}>
        <main className="p-6 max-w-2xl mx-auto" ref={wizardRef}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('addBranchLabel')}</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-1">{t('createNewBranchHint')}</p>
          </div>

          {tenant && <BranchTenantContextCard tenant={tenant} mode="create" />}

          <StepIndicator current={stepIndex + 1} total={STEP_ORDER.length} />
          <p className="text-sm font-medium mb-4">{t(STEP_LABEL_KEYS[currentStep])}</p>

          <form onSubmit={handleFormSubmit}>
            <BranchFormFields
              form={form}
              onChange={setForm}
              sections={[currentStep]}
              showLocale={false}
              showMap={currentStep === 'location'}
              showCuisines={showCuisines}
            />
            {error && <p className="text-sm text-[var(--danger-text)] mt-3">{t(error)}</p>}

            <div className="flex justify-between pt-4">
              {stepIndex === 0 ? (
                <button
                  type="button"
                  onClick={() => router.push('/console/branches')}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--card-hover)] transition-colors"
                >
                  {t('cancel')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={back}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--card-hover)] transition-colors"
                >
                  {t('backLabel')}
                </button>
              )}
              {stepIndex < STEP_ORDER.length - 1 ? (
                <button
                  key="wizard-next"
                  type="button"
                  data-testid="branch-wizard-next"
                  onClick={next}
                  className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {t('nextLabel')}
                </button>
              ) : (
                <button
                  key="wizard-create"
                  type="button"
                  data-testid="branch-wizard-create"
                  onClick={submitCreate}
                  disabled={createGuard.locked || isPending || !tenantId}
                  className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {createGuard.locked || isPending ? t('creatingEllipsis') : t('createBranchLabel')}
                </button>
              )}
            </div>
          </form>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
