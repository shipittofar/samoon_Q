'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
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
import { tenantService } from '@/services/tenant.service'
import { resolveTenantImage } from '@/lib/tenant-branding'
import { tenantShowsCuisines } from '@/lib/branch-catalog'
import { scrollWizardToTop } from '@/lib/wizard-scroll'
import toast from 'react-hot-toast'
import type { Tenant } from '@/types'

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

const BUSINESS_TYPE_LABEL_KEYS: Record<string, string> = {
  restaurant: 'businessTypeRestaurant',
  cafe: 'businessTypeCafe',
  bar: 'businessTypeBar',
  food_court: 'businessTypeFoodCourt',
  food_truck: 'businessTypeFoodTruck',
  mobile_cafe: 'businessTypeMobileCafe',
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

function TenantContextCard({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const logo = resolveTenantImage(tenant)
  return (
    <section
      aria-label={t('tenantContextAria')}
      className="mb-6 rounded-lg border border-[var(--border)] p-4 flex gap-4 items-center"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-14 w-14 rounded-lg object-cover border border-[var(--border)]" />
      ) : (
        <div className="h-14 w-14 rounded-lg bg-[var(--card-hover)] border border-[var(--border)]" />
      )}
      <div className="min-w-0">
        <p className="text-xs text-[var(--fg-muted)]">{t('createBranchForTenant', { name: tenant.name })}</p>
        <p className="text-base font-semibold truncate">{tenant.name}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
          {(tenant.businessTypes ?? []).map((bt) => t(BUSINESS_TYPE_LABEL_KEYS[bt] ?? 'businessTypeLabel')).join(', ') || t('businessTypeLabel')}
        </p>
      </div>
    </section>
  )
}

export default function NewBranchPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryTenantId = searchParams.get('tenantId')?.trim() || undefined
  const workspaceTenantId = useConsoleTenantId()
  const tenantId = queryTenantId || workspaceTenantId || ''
  const { mutate: createBranch, isPending } = useConsoleCreateBranch(tenantId)
  const wizardRef = useRef<HTMLDivElement>(null)

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    if (stepIndex < STEP_ORDER.length - 1) {
      next()
      return
    }
    const validationError = validateBranchCreateForm(form)
    if (validationError) {
      setError(validationError)
      toast.error(t(validationError))
      return
    }
    setError(null)
    const payload = branchFormToCreateRequest(form)
    if (!showCuisines) payload.cuisines = []
    createBranch(payload, {
      onSuccess: () => {
        toast.success(t('branchCreatedSuccessfully'))
        router.push('/console/branches')
      },
      onError: (err) => {
        toast.error(t(mapBranchCreateError(err)))
      },
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

          {tenant && <TenantContextCard tenant={tenant} />}

          <StepIndicator current={stepIndex + 1} total={STEP_ORDER.length} />
          <p className="text-sm font-medium mb-4">{t(STEP_LABEL_KEYS[currentStep])}</p>

          <form onSubmit={handleSubmit}>
            <BranchFormFields
              form={form}
              onChange={setForm}
              sections={[currentStep]}
              showSlug={false}
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
                  type="button"
                  onClick={next}
                  className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {t('nextLabel')}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isPending || !tenantId}
                  className="px-6 py-2 text-sm bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {isPending ? t('creatingEllipsis') : t('createBranchLabel')}
                </button>
              )}
            </div>
          </form>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
