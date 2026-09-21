'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, Loader2, Save } from 'lucide-react'
import { gallerySrcList, getMarketplaceMeta, pickTenantMarketplace } from '@/types/marketplace'
import type { TenantMarketplaceSettings } from '@/types/marketplace'
import type { AddressCapabilities } from '@/types/address'
import type { Tenant, TenantTheme } from '@/types'
import { sanitizeBrandingForWrite } from '@/lib/tenant-branding'
import { ImageUploader, EMPTY_IMAGE_FIELD, type ImageFieldValue } from '@/components/ImageUploader'
import { persistableMediaUrl, uploadImageFields } from '@/lib/image-asset-write'
import { DEFAULT_UPLOAD_CONCURRENCY, runWithConcurrency } from '@/lib/upload-concurrency'
import type { TenantMediaWriteRequest } from '@/lib/tenant-media'
import { uploadService } from '@/services/upload.service'
import {
  SOCIAL_PREFIX,
  WEBSITE_PREFIX,
  applyPrefixInput,
  initPrefixedField,
  valueForPrefixedSave,
} from '@/lib/prefixed-input'
import { useUpdateTenantMedia } from '@/hooks'

function galleryFieldsFromUrls(urls: TenantMarketplaceSettings['gallery'] | undefined): ImageFieldValue[] {
  const srcs = gallerySrcList(urls)
  if (!srcs.length) return [{ ...EMPTY_IMAGE_FIELD }]
  return srcs.map((existingUrl) => ({ ...EMPTY_IMAGE_FIELD, existingUrl }))
}

const ADDRESS_CAPABILITY_KEYS: (keyof AddressCapabilities)[] = [
  'cash_on_delivery',
  'scheduled_delivery',
  'same_day',
  'contactless_delivery',
]

type NotifMatrix = Record<string, Record<string, boolean>>

const NOTIF_CHANNELS = ['Email', 'SMS', 'Push', 'In-App'] as const
const NOTIF_EVENTS = [
  'New Order',
  'Order Status Change',
  'New Reservation',
  'SLA Breach',
  'Staff Clock-in',
] as const

const NOTIF_CHANNEL_KEYS: Record<string, string> = {
  Email: 'channelEmail',
  SMS: 'channelSms',
  Push: 'channelPush',
  'In-App': 'notifChannelInApp',
}
const NOTIF_EVENT_KEYS: Record<string, string> = {
  'New Order': 'notifEventNewOrder',
  'Order Status Change': 'notifEventOrderStatusChange',
  'New Reservation': 'notifEventNewReservation',
  'SLA Breach': 'notifEventSlaBreach',
  'Staff Clock-in': 'notifEventStaffClockIn',
}

function SaveBar({ isPending, saved, onSave }: { isPending: boolean; saved: boolean; onSave: () => void }) {
  const t = useTranslations('console')
  return (
    <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t">
      {saved && !isPending && (
        <span className="flex items-center gap-1 text-sm text-[var(--success-text)]">
          <CheckCircle className="w-4 h-4"/> {t('savedLabel')}
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--info)] text-[var(--info-fg)] rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
        {isPending ? t('savingEllipsis') : t('saveChanges')}
      </button>
    </div>
  )
}

/**
 * Console editor for canonical Tenant.settings only.
 * Does not write Branch-owned fields or tenant identity (name/slug/image).
 */
