'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Settings, Palette, Clock, Plug, Bell, Save, CheckCircle, Loader2, Globe, ToggleLeft, ToggleRight, XCircle, Flag } from 'lucide-react'
import { getMarketplaceMeta, pickTenantMarketplace } from '@/types/marketplace'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { Badge } from '@/components/ui'
import { useTenantStore } from '@/stores'
import { useUpdateTenantSettings, useFeatureFlags, useUpdateFeatureFlag } from '@/hooks'
import type { TenantTheme } from '@/types'
import { resolveTenantImage, sanitizeBrandingForWrite } from '@/lib/tenant-branding'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

const TABS = ['general', 'branding', 'hours', 'publicprofile', 'integrations', 'notifications', 'feature-flags'] as const
type Tab = (typeof TABS)[number]

const TAB_CONFIG: Record<Tab, { labelKey: string; icon: React.ElementType }> = {
  general:        { labelKey: 'settingsTabGeneral',        icon: Settings     },
  branding:       { labelKey: 'settingsTabBranding',       icon: Palette      },
  hours:          { labelKey: 'settingsTabBusinessHours', icon: Clock        },
  publicprofile:  { labelKey: 'settingsTabPublicProfile', icon: Globe        },
  integrations:   { labelKey: 'settingsTabIntegrations',   icon: Plug         },
  notifications:  { labelKey: 'breadcrumbs.notifications',  icon: Bell         },
  'feature-flags':{ labelKey: 'settingsTabFeatureFlags',  icon: Flag         },
}

