'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { useProvisionTenant } from '@/hooks'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import type { ProvisionableBusinessType, TenantBrandingConfig, TenantProvisionResult } from '@/types/provisioning'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { BrandingDefaultsStep } from '@/components/admin/tenant-provisioning/BrandingDefaultsStep'
import { getProvisionedTenantDisplay, getCreateFirstBranchHref, tenantStatusLabelKey } from '@/lib/provision-result-display'
import { scrollWizardToTop } from '@/lib/wizard-scroll'

const BUSINESS_TYPES: ProvisionableBusinessType[] = [
  'restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe',
]

const BUSINESS_TYPE_LABEL_KEYS: Record<ProvisionableBusinessType, string> = {
  restaurant: 'businessTypeRestaurant',
  cafe: 'businessTypeCafe',
  bar: 'businessTypeBar',
  food_court: 'businessTypeFoodCourt',
  food_truck: 'businessTypeFoodTruck',
  mobile_cafe: 'businessTypeMobileCafe',
}

const TOTAL_STEPS = 6

type WizardStep =
  | 'business-type'
  | 'capabilities'
  | 'branding'
  | 'feature-flags'
  | 'review'
  | 'provision'

const STEP_ORDER: WizardStep[] = [
  'business-type',
  'capabilities',
  'branding',
  'feature-flags',
  'review',
  'provision',
]

const STEP_LABEL_KEYS: Record<WizardStep, string> = {
  'business-type': 'businessTypeLabel',
  capabilities: 'capabilitiesAria',
  branding: 'brandingDefaultsLabel',
  'feature-flags': 'featureFlagsLabel',
  review: 'reviewLabel',
  provision: 'provisionLabel',
}

function groupFeatureFlags(flags: Record<string, boolean>): [string, { key: string; value: boolean }[]][] {
  const groups = new Map<string, { key: string; value: boolean }[]>()
  for (const [key, value] of Object.entries(flags)) {
    const prefix = key.split('.')[0] ?? 'other'
    const list = groups.get(prefix) ?? []
    list.push({ key, value })
    groups.set(prefix, list)
  }
  return Array.from(groups.entries())
}

