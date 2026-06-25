'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProvisionTenant } from '@/hooks'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'
import type { ProvisionableBusinessType, TenantBrandingConfig } from '@/types/provisioning'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

const BUSINESS_TYPES: ProvisionableBusinessType[] = [
  'restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe',
]

const BUSINESS_TYPE_LABELS: Record<ProvisionableBusinessType, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  bar: 'Bar',
  food_court: 'Food Court',
  food_truck: 'Food Truck',
  mobile_cafe: 'Mobile Cafe',
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

const STEP_LABELS: Record<WizardStep, string> = {
  'business-type': 'Business Type',
  capabilities: 'Capabilities',
  branding: 'Branding Defaults',
  'feature-flags': 'Feature Flags',
  review: 'Review',
  provision: 'Provision',
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6" aria-label={`Step ${current} of ${total}`}>
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
  const router = useRouter()
  const { mutateAsync: provisionTenant } = useProvisionTenant()

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = STEP_ORDER[stepIndex]

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
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
    const req = { name, slug, businessType, capabilityOverrides, branding, featureFlagOverrides }
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
    <main aria-label="New Tenant Wizard" className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Create New Tenant</h1>
      <StepIndicator current={stepIndex + 1} total={TOTAL_STEPS} />

      <h2 className="text-lg font-semibold mb-4" aria-label={`Step: ${STEP_LABELS[currentStep]}`}>
        Step {stepIndex + 1}: {STEP_LABELS[currentStep]}
      </h2>

      {/* Step 1 — Business Type */}
      {currentStep === 'business-type' && (
        <section aria-label="Step 1: Business Type">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="tenant-name">
              Tenant Name
            </label>
            <input
              id="tenant-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Savor Restaurant"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="tenant-slug">
              Slug
            </label>
            <input
              id="tenant-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. savor-restaurant"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">2–63 lowercase letters, numbers, or hyphens</p>
          </div>
          <div>
            <p className="block text-sm font-medium mb-2">Business Type</p>
            <div className="grid grid-cols-2 gap-3" aria-label="Business type selection">
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
                  {BUSINESS_TYPE_LABELS[bt]}
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
        <section aria-label="Step 2: Capabilities">
          <p className="text-sm text-gray-600 mb-4">
            Required capabilities are always enabled. Toggle optional capabilities below.
          </p>
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Required</p>
            {preset.required.map((flag) => (
              <div key={flag} className="flex items-center gap-2 py-1 opacity-60">
                <input type="checkbox" checked readOnly aria-label={flag} />
                <span className="text-sm">{flag}</span>
                <span className="text-xs text-gray-400">(always on)</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Optional</p>
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
        <section aria-label="Step 3: Branding Defaults">
          <p className="text-sm text-gray-600 mb-4">
            Defaults derived from the {BUSINESS_TYPE_LABELS[businessType]} template. Override as needed.
          </p>
          {[
            { label: 'Primary Color', key: 'primaryColor', placeholder: '#e85d04' },
            { label: 'Accent Hover Color', key: 'accentHoverColor', placeholder: '#c24b00' },
            { label: 'Logo URL', key: 'logoUrl', placeholder: 'https://…/logo.png' },
            { label: 'Font Body', key: 'fontBody', placeholder: '"Inter", sans-serif' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="mb-4">
              <label className="block text-sm font-medium mb-1" htmlFor={`branding-${key}`}>
                {label}
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
        <section aria-label="Step 4: Feature Flags">
          <p className="text-sm text-gray-600 mb-4">
            Fine-tune individual feature flags. These override the template and capability selections.
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
        <section aria-label="Step 5: Review">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Name</dt>
              <dd>{name || <span className="text-red-500">Not set</span>}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Slug</dt>
              <dd className="font-mono">{slug || <span className="text-red-500">Not set</span>}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Business Type</dt>
              <dd>{BUSINESS_TYPE_LABELS[businessType]}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Enabled Capabilities</dt>
              <dd>{template.enabledCapabilities.join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Primary Color</dt>
              <dd>{branding.primaryColor ?? template.brandingDefaults.primaryColor ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Feature Flags</dt>
              <dd>
                {Object.entries(generatedFlags)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(', ')}
              </dd>
            </div>
          </dl>
          {validationErrors.length > 0 && (
            <ul className="mt-4 space-y-1" aria-label="Validation errors">
              {validationErrors.map((e) => (
                <li key={e} className="text-red-600 text-sm">• {e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Step 6 — Provision */}
      {currentStep === 'provision' && (
        <section aria-label="Step 6: Provision">
          {!provisionResult ? (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Ready to provision <strong>{name}</strong> as a{' '}
                <strong>{BUSINESS_TYPE_LABELS[businessType]}</strong>.
              </p>
              {validationErrors.length > 0 && (
                <ul className="mb-4 space-y-1" aria-label="Validation errors">
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
                aria-label="Confirm provision"
              >
                {isProvisioning ? 'Provisioning…' : 'Provision Tenant'}
              </button>
            </>
          ) : provisionResult.success ? (
            <div aria-label="Provision success">
              <p className="text-green-700 font-semibold mb-2">Tenant provisioned successfully!</p>
              <p className="text-sm text-gray-600">
                Tenant ID: <span className="font-mono">{provisionResult.tenantId}</span>
              </p>
              <button
                type="button"
                onClick={() => router.push('/admin/tenants')}
                className="mt-4 text-sm text-accent underline"
              >
                Back to Tenants
              </button>
            </div>
          ) : (
            <div aria-label="Provision error">
              <p className="text-red-700 font-semibold mb-2">Provisioning failed</p>
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
          aria-label="Previous step"
        >
          Back
        </button>
        {currentStep !== 'provision' ? (
          <button
            type="button"
            onClick={next}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg"
            aria-label="Next step"
          >
            Next
          </button>
        ) : null}
      </div>
    </main>
  
    </PermissionGuard>
    </ErrorBoundary>
  )
}
