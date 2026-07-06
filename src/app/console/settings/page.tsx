'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Settings, Palette, Clock, Plug, Bell, Shield, Save, CheckCircle, Loader2, Globe, ToggleLeft, ToggleRight, XCircle, Flag } from 'lucide-react'
import { getMarketplaceMeta } from '@/types/marketplace'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { Badge } from '@/components/ui'
import { useTenantStore } from '@/stores'
import { useUpdateTenantSettings, useFeatureFlags, useUpdateFeatureFlag } from '@/hooks'
import type { TenantTheme } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

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

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

type DayKey = (typeof DAYS)[number]

interface HoursEntry { open: string; close: string; isOpen: boolean }
type HoursMap = Record<DayKey, HoursEntry>

function defaultHours(existing?: unknown): HoursMap {
  const map = existing as Record<string, HoursEntry> | undefined
  return Object.fromEntries(
    DAYS.map((day) => [day, map?.[day] ?? { open: '09:00', close: '22:00', isOpen: true }]),
  ) as HoursMap
}

interface SaveBarProps { isPending: boolean; saved: boolean; onSave: () => void }
function SaveBar({ isPending, saved, onSave }: SaveBarProps) {
  const t = useTranslations('console')
  return (
    <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t">
      {saved && !isPending && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> {t('savedLabel')}
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isPending ? t('savingEllipsis') : t('saveChanges')}
      </button>
    </div>
  )
}