function formatFlagGroup(prefix: string): string {
  return prefix.replace(/_/g, ' ')
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const t = useTranslations('console')
  return (
    <div className="flex items-center gap-2 mb-6" aria-label={t('stepOfTotalAria', { current, total })}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${i < current ? 'bg-accent' : 'bg-gray-200'}`}
        />
      ))}
      <span className="text-sm text-gray-500 whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  )
}

function ProvisionSuccessPanel({
  result,
  onBackToTenants,
  onCreateFirstBranch,
}: {
  result: TenantProvisionResult
  onBackToTenants: () => void
  onCreateFirstBranch: (tenantId: string) => void
}) {
  const t = useTranslations('console')
  const {
    name: responseName,
    slug: responseSlug,
    status,
    tenantId,
    slugMissing,
    isInactive,
  } = getProvisionedTenantDisplay(result)

  if (slugMissing) {
    return (
      <div aria-label={t('provisionErrorAria')}>
        <p className="text-amber-700 font-semibold mb-2">{t('tenantProvisionedSuccessfully')}</p>
        <p className="text-sm text-red-600 mb-4">{t('provisionSlugMissingHint')}</p>
        {responseName ? (
          <dl className="space-y-3 text-sm mb-4">
            <div>
              <dt className="font-medium text-gray-500">{t('nameLabel')}</dt>
              <dd>{responseName}</dd>
            </div>
          </dl>
        ) : null}
        <button
          type="button"
          onClick={onBackToTenants}
          className="mt-2 text-sm text-accent underline"
        >
          {t('backToTenantsLabel')}
        </button>
      </div>
    )
  }

  return (
    <div aria-label={t('provisionSuccessAria')}>
      <p className="text-green-700 font-semibold mb-2">{t('tenantProvisionedSuccessfully')}</p>
      {isInactive ? (
        <p className="text-sm text-gray-600 mb-4" data-testid="provision-inactive-explanation">
          {t('provisionInactiveNoBranchExplanation')}
        </p>
      ) : null}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-gray-500">{t('nameLabel')}</dt>
          <dd data-testid="provisioned-tenant-name">{responseName ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">{t('slugLabel')}</dt>
          <dd data-testid="provisioned-tenant-slug" className="font-mono">
            {responseSlug}
          </dd>
        </div>
        {status ? (
          <div>
            <dt className="font-medium text-gray-500">{t('statusColumnLabel')}</dt>
            <dd data-testid="provisioned-tenant-status">{t(tenantStatusLabelKey(status))}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {tenantId ? (
          <button
            type="button"
            data-testid="create-first-branch-cta"
            data-tenant-id={tenantId}
            onClick={() => onCreateFirstBranch(tenantId)}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg font-medium"
          >
            {t('createFirstBranchLabel')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBackToTenants}
          className="px-4 py-2 text-sm text-accent underline"
        >
          {t('backToTenantsLabel')}
        </button>
      </div>
    </div>
  )
}

export default function NewTenantPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const { mutateAsync: provisionTenant } = useProvisionTenant()

  const wizardRef = useRef<HTMLElement>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = STEP_ORDER[stepIndex]

  useEffect(() => {
    scrollWizardToTop(wizardRef.current)
  }, [stepIndex])

  // Form state
  const [name, setName] = useState('')
  // const [slug, setSlug] = useState('')
  const [businessType, setBusinessType] = useState<ProvisionableBusinessType>('restaurant')
  const [capabilityOverrides, setCapabilityOverrides] = useState<Record<string, boolean>>({})
  const [branding, setBranding] = useState<TenantBrandingConfig>({})
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [featureFlagOverrides, setFeatureFlagOverrides] = useState<Record<string, boolean>>({})
  const [provisionResult, setProvisionResult] = useState<TenantProvisionResult | null>(null)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const template = tenantProvisioningService.getTemplate(businessType)
  const preset = tenantProvisioningService.getCapabilityPreset(businessType)
  const generatedFlags = tenantProvisioningService.generateFeatureFlags(businessType, { ...capabilityOverrides, ...featureFlagOverrides })

  function next() {
    setValidationErrors([])
    if (stepIndex < TOTAL_STEPS - 1) setStepIndex((s) => s + 1)
  }
  function back() {
    setValidationErrors([])
    if (stepIndex > 0) setStepIndex((s) => s - 1)
  }

  async function handleProvision() {
    // const req = { name, slug, businessType, capabilityOverrides, branding, featureFlagOverrides }
    const req = { name, businessType, capabilityOverrides, branding, featureFlagOverrides, image: logoFile }
    const validation = tenantProvisioningService.validateTenantConfiguration(req)
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      return
    }
    setIsProvisioning(true)
    try {
      const result = await provisionTenant(req)
      setProvisionResult(result)
    } finally {
      setIsProvisioning(false)
    }
  }

  return (
    <ErrorBoundary feature="New Tenant">
    <PermissionGuard permission="tenant.manage" fallback={<AccessDenied />}>
    <main ref={wizardRef} aria-label={t('newTenantWizardAria')} className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t('createNewTenantTitle')}</h1>
      <StepIndicator current={stepIndex + 1} total={TOTAL_STEPS} />

      <h2 className="text-lg font-semibold mb-4" aria-label={t('stepColonLabel', { label: t(STEP_LABEL_KEYS[currentStep]) })}>
        {t('stepNumberColonLabel', { number: stepIndex + 1, label: t(STEP_LABEL_KEYS[currentStep]) })}
      </h2>

      {/* Step 1 — Business Type */}
      {currentStep === 'business-type' && (
        <section aria-label={t('stepNumberColonLabel', { number: 1, label: t('businessTypeLabel') })}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="tenant-name">
              {t('tenantNameLabel')} <span className="text-xs font-normal text-gray-400">{t('optionalLabel')}</span>
            </label>
            <input
              id="tenant-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tenantNamePlaceholder')}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {/* <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="tenant-slug">
              {t('slugLabel')}
            </label>
            <input
              id="tenant-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder={t('tenantSlugPlaceholder')}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{t('slugCharsHint')}</p>
          </div> */}
          <div>
            <p className="block text-sm font-medium mb-2">{t('businessTypeLabel')}</p>
            <div className="grid grid-cols-2 gap-3" aria-label={t('businessTypeSelectionAria')}>
              {BUSINESS_TYPES.map((bt) => {
                const selected = businessType === bt
                return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBusinessType(bt)}
                  data-selected={selected ? 'true' : 'false'}
                  className={`relative border rounded-lg p-3 text-sm text-left transition-colors ${
                    selected
                      ? 'border-accent bg-accent/5 font-semibold ring-2 ring-accent'
                      : 'border-gray-200'
                  }`}
                  aria-pressed={selected}
                >
                  {selected ? (
                    <span className="absolute top-2 end-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('fontSelectedLabel')}
                    </span>
                  ) : null}
                  <span className="block pr-16">{t(BUSINESS_TYPE_LABEL_KEYS[bt])}</span>
                  <span className="block text-xs text-gray-500 mt-1 font-normal">
                    {tenantProvisioningService.getTemplate(bt).enabledCapabilities.join(', ')}
                  </span>
                </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Step 2 — Capabilities */}
      {currentStep === 'capabilities' && (
        <section aria-label={t('stepNumberColonLabel', { number: 2, label: t('capabilitiesAria') })}>
          <p className="text-sm text-gray-600 mb-4">
            {t('requiredMenuOnlyHint')}
          </p>
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('requiredLabel')}</p>
            {preset.required.map((flag) => (
              <div key={flag} className="flex items-center gap-2 py-1 opacity-60">
                <input type="checkbox" checked readOnly aria-required="true" aria-label={flag} />
                <span className="text-sm">{flag === 'menu.enabled' ? t('menuCapabilityLabel') : flag}</span>
                <span className="text-xs text-gray-400">{t('alwaysOnParenthetical')}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('optionalLabel')}</p>
            {Object.entries(preset.optional).map(([flag, defaultVal]) => {
              const value = capabilityOverrides[flag] ?? defaultVal
              return (
                <div key={flag} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id={`cap-${flag}`}
                    checked={value}
                    onChange={(e) =>
                      setCapabilityOverrides((prev) => ({ ...prev, [flag]: e.target.checked }))
                    }
                    aria-label={flag}
                  />
                  <label htmlFor={`cap-${flag}`} className="text-sm">{flag}</label>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Step 3 — Branding */}
      {currentStep === 'branding' && (
        <section aria-label={t('stepNumberColonLabel', { number: 3, label: t('brandingDefaultsLabel') })}>
          <p className="text-sm text-gray-600 mb-4">
            {t('defaultsDerivedFromTemplateHint', { type: t(BUSINESS_TYPE_LABEL_KEYS[businessType]) })}
          </p>
          <BrandingDefaultsStep
            branding={branding}
            onChange={setBranding}
            logoFile={logoFile}
            onLogoFileChange={setLogoFile}
            templateDefaults={template.brandingDefaults}
          />
        </section>
      )}

      {/* Step 4 — Feature Flags */}
      {currentStep === 'feature-flags' && (
        <section aria-label={t('stepNumberColonLabel', { number: 4, label: t('featureFlagsLabel') })}>
          <p className="text-sm text-gray-600 mb-4">
            {t('fineTuneFeatureFlagsHint')}
          </p>
          <div className="space-y-5" data-testid="feature-flags-section">
            {groupFeatureFlags(generatedFlags).map(([prefix, items]) => (
              <fieldset key={prefix} className="rounded-xl border border-gray-200 p-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-1">
                  {formatFlagGroup(prefix)}
                </legend>
                <div className="space-y-1 mt-1">
                  {items.map(({ key: flag, value: val }) => {
                    const override = featureFlagOverrides[flag]
                    const effective = override !== undefined ? override : val
                    return (
                      <div key={flag} className="flex items-center gap-2 py-1.5">
                        <input
                          type="checkbox"
                          id={`ff-${flag}`}
                          checked={effective}
                          onChange={(e) =>
                            setFeatureFlagOverrides((prev) => ({ ...prev, [flag]: e.target.checked }))
                          }
                          aria-label={flag}
                        />
                        <label htmlFor={`ff-${flag}`} className="text-sm font-mono break-all">
                          {flag}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      )}

      {/* Step 5 — Review */}
      {currentStep === 'review' && (
        <section aria-label={t('stepNumberColonLabel', { number: 5, label: t('reviewLabel') })}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">{t('nameLabel')}</dt>
              <dd>{name || <span className="text-gray-400">{t('notSetLabel')}</span>}</dd>
            </div>
            {/* <div>
              <dt className="font-medium text-gray-500">{t('slugLabel')}</dt>
              <dd className="font-mono">{slug || <span className="text-red-500">{t('notSetLabel')}</span>}</dd>
            </div> */}
            <div>
              <dt className="font-medium text-gray-500">{t('businessTypeLabel')}</dt>
              <dd>{t(BUSINESS_TYPE_LABEL_KEYS[businessType])}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('enabledCapabilitiesLabel')}</dt>
              <dd>{template.enabledCapabilities.join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('primaryColorLabel')}</dt>
              <dd>{branding.primaryColor ?? template.brandingDefaults.primaryColor ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('logoUploadLabel')}</dt>
              <dd>{logoFile ? logoFile.name : '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('featureFlagsLabel')}</dt>
              <dd>
                {Object.entries(generatedFlags)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(', ')}
              </dd>
            </div>
          </dl>
          {validationErrors.length > 0 && (
            <ul className="mt-4 space-y-1" aria-label={t('validationErrorsAria')}>
              {validationErrors.map((e) => (
                <li key={e} className="text-red-600 text-sm">• {e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Step 6 — Provision */}
      {currentStep === 'provision' && (
        <section aria-label={t('stepNumberColonLabel', { number: 6, label: t('provisionLabel') })}>
          {!provisionResult ? (
            <>
              <p className="text-sm text-gray-600 mb-6">
                {t('readyToProvisionAsType', { name, type: t(BUSINESS_TYPE_LABEL_KEYS[businessType]) })}
              </p>
              {validationErrors.length > 0 && (
                <ul className="mb-4 space-y-1" aria-label={t('validationErrorsAria')}>
                  {validationErrors.map((e) => (
                    <li key={e} className="text-red-600 text-sm">• {e}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={handleProvision}
                disabled={isProvisioning}
                className="w-full bg-accent text-white py-2 rounded-lg font-medium disabled:opacity-50"
                aria-label={t('confirmProvisionAria')}
              >
                {isProvisioning ? t('provisioningEllipsis') : t('provisionTenantLabel')}
              </button>
            </>
          ) : provisionResult.success ? (
            <ProvisionSuccessPanel
              result={provisionResult}
              onBackToTenants={() => router.push('/console/tenants')}
              onCreateFirstBranch={(tenantId) => {
                router.push(getCreateFirstBranchHref(tenantId))
              }}
            />
          ) : (
            <div aria-label={t('provisionErrorAria')}>
              <p className="text-red-700 font-semibold mb-2">{t('provisioningFailedLabel')}</p>
              <ul className="space-y-1">
                {provisionResult.errors?.map((e) => (
                  <li key={e} className="text-red-600 text-sm">• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={back}
          disabled={stepIndex === 0}
          className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
          aria-label={t('previousStepAria')}
        >
          {t('backLabel')}
        </button>
        {currentStep !== 'provision' ? (
          <button
            type="button"
            onClick={next}
            data-testid="wizard-next"
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg"
            aria-label={t('nextStepAria')}
          >
            {t('nextLabel')}
          </button>
        ) : null}
      </div>
    </main>
  
    </PermissionGuard>
    </ErrorBoundary>
  )
}
