'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useProvisionTenant } from '@/hooks'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import type { ProvisionableBusinessType, TenantBrandingConfig } from '@/types/provisioning'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

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

export default function NewTenantPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const { mutateAsync: provisionTenant } = useProvisionTenant()

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = STEP_ORDER[stepIndex]

  // Form state
  const [name, setName] = useState('')
  // const [slug, setSlug] = useState('')
  const [businessType, setBusinessType] = useState<ProvisionableBusinessType>('restaurant')
  const [capabilityOverrides, setCapabilityOverrides] = useState<Record<string, boolean>>({})
  const [branding, setBranding] = useState<TenantBrandingConfig>({})
  const [featureFlagOverrides, setFeatureFlagOverrides] = useState<Record<string, boolean>>({})
  const [provisionResult, setProvisionResult] = useState<{ success: boolean; tenantId?: string; errors?: string[] } | null>(null)
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
    const req = { name, businessType, capabilityOverrides, branding, featureFlagOverrides }
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
    <main aria-label={t('newTenantWizardAria')} className="p-6 max-w-2xl mx-auto">
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
              {t('tenantNameLabel')}
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
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBusinessType(bt)}
                  className={`border rounded-lg p-3 text-sm text-left transition-colors ${
                    businessType === bt ? 'border-accent bg-accent/5 font-semibold' : 'border-gray-200'
                  }`}
                  aria-pressed={businessType === bt}
                >
                  {t(BUSINESS_TYPE_LABEL_KEYS[bt])}
                  <span className="block text-xs text-gray-500 mt-1 font-normal">
                    {tenantProvisioningService.getTemplate(bt).enabledCapabilities.join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Step 2 — Capabilities */}
      {currentStep === 'capabilities' && (
        <section aria-label={t('stepNumberColonLabel', { number: 2, label: t('capabilitiesAria') })}>
          <p className="text-sm text-gray-600 mb-4">
            {t('requiredCapabilitiesHint')}
          </p>
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('requiredLabel')}</p>
            {preset.required.map((flag) => (
              <div key={flag} className="flex items-center gap-2 py-1 opacity-60">
                <input type="checkbox" checked readOnly aria-label={flag} />
                <span className="text-sm">{flag}</span>
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
          {[
            { labelKey: 'primaryColorLabel', key: 'primaryColor', placeholder: '#e85d04' },
            { labelKey: 'accentHoverColorLabel', key: 'accentHoverColor', placeholder: '#c24b00' },
            { labelKey: 'logoUrlLabel', key: 'logoUrl', placeholder: 'https://…/logo.png' },
            { labelKey: 'bodyFontLabel', key: 'fontBody', placeholder: '"Inter", sans-serif' },
          ].map(({ labelKey, key, placeholder }) => (
            <div key={key} className="mb-4">
              <label className="block text-sm font-medium mb-1" htmlFor={`branding-${key}`}>
                {t(labelKey)}
              </label>
              <input
                id={`branding-${key}`}
                type="text"
                value={(branding as Record<string, string>)[key] ?? ''}
                onChange={(e) =>
                  setBranding((prev) => ({ ...prev, [key]: e.target.value || undefined }))
                }
                placeholder={placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </section>
      )}

      {/* Step 4 — Feature Flags */}
      {currentStep === 'feature-flags' && (
        <section aria-label={t('stepNumberColonLabel', { number: 4, label: t('featureFlagsLabel') })}>
          <p className="text-sm text-gray-600 mb-4">
            {t('fineTuneFeatureFlagsHint')}
          </p>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {Object.entries(generatedFlags).map(([flag, val]) => {
              const override = featureFlagOverrides[flag]
              const effective = override !== undefined ? override : val
              return (
                <div key={flag} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id={`ff-${flag}`}
                    checked={effective}
                    onChange={(e) =>
                      setFeatureFlagOverrides((prev) => ({ ...prev, [flag]: e.target.checked }))
                    }
                    aria-label={flag}
                  />
                  <label htmlFor={`ff-${flag}`} className="text-sm font-mono">{flag}</label>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Step 5 — Review */}
      {currentStep === 'review' && (
        <section aria-label={t('stepNumberColonLabel', { number: 5, label: t('reviewLabel') })}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">{t('nameLabel')}</dt>
              <dd>{name || <span className="text-red-500">{t('notSetLabel')}</span>}</dd>
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
            <div aria-label={t('provisionSuccessAria')}>
              <p className="text-green-700 font-semibold mb-2">{t('tenantProvisionedSuccessfully')}</p>
              <p className="text-sm text-gray-600">
                {t('tenantIdColonValue', { id: provisionResult.tenantId ?? '' })}
              </p>
              <button
                type="button"
                onClick={() => router.push('/console/tenants')}
                className="mt-4 text-sm text-accent underline"
              >
                {t('backToTenantsLabel')}
              </button>
            </div>
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
