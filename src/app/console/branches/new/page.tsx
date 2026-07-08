'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTenantStore } from '@/stores'
import { useCreateBranch } from '@/hooks'
import type { BranchType } from '@/types/branch'
import toast from 'react-hot-toast'

export default function NewBranchPage() {
  const t = useTranslations('console')
  const router = useRouter()
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { mutate: createBranch, isPending } = useCreateBranch(tenantId)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [type, setType] = useState<BranchType>('physical')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !address.trim() || !city.trim() || !country.trim()) {
      toast.error(t('fillAllRequiredFieldsError'))
      return
    }
    createBranch(
      {
        name: name.trim(),
        slug: slug.trim(),
        type,
        location: { address: address.trim(), city: city.trim(), country: country.trim(), postalCode: postalCode.trim() || undefined },
        contact: { phone: phone.trim() || undefined, email: email.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast.success(t('branchCreatedSuccessfully'))
          router.push('/console/branches')
        },
        onError: () => toast.error(t('failedToCreateBranchRetry')),
      },
    )
  }

  return (
    <ErrorBoundary feature="New Branch">
      <PermissionGuard permission="branches.manage" fallback={<AccessDenied />}>
        <main className="p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('addBranchLabel')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('createNewBranchHint')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
              <legend className="text-sm font-semibold text-gray-700 px-1">{t('basicInformationLabel')}</legend>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="branch-name">
                  {t('nameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="branch-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
                  }}
                  placeholder={t('downtownBranchPlaceholder')}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="branch-slug">
                  {t('slugLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="branch-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder={t('downtownBranchSlugPlaceholder')}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="text-xs text-gray-500 mt-1">{t('lowercaseSlugHint')}</p>
              </div>

              <div>
                <p className="block text-sm font-medium mb-2">{t('tableHeaders.type')} <span className="text-red-500">*</span></p>
                <div className="flex gap-3">
                  {(['physical', 'mobile'] as BranchType[]).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setType(bt)}
                      className={`flex-1 border rounded-lg py-2 text-sm capitalize transition-colors ${
                        type === bt ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      aria-pressed={type === bt}
                    >
                      {bt === 'physical' ? t('branchTypePhysical') : t('branchTypeMobile')}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Location */}
            <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
              <legend className="text-sm font-semibold text-gray-700 px-1">{t('locationLabel')}</legend>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="branch-address">
                  {t('addressLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="branch-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="branch-city">
                    {t('cityLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="branch-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('newYorkExamplePlaceholder')}
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="branch-country">
                    {t('countryLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="branch-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="US"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="branch-postal">
                  {t('postalCodeLabel')}
                </label>
                <input
                  id="branch-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10001"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </fieldset>

            {/* Contact */}
            <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
              <legend className="text-sm font-semibold text-gray-700 px-1">{t('contactOptionalLabel')}</legend>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="branch-phone">{t('phoneLabel')}</label>
                  <input
                    id="branch-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 212 555 0100"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="branch-email">{t('emailLabel')}</label>
                  <input
                    id="branch-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="branch@example.com"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex justify-between pt-2">
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