export function TenantCanonicalSettingsForm({
  tenant,
  onSave,
  isPending,
  saved,
}: {
  tenant: Tenant
  onSave: (patch: Record<string, unknown>) => void
  isPending: boolean
  saved: boolean
}) {
  const t = useTranslations('console')
  const tCaps = useTranslations('address.capabilities')
  const existingTheme = tenant.settings?.theme
  const existingMeta = getMarketplaceMeta(tenant.settings)
  const existingCaps = tenant.settings?.addressCapabilities
  const existingMatrix = tenant.settings?.notificationMatrix as NotifMatrix | undefined
  const { mutate: saveMedia, isPending: mediaPending } = useUpdateTenantMedia(tenant.id)

  const [logoField, setLogoField] = useState<ImageFieldValue>({
    ...EMPTY_IMAGE_FIELD,
    existingUrl: tenant.image ?? '',
  })
  const [discoverAvatarField, setDiscoverAvatarField] = useState<ImageFieldValue>({
    ...EMPTY_IMAGE_FIELD,
    existingUrl: tenant.discoverAvatar ?? '',
  })
  const [discoverCoverField, setDiscoverCoverField] = useState<ImageFieldValue>({
    ...EMPTY_IMAGE_FIELD,
    existingUrl: tenant.discoverCover ?? '',
  })

  const [description, setDescription] = useState(tenant.description ?? '')
  const [contactEmail, setContactEmail] = useState(tenant.settings?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(tenant.settings?.contactPhone ?? '')
  const [caps, setCaps] = useState<AddressCapabilities>({
    cash_on_delivery: existingCaps?.cash_on_delivery === true,
    scheduled_delivery: existingCaps?.scheduled_delivery === true,
    same_day: existingCaps?.same_day === true,
    contactless_delivery: existingCaps?.contactless_delivery === true,
  })
  const [primaryColor, setPrimaryColor] = useState(existingTheme?.primaryColor ?? '#2563eb')
  const [fontBody, setFontBody] = useState(existingTheme?.fontBody ?? '')
  const [tagline, setTagline] = useState(existingMeta?.tagline ?? '')
  const [story, setStory] = useState(existingMeta?.story ?? '')
  const [tags, setTags] = useState(existingMeta?.tags?.join(', ') ?? '')
  const [priceLevel, setPriceLevel] = useState<string>(String(existingMeta?.priceLevel ?? ''))
  const [website, setWebsite] = useState(initPrefixedField(existingMeta?.website, WEBSITE_PREFIX))
  const [heroField, setHeroField] = useState<ImageFieldValue>({
    ...EMPTY_IMAGE_FIELD,
    existingUrl: tenant.heroImage ?? '',
  })
  const [galleryFields, setGalleryFields] = useState<ImageFieldValue[]>(() =>
    galleryFieldsFromUrls(existingMeta?.gallery),
  )
  const [instagram, setInstagram] = useState(initPrefixedField(existingMeta?.socialLinks?.instagram, SOCIAL_PREFIX))
  const [twitter, setTwitter] = useState(initPrefixedField(existingMeta?.socialLinks?.twitter, SOCIAL_PREFIX))
  const [facebook, setFacebook] = useState(initPrefixedField(existingMeta?.socialLinks?.facebook, SOCIAL_PREFIX))
  const [youtube, setYoutube] = useState(initPrefixedField(existingMeta?.socialLinks?.youtube, SOCIAL_PREFIX))
  const [featured, setFeatured] = useState(existingMeta?.featured ?? false)
  const [popular, setPopular] = useState(existingMeta?.popular ?? false)
  const [isNew, setIsNew] = useState(existingMeta?.isNew ?? false)
  const [matrix, setMatrix] = useState<NotifMatrix>(() => {
    const base: NotifMatrix = {}
    for (const evt of NOTIF_EVENTS) {
      base[evt] = {}
      for (const ch of NOTIF_CHANNELS) {
        base[evt][ch] = existingMatrix?.[evt]?.[ch] ?? ch === 'In-App'
      }
    }
    return base
  })

  useEffect(() => {
    setDescription(tenant.description ?? '')
    setContactEmail(tenant.settings?.contactEmail ?? '')
    setContactPhone(tenant.settings?.contactPhone ?? '')
    const nextCaps = tenant.settings?.addressCapabilities
    setCaps({
      cash_on_delivery: nextCaps?.cash_on_delivery === true,
      scheduled_delivery: nextCaps?.scheduled_delivery === true,
      same_day: nextCaps?.same_day === true,
      contactless_delivery: nextCaps?.contactless_delivery === true,
    })
    const theme = tenant.settings?.theme
    setPrimaryColor(theme?.primaryColor ?? '#2563eb')
    setFontBody(theme?.fontBody ?? '')
    const m = getMarketplaceMeta(tenant.settings)
    setTagline(m?.tagline ?? '')
    setStory(m?.story ?? '')
    setTags(m?.tags?.join(', ') ?? '')
    setPriceLevel(String(m?.priceLevel ?? ''))
    setWebsite(initPrefixedField(m?.website, WEBSITE_PREFIX))
    setHeroField({ ...EMPTY_IMAGE_FIELD, existingUrl: tenant.heroImage ?? '' })
    setGalleryFields(galleryFieldsFromUrls(m?.gallery))
    setInstagram(initPrefixedField(m?.socialLinks?.instagram, SOCIAL_PREFIX))
    setTwitter(initPrefixedField(m?.socialLinks?.twitter, SOCIAL_PREFIX))
    setFacebook(initPrefixedField(m?.socialLinks?.facebook, SOCIAL_PREFIX))
    setYoutube(initPrefixedField(m?.socialLinks?.youtube, SOCIAL_PREFIX))
    setFeatured(m?.featured ?? false)
    setPopular(m?.popular ?? false)
    setIsNew(m?.isNew ?? false)
    setLogoField({ ...EMPTY_IMAGE_FIELD, existingUrl: tenant.image ?? '' })
    setDiscoverAvatarField({ ...EMPTY_IMAGE_FIELD, existingUrl: tenant.discoverAvatar ?? '' })
    setDiscoverCoverField({ ...EMPTY_IMAGE_FIELD, existingUrl: tenant.discoverCover ?? '' })
  }, [tenant.id, tenant.settings, tenant.description, tenant.image, tenant.discoverAvatar, tenant.discoverCover, tenant.heroImage])

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]'
  const labelClass = 'block text-sm font-medium text-[var(--fg-secondary)] mb-1'
  const hintClass = 'text-xs text-[var(--fg-subtle)] mt-1'

  async function handleSave() {
    const toArr = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)
    const theme: TenantTheme = sanitizeBrandingForWrite({
      ...(existingTheme ?? {}),
      primaryColor,
      fontBody: fontBody || undefined,
    } as TenantTheme & Record<string, unknown>)

    const mediaUploads = await uploadImageFields(
      [
        { key: 'image_asset_id', field: logoField, purpose: 'tenant_logo' },
        { key: 'discover_avatar_asset_id', field: discoverAvatarField, purpose: 'tenant_discover_avatar' },
        { key: 'discover_cover_asset_id', field: discoverCoverField, purpose: 'tenant_discover_cover' },
        { key: 'hero_image_asset_id', field: heroField, purpose: 'tenant_hero' },
      ],
      { tenantId: tenant.id, entityType: 'tenant', entityId: tenant.id },
    )
    const media: TenantMediaWriteRequest = { ...mediaUploads }
    if (Object.keys(media).length > 0) saveMedia(media)

    const galleryResults = await runWithConcurrency(
      galleryFields.map((field, index) => ({
        id: String(index),
        run: async (signal) => {
          if (field.file) {
            const ready = await uploadService.uploadFile({
              file: field.file,
              purpose: 'website_media',
              tenantId: tenant.id,
              entityType: 'tenant',
              entityId: tenant.id,
              signal,
            })
            const src = persistableMediaUrl(ready.url)
            return src ? { asset_id: ready.assetId, src } : { asset_id: ready.assetId }
          }
          if (field.cleared) return null
          const src = persistableMediaUrl(field.existingUrl)
          return src ? src : null
        },
      })),
      { limit: DEFAULT_UPLOAD_CONCURRENCY },
    )
    const failedGallery = galleryResults.find((result) => result.status === 'rejected')
    if (failedGallery) throw failedGallery.error ?? new Error('upload_failed')
    const gallery = galleryResults
      .map((result) => result.value)
      .filter((item): item is string | { asset_id: string; src?: string } => item != null)

    onSave({
      description: description.trim() || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      addressCapabilities: caps,
      theme,
      notificationMatrix: matrix,
      marketplace: pickTenantMarketplace({
        ...existingMeta,
        tagline: tagline || undefined,
        story: story || undefined,
        tags: tags ? toArr(tags) : existingMeta?.tags,
        priceLevel: priceLevel ? (Number(priceLevel) as 1 | 2 | 3 | 4) : existingMeta?.priceLevel,
        website: valueForPrefixedSave(website, WEBSITE_PREFIX),
        gallery,
        featured,
        popular,
        isNew,
        socialLinks: {
          instagram: valueForPrefixedSave(instagram, SOCIAL_PREFIX),
          twitter: valueForPrefixedSave(twitter, SOCIAL_PREFIX),
          facebook: valueForPrefixedSave(facebook, SOCIAL_PREFIX),
          youtube: valueForPrefixedSave(youtube, SOCIAL_PREFIX),
        },
      }),
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('settingsTabGeneral')}</h2>
        <p className="text-xs text-[var(--fg-muted)]">{t('tenantIdentityReadOnlyHint')}</p>
        <div>
          <label className={labelClass}>{t('businessNameLabel')}</label>
          <input type="text"value={tenant.name} readOnly className={`${inputClass} bg-[var(--card-hover)] text-[var(--fg-muted)] cursor-not-allowed`} />
        </div>
        <div>
          <label className={labelClass}>{t('slugLabel')}</label>
          <input type="text"value={tenant.slug} readOnly className={`${inputClass} bg-[var(--card-hover)] font-mono text-[var(--fg-muted)] cursor-not-allowed`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-edit-description">
            {t('tenantDescriptionLabel')} <span className="text-xs font-normal text-[var(--fg-subtle)]">{t('optionalLabel')}</span>
          </label>
          <textarea
            id="tenant-edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('tenantDescriptionPlaceholder')}
            rows={3}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('contactEmailLabel')}</label>
          <input type="email"value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('contactPhoneLabel')}</label>
          <input type="tel"value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--fg-secondary)] mb-2">{t('tenantAddressCapabilitiesLabel')}</p>
          <p className={hintClass}>{t('tenantAddressCapabilitiesHint')}</p>
          <div className="mt-2 space-y-2">
            {ADDRESS_CAPABILITY_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={caps[key]}
                  onChange={(e) => setCaps((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded"
                />
                {tCaps(key)}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('settingsTabBranding')}</h2>
        <div>
          <label className={labelClass}>{t('primaryColorLabel')}</label>
          <div className="flex items-center gap-3">
            <input type="color"value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-16 rounded border cursor-pointer"/>
            <input type="text"value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="border rounded-md px-3 py-2 text-sm w-32 font-mono"/>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('bodyFontLabel')}</label>
          <input type="text"value={fontBody} onChange={(e) => setFontBody(e.target.value)} placeholder="inter"className={inputClass} />
        </div>
        <ImageUploader
          id="tenant-logo"
          label={t('logoUploadLabel')}
          value={logoField}
          onChange={setLogoField}
          hint={t('logoUploadHint')}
          purpose="tenant_logo"
        />
        <ImageUploader
          id="tenant-discover-avatar"
          label={t('discoverAvatarLabel')}
          value={discoverAvatarField}
          onChange={setDiscoverAvatarField}
          purpose="tenant_discover_avatar"
        />
        <ImageUploader
          id="tenant-discover-cover"
          label={t('discoverCoverLabel')}
          value={discoverCoverField}
          onChange={setDiscoverCoverField}
          purpose="tenant_discover_cover"
        />
        <ImageUploader
          id="tenant-hero"
          label={t('heroImageUrlLabel')}
          value={heroField}
          onChange={setHeroField}
          purpose="tenant_hero"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('settingsTabPublicProfile')}</h2>
        <p className="text-sm text-[var(--fg-muted)]">{t('publicProfileDescription')}</p>
        <div>
          <label className={labelClass}>{t('taglineLabel')}</label>
          <input type="text"value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputClass} maxLength={120} />
        </div>
        <div>
          <label className={labelClass}>{t('aboutStoryLabel')}</label>
          <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('discoveryTagsLabel')}</label>
          <input type="text"value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('priceLevelLabel')}</label>
          <select value={priceLevel} onChange={(e) => setPriceLevel(e.target.value)} className={inputClass}>
            <option value="">{t('selectDash')}</option>
            <option value="1">{t('priceLevelBudget')}</option>
            <option value="2">{t('priceLevelModerate')}</option>
            <option value="3">{t('priceLevelUpscale')}</option>
            <option value="4">{t('priceLevelFineDining')}</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox"checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded"/>
            {t('featured')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox"checked={popular} onChange={(e) => setPopular(e.target.checked)} className="rounded"/>
            {t('popular')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox"checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="rounded"/>
            {t('isNewLabel')}
          </label>
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-website">
            {t('websiteLabel')}
          </label>
          <input
            id="tenant-website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(applyPrefixInput(e.target.value, WEBSITE_PREFIX))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-instagram">
            {t('instagramUrlLabel')}
          </label>
          <input
            id="tenant-instagram"
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(applyPrefixInput(e.target.value, SOCIAL_PREFIX))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-twitter">
            {t('twitterUrlLabel')}
          </label>
          <input
            id="tenant-twitter"
            type="text"
            value={twitter}
            onChange={(e) => setTwitter(applyPrefixInput(e.target.value, SOCIAL_PREFIX))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-facebook">
            {t('facebookLabel')}
          </label>
          <input
            id="tenant-facebook"
            type="text"
            value={facebook}
            onChange={(e) => setFacebook(applyPrefixInput(e.target.value, SOCIAL_PREFIX))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tenant-youtube">
            {t('youtubeLabel')}
          </label>
          <input
            id="tenant-youtube"
            type="text"
            value={youtube}
            onChange={(e) => setYoutube(applyPrefixInput(e.target.value, SOCIAL_PREFIX))}
            className={inputClass}
          />
        </div>
        <div className="space-y-3">
          <p className={labelClass}>{t('galleryImageUrlsLabel')}</p>
          {galleryFields.map((field, index) => (
            <ImageUploader
              key={`tenant-gallery-${index}`}
              id={`tenant-gallery-${index}`}
              label={t('galleryImageUrlsLabel')}
              value={field}
              onChange={(next) =>
                setGalleryFields((prev) => prev.map((item, i) => (i === index ? next : item)))
              }
              hint={t('galleryImageUrlsHint')}
              purpose="website_media"
            />
          ))}
          <button
            type="button"
            onClick={() => setGalleryFields((prev) => [...prev, { ...EMPTY_IMAGE_FIELD }])}
            className="text-sm text-[var(--info-text)] hover:underline"
          >
            {t('addGalleryImageLabel')}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('breadcrumbs.notifications')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-[var(--fg-muted)] pb-3 w-48">{t('eventLabel')}</th>
                {NOTIF_CHANNELS.map((c) => (
                  <th key={c} className="text-center font-medium text-[var(--fg-muted)] pb-3 px-4">{t(NOTIF_CHANNEL_KEYS[c])}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {NOTIF_EVENTS.map((evt) => (
                <tr key={evt}>
                  <td className="py-2.5 text-[var(--fg-secondary)]">{t(NOTIF_EVENT_KEYS[evt])}</td>
                  {NOTIF_CHANNELS.map((ch) => (
                    <td key={ch} className="text-center py-2.5">
                      <input
                        type="checkbox"
                        checked={matrix[evt]?.[ch] ?? false}
                        onChange={() =>
                          setMatrix((prev) => ({
                            ...prev,
                            [evt]: { ...prev[evt], [ch]: !prev[evt][ch] },
                          }))
                        }
                        className="rounded"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SaveBar isPending={isPending || mediaPending} saved={saved} onSave={handleSave} />
    </div>
  )
}