interface SaveBarProps { isPending: boolean; saved: boolean; onSave: () => void }
function SaveBar({ isPending, saved, onSave }: SaveBarProps) {
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

function GeneralTab() {
  const t = useTranslations('console')
  const tCaps = useTranslations('address.capabilities')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const [contactEmail, setContactEmail] = useState(tenant?.settings?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(tenant?.settings?.contactPhone ?? '')
  const existingCaps = tenant?.settings?.addressCapabilities
  const [caps, setCaps] = useState({
    cash_on_delivery: existingCaps?.cash_on_delivery === true,
    scheduled_delivery: existingCaps?.scheduled_delivery === true,
    same_day: existingCaps?.same_day === true,
    contactless_delivery: existingCaps?.contactless_delivery === true,
  })

  function handleSave() {
    save({
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      addressCapabilities: caps,
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('businessNameLabel')}</label>
        <input
          type="text"
          value={tenant?.name ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-[var(--card-hover)] text-[var(--fg-muted)] cursor-not-allowed"
        />
        <p className="text-xs text-[var(--fg-subtle)] mt-1">{t('managedByAccountSettings')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('businessTypeLabel')}</label>
        <input
          type="text"
          value={tenant?.businessTypes?.join(', ') ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-[var(--card-hover)] text-[var(--fg-muted)] capitalize cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('tenantIdLabel')}</label>
        <input
          type="text"
          value={tenant?.id ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm font-mono text-[var(--fg-muted)] bg-[var(--card-hover)] cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('contactEmailLabel')}</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="contact@example.com"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('contactPhoneLabel')}</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+1 555-000-0000"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--fg-secondary)] mb-2">{t('tenantAddressCapabilitiesLabel')}</p>
        <p className="text-xs text-[var(--fg-subtle)] mb-2">{t('tenantAddressCapabilitiesHint')}</p>
        <div className="space-y-2">
          {(['cash_on_delivery', 'scheduled_delivery', 'same_day', 'contactless_delivery'] as const).map((key) => (
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
      <CopyUrlWidget
        url={`${APP_URL}/${tenant?.slug ?? ''}`}
        label={t('publicUrlLabel')}
      />
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function BrandingTab() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const existingTheme = tenant?.settings?.theme
  const existingImage = resolveTenantImage(tenant)
  const [primaryColor, setPrimaryColor] = useState(existingTheme?.primaryColor ?? '#2563eb')
  const [fontBody, setFontBody] = useState(existingTheme?.fontBody ?? '')

  useEffect(() => {
    const theme = tenant?.settings?.theme
    if (theme) {
      setPrimaryColor(theme.primaryColor ?? '#2563eb')
      setFontBody(theme.fontBody ?? '')
    }
  }, [tenant?.slug])

  function handleSave() {
    const theme: TenantTheme = sanitizeBrandingForWrite({
      ...(existingTheme ?? {}),
      primaryColor,
      fontBody: fontBody || undefined,
    } as TenantTheme & Record<string, unknown>)
    save({ theme })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-2">{t('primaryColorLabel')}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-16 rounded border cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-32 font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
      </div>
      {existingImage ? (
        <div>
          <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('logoUploadLabel')}</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingImage}
            alt={t('logoPreviewLabel')}
            className="h-12 w-auto object-contain border rounded-md bg-[var(--card)] p-1"
          />
          <p className="text-xs text-[var(--fg-muted)] mt-1">{t('logoUploadHint')}</p>
        </div>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-[var(--fg-secondary)] mb-1">{t('bodyFontLabel')}</label>
        <input
          type="text"
          value={fontBody}
          onChange={(e) => setFontBody(e.target.value)}
          placeholder="inter"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function HoursTab() {
  const t = useTranslations('console')
  return (
    <div className="space-y-3 text-sm text-[var(--fg-muted)]">
      <p>{t('hoursManagedPerBranch')}</p>
      <Link href="/console/branches"className="inline-flex text-[var(--info-text)] hover:underline">
        {t('manageBranchesLink')}
      </Link>
    </div>
  )
}

type NotifMatrix = Record<string, Record<string, boolean>>

const NOTIF_CHANNEL_KEYS: Record<string, string> = {
  Email: 'channelEmail', SMS: 'channelSms', Push: 'channelPush', 'In-App': 'notifChannelInApp',
}
const NOTIF_EVENT_KEYS: Record<string, string> = {
  'New Order': 'notifEventNewOrder',
  'Order Status Change': 'notifEventOrderStatusChange',
  'New Reservation': 'notifEventNewReservation',
  'SLA Breach': 'notifEventSlaBreach',
  'Staff Clock-in': 'notifEventStaffClockIn',
}

function NotificationsTab() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()

  const CHANNELS = ['Email', 'SMS', 'Push', 'In-App'] as const
  const EVENTS = ['New Order', 'Order Status Change', 'New Reservation', 'SLA Breach', 'Staff Clock-in'] as const
  type Channel = (typeof CHANNELS)[number]
  type Event = (typeof EVENTS)[number]

  const existingMatrix = tenant?.settings?.notificationMatrix as NotifMatrix | undefined

  const [matrix, setMatrix] = useState<NotifMatrix>(() => {
    const base: NotifMatrix = {}
    for (const evt of EVENTS) {
      base[evt] = {}
      for (const ch of CHANNELS) {
        base[evt][ch] = existingMatrix?.[evt]?.[ch] ?? ch === 'In-App'
      }
    }
    return base
  })

  function toggle(evt: Event, ch: Channel) {
    setMatrix((prev) => ({
      ...prev,
      [evt]: { ...prev[evt], [ch]: !prev[evt][ch] },
    }))
  }

  function handleSave() {
    save({ notificationMatrix: matrix })
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-[var(--fg-muted)] pb-3 w-48">{t('eventLabel')}</th>
              {CHANNELS.map((c) => (
                <th key={c} className="text-center font-medium text-[var(--fg-muted)] pb-3 px-4">{t(NOTIF_CHANNEL_KEYS[c])}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {EVENTS.map((evt) => (
              <tr key={evt}>
                <td className="py-2.5 text-[var(--fg-secondary)]">{t(NOTIF_EVENT_KEYS[evt])}</td>
                {CHANNELS.map((ch) => (
                  <td key={ch} className="text-center py-2.5">
                    <input
                      type="checkbox"
                      checked={matrix[evt]?.[ch] ?? false}
                      onChange={() => toggle(evt, ch)}
                      className="rounded"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function PublicProfileTab() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const existingMeta = getMarketplaceMeta(tenant?.settings)

  const [tagline, setTagline] = useState(existingMeta?.tagline ?? '')
  const [story, setStory] = useState(existingMeta?.story ?? '')
  const [tags, setTags] = useState(existingMeta?.tags?.join(', ') ?? '')
  const [priceLevel, setPriceLevel] = useState<string>(String(existingMeta?.priceLevel ?? ''))
  const [website, setWebsite] = useState(existingMeta?.website ?? '')
  const [gallery, setGallery] = useState(existingMeta?.gallery?.join('\n') ?? '')
  const [instagram, setInstagram] = useState(existingMeta?.socialLinks?.instagram ?? '')
  const [twitter, setTwitter] = useState(existingMeta?.socialLinks?.twitter ?? '')
  const [facebook, setFacebook] = useState(existingMeta?.socialLinks?.facebook ?? '')
  const [youtube, setYoutube] = useState(existingMeta?.socialLinks?.youtube ?? '')
  const [featured, setFeatured] = useState(existingMeta?.featured ?? false)
  const [popular, setPopular] = useState(existingMeta?.popular ?? false)
  const [isNew, setIsNew] = useState(existingMeta?.isNew ?? false)

  useEffect(() => {
    const m = getMarketplaceMeta(tenant?.settings)
    if (m) {
      setTagline(m.tagline ?? '')
      setStory(m.story ?? '')
      setTags(m.tags?.join(', ') ?? '')
      setPriceLevel(String(m.priceLevel ?? ''))
      setWebsite(m.website ?? '')
      setGallery(m.gallery?.join('\n') ?? '')
      setInstagram(m.socialLinks?.instagram ?? '')
      setTwitter(m.socialLinks?.twitter ?? '')
      setFacebook(m.socialLinks?.facebook ?? '')
      setYoutube(m.socialLinks?.youtube ?? '')
      setFeatured(m.featured ?? false)
      setPopular(m.popular ?? false)
      setIsNew(m.isNew ?? false)
    }
  }, [tenant?.slug])

  function handleSave() {
    const toArr = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)
    const toLines = (s: string) => s.split('\n').map((v) => v.trim()).filter(Boolean)
    save({
      marketplace: pickTenantMarketplace({
        ...existingMeta,
        tagline: tagline || undefined,
        story: story || undefined,
        tags: tags ? toArr(tags) : existingMeta?.tags,
        priceLevel: priceLevel ? (Number(priceLevel) as 1 | 2 | 3 | 4) : existingMeta?.priceLevel,
        website: website || undefined,
        gallery: gallery ? toLines(gallery) : existingMeta?.gallery,
        featured,
        popular,
        isNew,
        socialLinks: {
          instagram: instagram || undefined,
          twitter: twitter || undefined,
          facebook: facebook || undefined,
          youtube: youtube || undefined,
        },
      }),
    })
  }

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]'
  const labelClass = 'block text-sm font-medium text-[var(--fg-secondary)] mb-1'
  const hintClass = 'text-xs text-[var(--fg-subtle)] mt-1'

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--fg-muted)] mb-4">
        {t('publicProfileDescription')}
      </p>

      <div>
        <label className={labelClass}>{t('taglineLabel')}</label>
        <input type="text"value={tagline} onChange={(e) => setTagline(e.target.value)}
          placeholder={t('taglinePlaceholder')} className={inputClass} maxLength={120} />
        <p className={hintClass}>{t('taglineHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('aboutStoryLabel')}</label>
        <textarea value={story} onChange={(e) => setStory(e.target.value)}
          placeholder={t('aboutStoryPlaceholder')} rows={5}
          className={inputClass} />
        <p className={hintClass}>{t('aboutStoryHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('discoveryTagsLabel')}</label>
        <input type="text"value={tags} onChange={(e) => setTags(e.target.value)}
          placeholder={t('tagsExamplePlaceholder')} className={inputClass} />
        <p className={hintClass}>{t('discoveryTagsHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('priceLevelLabel')}</label>
        <select value={priceLevel} onChange={(e) => setPriceLevel(e.target.value)}
          className={inputClass}>
          <option value="">{t('selectDash')}</option>
          <option value="1">{t('priceLevelBudget')}</option>
          <option value="2">{t('priceLevelModerate')}</option>
          <option value="3">{t('priceLevelUpscale')}</option>
          <option value="4">{t('priceLevelFineDining')}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-[var(--fg-secondary)]">
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
        <label className={labelClass}>{t('websiteLabel')}</label>
        <input type="url"value={website} onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://yourbusiness.com"className={inputClass} />
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-[var(--fg-secondary)] mb-3">{t('socialMediaLabel')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('instagramUrlLabel')}</label>
            <input type="url"value={instagram} onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourbusiness"className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('twitterUrlLabel')}</label>
            <input type="url"value={twitter} onChange={(e) => setTwitter(e.target.value)}
              placeholder="https://twitter.com/yourbusiness"className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Facebook</label>
            <input type="url"value={facebook} onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://facebook.com/yourbusiness"className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>YouTube</label>
            <input type="url"value={youtube} onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourbusiness"className={inputClass} />
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-[var(--fg-secondary)] mb-3">{t('mediaLabel')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('galleryImageUrlsLabel')}</label>
            <textarea value={gallery} onChange={(e) => setGallery(e.target.value)}
              placeholder={'https://example.com/image1.jpg\nhttps://example.com/image2.jpg'} rows={4}
              className={inputClass} />
            <p className={hintClass}>{t('galleryImageUrlsHint')}</p>
          </div>
        </div>
      </div>

      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function PlaceholderSection({ labelKey }: { labelKey: string }) {
  const t = useTranslations('console')
  return (
    <div className="flex flex-col items-center justify-center h-48 text-[var(--fg-subtle)] gap-2">
      <p className="text-sm">{t('settingsSectionComingSoon', { section: t(labelKey) })}</p>
    </div>
  )
}

const SOURCE_KEY: Record<string, string> = {
  module_default:  'sourceModuleDefault',
  capability:      'sourceCapability',
  tenant_override: 'sourceTenantOverride',
}
const SOURCE_BADGE_VARIANT: Record<string, 'secondary' | 'info' | 'success'> = {
  module_default:  'secondary',
  capability:      'info',
  tenant_override: 'success',
}

function FeatureFlagsTab() {
  const t = useTranslations('console')
  const { data: flags, isLoading, isError } = useFeatureFlags()
  const { mutate: updateFlag, isPending } = useUpdateFeatureFlag()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)] text-sm">
        <Loader2 className="w-4 h-4 animate-spin"/>
        {t('loadingFeatureFlags')}
      </div>
    )
  }

  if (isError || !flags) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <XCircle className="w-6 h-6 text-[var(--danger-text)]"/>
        <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadFeatureFlags')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--fg-muted)] mb-4">
        {t('featureFlagsTabDescription')}
      </p>
      {flags.map((flag) => (
        <div
          key={flag.key}
          className="flex items-center justify-between py-3 px-4 bg-[var(--card-hover)] rounded-lg border hover:border-[var(--border-input)] transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-medium text-[var(--fg)]">{flag.key}</span>
              <Badge variant={SOURCE_BADGE_VARIANT[flag.source] ?? 'secondary'}>
                {SOURCE_KEY[flag.source] ? t(SOURCE_KEY[flag.source]) : flag.source}
              </Badge>
            </div>
          </div>
          <button
            onClick={() => updateFlag({ key: flag.key, value: !flag.value })}
            disabled={isPending}
            className={`ml-4 shrink-0 transition-colors ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={t('toggleFlagAria', { key: flag.key })}
          >
            {flag.value ? (
              <ToggleRight className="w-8 h-8 text-[var(--info-text)]"/>
            ) : (
              <ToggleLeft className="w-8 h-8 text-[var(--fg-subtle)]"/>
            )}
          </button>
        </div>
      ))}
      {flags.length === 0 && (
        <p className="text-sm text-[var(--fg-muted)] text-center py-8">{t('noFeatureFlagsConfigured')}</p>
      )}
    </div>
  )
}

function SettingsContent() {
  const t = useTranslations('console')
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <div className="min-h-screen bg-[var(--card-hover)]">
      <div className="bg-[var(--card)] border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('settingsTitle')}</h1>
          <PreviewButton href="/"label={t('previewPublicSite')} size="sm"/>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <nav className="w-44 shrink-0 space-y-1">
            {TABS.map((tab) => {
              const { labelKey, icon: Icon } = TAB_CONFIG[tab]
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    activeTab === tab
                      ? 'bg-[var(--info-subtle)] text-[var(--info-text)] font-medium'
                      : 'text-[var(--fg-muted)] hover:bg-[var(--card-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0"/>
                  {t(labelKey)}
                </button>
              )
            })}
          </nav>

          <div className="flex-1 bg-[var(--card)] rounded-lg border p-6">
            <h2 className="text-base font-semibold mb-5">{t(TAB_CONFIG[activeTab].labelKey)}</h2>
            <ErrorBoundary feature={`Settings — ${TAB_CONFIG[activeTab].labelKey}`}>
              {activeTab === 'general'        && <GeneralTab />}
              {activeTab === 'branding'       && <BrandingTab />}
              {activeTab === 'hours'          && <HoursTab />}
              {activeTab === 'publicprofile'  && <PublicProfileTab />}
              {activeTab === 'integrations'   && <PlaceholderSection labelKey="settingsTabIntegrations"/>}
              {activeTab === 'notifications'  && <NotificationsTab />}
              {activeTab === 'feature-flags'  && <FeatureFlagsTab />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ErrorBoundary feature="Settings">
      <PermissionGuard permission="settings.view"fallback={<AccessDenied />}>
        <SettingsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