function GeneralTab() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const [contactEmail, setContactEmail] = useState(
    (tenant?.settings?.contactEmail as string | undefined) ?? '',
  )
  const [contactPhone, setContactPhone] = useState(
    (tenant?.settings?.contactPhone as string | undefined) ?? '',
  )

  function handleSave() {
    save({ contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('businessNameLabel')}</label>
        <input
          type="text"
          value={tenant?.name ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">{t('managedByAccountSettings')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('businessTypeLabel')}</label>
        <input
          type="text"
          value={tenant?.businessTypes?.join(', ') ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 capitalize cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tenantIdLabel')}</label>
        <input
          type="text"
          value={tenant?.id ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm font-mono text-gray-500 bg-gray-50 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contactEmailLabel')}</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="contact@example.com"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contactPhoneLabel')}</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+1 555-000-0000"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
  const existingTheme = tenant?.settings?.theme as TenantTheme | undefined
  const [primaryColor, setPrimaryColor] = useState(existingTheme?.primaryColor ?? '#2563eb')
  const [logoUrl, setLogoUrl] = useState(existingTheme?.logoUrl ?? '')
  const [fontBody, setFontBody] = useState(existingTheme?.fontBody ?? '')

  useEffect(() => {
    const theme = tenant?.settings?.theme as TenantTheme | undefined
    if (theme) {
      setPrimaryColor(theme.primaryColor ?? '#2563eb')
      setLogoUrl(theme.logoUrl ?? '')
      setFontBody(theme.fontBody ?? '')
    }
  }, [tenant?.slug])

  function handleSave() {
    const theme: TenantTheme = {
      ...(existingTheme ?? {}),
      primaryColor,
      logoUrl: logoUrl || undefined,
      fontBody: fontBody || undefined,
    }
    save({ theme })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('primaryColorLabel')}</label>
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
            className="border rounded-md px-3 py-2 text-sm w-32 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('logoUrlLabel')}</label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('bodyFontLabel')}</label>
        <input
          type="text"
          value={fontBody}
          onChange={(e) => setFontBody(e.target.value)}
          placeholder='"Inter", sans-serif'
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function HoursTab() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const [hours, setHours] = useState<HoursMap>(() =>
    defaultHours(tenant?.settings?.businessHours),
  )

  function setDay(day: DayKey, patch: Partial<HoursEntry>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  function handleSave() {
    save({ businessHours: hours })
  }

  return (
    <div className="space-y-3">
      {DAYS.map((day, i) => (
        <div key={day} className="flex items-center gap-4 text-sm">
          <span className="w-28 text-gray-600 shrink-0">{t(`weekday.${DAY_KEYS[i]}`)}</span>
          <input
            type="time"
            value={hours[day].open}
            onChange={(e) => setDay(day, { open: e.target.value })}
            disabled={!hours[day].isOpen}
            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          />
          <span className="text-gray-400">–</span>
          <input
            type="time"
            value={hours[day].close}
            onChange={(e) => setDay(day, { close: e.target.value })}
            disabled={!hours[day].isOpen}
            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          />
          <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={hours[day].isOpen}
              onChange={(e) => setDay(day, { isOpen: e.target.checked })}
              className="rounded"
            />
            {t('openLabel')}
          </label>
        </div>
      ))}
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
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
              <th className="text-left font-medium text-gray-600 pb-3 w-48">{t('eventLabel')}</th>
              {CHANNELS.map((c) => (
                <th key={c} className="text-center font-medium text-gray-600 pb-3 px-4">{t(NOTIF_CHANNEL_KEYS[c])}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {EVENTS.map((evt) => (
              <tr key={evt}>
                <td className="py-2.5 text-gray-700">{t(NOTIF_EVENT_KEYS[evt])}</td>
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
  const [description, setDescription] = useState(existingMeta?.description ?? '')
  const [story, setStory] = useState(existingMeta?.story ?? '')
  const [cuisines, setCuisines] = useState(existingMeta?.cuisines?.join(', ') ?? '')
  const [tags, setTags] = useState(existingMeta?.tags?.join(', ') ?? '')
  const [priceLevel, setPriceLevel] = useState<string>(String(existingMeta?.priceLevel ?? ''))
  const [phone, setPhone] = useState(existingMeta?.phone ?? '')
  const [email, setEmail] = useState(existingMeta?.email ?? '')
  const [website, setWebsite] = useState(existingMeta?.website ?? '')
  const [coverImage, setCoverImage] = useState(existingMeta?.coverImage ?? '')
  const [gallery, setGallery] = useState(existingMeta?.gallery?.join('\n') ?? '')
  const [amenities, setAmenities] = useState(existingMeta?.amenities?.join(', ') ?? '')
  const [instagram, setInstagram] = useState(existingMeta?.socialLinks?.instagram ?? '')
  const [twitter, setTwitter] = useState(existingMeta?.socialLinks?.twitter ?? '')

  useEffect(() => {
    const m = getMarketplaceMeta(tenant?.settings)
    if (m) {
      setTagline(m.tagline ?? '')
      setDescription(m.description ?? '')
      setStory(m.story ?? '')
      setCuisines(m.cuisines?.join(', ') ?? '')
      setTags(m.tags?.join(', ') ?? '')
      setPriceLevel(String(m.priceLevel ?? ''))
      setPhone(m.phone ?? '')
      setEmail(m.email ?? '')
      setWebsite(m.website ?? '')
      setCoverImage(m.coverImage ?? '')
      setGallery(m.gallery?.join('\n') ?? '')
      setAmenities(m.amenities?.join(', ') ?? '')
      setInstagram(m.socialLinks?.instagram ?? '')
      setTwitter(m.socialLinks?.twitter ?? '')
    }
  }, [tenant?.slug])

  function handleSave() {
    const toArr = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)
    const toLines = (s: string) => s.split('\n').map((v) => v.trim()).filter(Boolean)
    save({
      marketplace: {
        ...existingMeta,
        tagline: tagline || undefined,
        description: description || existingMeta?.description || '',
        story: story || undefined,
        cuisines: cuisines ? toArr(cuisines) : (existingMeta?.cuisines ?? []),
        tags: tags ? toArr(tags) : (existingMeta?.tags ?? []),
        priceLevel: priceLevel ? (Number(priceLevel) as 1 | 2 | 3 | 4) : existingMeta?.priceLevel,
        phone: phone || undefined,
        email: email || undefined,
        website: website || undefined,
        coverImage: coverImage || existingMeta?.coverImage || '',
        gallery: gallery ? toLines(gallery) : existingMeta?.gallery,
        amenities: amenities ? toArr(amenities) : existingMeta?.amenities,
        socialLinks: {
          ...existingMeta?.socialLinks,
          instagram: instagram || undefined,
          twitter: twitter || undefined,
        },
      },
    })
  }

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const hintClass = 'text-xs text-gray-400 mt-1'

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 mb-4">
        {t('publicProfileDescription')}
      </p>

      <div>
        <label className={labelClass}>{t('taglineLabel')}</label>
        <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
          placeholder={t('taglinePlaceholder')} className={inputClass} maxLength={120} />
        <p className={hintClass}>{t('taglineHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('shortDescriptionLabel')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder={t('shortDescriptionPlaceholder')} rows={3}
          className={inputClass} maxLength={200} />
        <p className={hintClass}>{t('shortDescriptionHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('aboutStoryLabel')}</label>
        <textarea value={story} onChange={(e) => setStory(e.target.value)}
          placeholder={t('aboutStoryPlaceholder')} rows={5}
          className={inputClass} />
        <p className={hintClass}>{t('aboutStoryHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('cuisinesSpecialtiesLabel')}</label>
        <input type="text" value={cuisines} onChange={(e) => setCuisines(e.target.value)}
          placeholder="Mediterranean, Italian, Coffee" className={inputClass} />
        <p className={hintClass}>{t('commaSeparatedSearchHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('discoveryTagsLabel')}</label>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
          placeholder="Date Night, Pet Friendly, Outdoor Seating" className={inputClass} />
        <p className={hintClass}>{t('discoveryTagsHint')}</p>
      </div>

      <div>
        <label className={labelClass}>{t('amenitiesLabel')}</label>
        <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)}
          placeholder="WiFi, Parking, Outdoor Seating, Takeaway" className={inputClass} />
        <p className={hintClass}>{t('amenitiesHint')}</p>
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

      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('contactInformationLabel')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('publicPhoneLabel')}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555-000-0000" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('publicEmailLabel')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@yourbusiness.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('websiteLabel')}</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourbusiness.com" className={inputClass} />
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('socialMediaLabel')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('instagramUrlLabel')}</label>
            <input type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourbusiness" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('twitterUrlLabel')}</label>
            <input type="url" value={twitter} onChange={(e) => setTwitter(e.target.value)}
              placeholder="https://twitter.com/yourbusiness" className={inputClass} />
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('mediaLabel')}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('coverImageUrlLabel')}</label>
            <input type="url" value={coverImage} onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://example.com/cover.jpg" className={inputClass} />
            <p className={hintClass}>{t('coverImageHint')}</p>
          </div>
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
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
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
      <div className="flex items-center justify-center h-48 gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('loadingFeatureFlags')}
      </div>
    )
  }

  if (isError || !flags) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <XCircle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-gray-600">{t('failedToLoadFeatureFlags')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-4">
        {t('featureFlagsTabDescription')}
      </p>
      {flags.map((flag) => (
        <div
          key={flag.key}
          className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border hover:border-gray-300 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-medium text-gray-800">{flag.key}</span>
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
              <ToggleRight className="w-8 h-8 text-blue-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-400" />
            )}
          </button>
        </div>
      ))}
      {flags.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">{t('noFeatureFlagsConfigured')}</p>
      )}
    </div>
  )
}

function SettingsContent() {
  const t = useTranslations('console')
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('settingsTitle')}</h1>
          <PreviewButton href="/" label={t('previewPublicSite')} size="sm" />
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
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t(labelKey)}
                </button>
              )
            })}
          </nav>

          <div className="flex-1 bg-white rounded-lg border p-6">
            <h2 className="text-base font-semibold mb-5">{t(TAB_CONFIG[activeTab].labelKey)}</h2>
            <ErrorBoundary feature={`Settings — ${TAB_CONFIG[activeTab].labelKey}`}>
              {activeTab === 'general'        && <GeneralTab />}
              {activeTab === 'branding'       && <BrandingTab />}
              {activeTab === 'hours'          && <HoursTab />}
              {activeTab === 'publicprofile'  && <PublicProfileTab />}
              {activeTab === 'integrations'   && <PlaceholderSection labelKey="settingsTabIntegrations" />}
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
      <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
        <SettingsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
