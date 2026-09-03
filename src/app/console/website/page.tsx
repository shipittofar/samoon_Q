'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Layout, Image, Info, Phone, Palette, Eye,
  Globe, GitBranch, Save, Upload, RotateCcw, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, GripVertical, Layers, Cpu,
} from 'lucide-react'
import { cn } from '@/utils'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useTenantStore, useBranchStore } from '@/stores'
import {
  useHomepageLayout, useSaveLayout, usePublishLayout,
  useRestoreVersion, useBranchOverrides, useSaveBranchOverrides,
  useConsoleTenantId,
} from '@/hooks'
import type {
  HomepageLayout, SectionConfig, SectionKey, HeroContent,
  AboutContent, ContactContent, BranchContentOverrides,
  HomepageVersion, BrandThemeName, HeroConfig, SectionTemplates,
  HeroLayoutVariant, HeroBackgroundType, HeroPrimaryCtaType, HeroSecondaryCtaType,
  GalleryTemplate, ReviewsTemplate, ContactTemplate, AboutTemplate,
} from '@/types/website-builder'
import {
  SECTION_LABELS, BRAND_THEMES, DEFAULT_BRAND_THEME,
  HERO_LAYOUT_LABELS, HERO_PRIMARY_CTA_LABELS, HERO_SECONDARY_CTA_LABELS,
  DEFAULT_HERO_CONFIG, DEFAULT_SECTION_TEMPLATES,
  GALLERY_TEMPLATE_LABELS, REVIEWS_TEMPLATE_LABELS,
  CONTACT_TEMPLATE_LABELS, ABOUT_TEMPLATE_LABELS,
} from '@/types/website-builder'

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = 'theme' | 'layout' | 'templates' | 'hero' | 'content' | 'modules' | 'preview' | 'branches' | 'versions'

const TABS: { value: Tab; labelKey: string; icon: React.ElementType }[] = [
  { value: 'theme',     labelKey: 'websiteTabTheme',      icon: Palette },
  { value: 'layout',   labelKey: 'websiteTabSections',   icon: Layout },
  { value: 'templates', labelKey: 'websiteTabTemplates',  icon: Layers },
  { value: 'hero',     labelKey: 'websiteTabHero',       icon: Image },
  { value: 'content',  labelKey: 'websiteTabContent',    icon: Info },
  { value: 'modules',  labelKey: 'websiteTabModules',    icon: Cpu },
  { value: 'preview',  labelKey: 'websiteTabPreview',    icon: Eye },
  { value: 'branches', labelKey: 'breadcrumbs.branches', icon: GitBranch },
  { value: 'versions', labelKey: 'websiteTabVersions',   icon: RotateCcw },
]

// ── Shared field helpers ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, multiline,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const cls = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  if (multiline) {
    return (
      <textarea
        className={cn(cls, 'resize-none')}
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }
  return (
    <input
      type="text"
      className={cls}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function NumberInput({ value, onChange, min = 0, max = 1, step = 0.05, placeholder }: {
  value?: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; placeholder?: string
}) {
  return (
    <input
      type="number"
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      value={value ?? ''}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      min={min} max={max} step={step}
      placeholder={placeholder}
    />
  )
}

function SelectInput<T extends string>({
  value, onChange, options,
}: {
  value?: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function PillSelector<T extends string>({
  value, onChange, options,
}: {
  value?: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            value === o.value
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
              : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Theme Tab ─────────────────────────────────────────────────────────────────

function ThemeTab({
  brandTheme, onChange,
}: {
  brandTheme: BrandThemeName
  onChange: (t: BrandThemeName) => void
}) {
  const t = useTranslations('console')
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        {t('themeTabDescription')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BRAND_THEMES.map((theme) => {
          const selected = brandTheme === theme.name
          return (
            <button
              key={theme.name}
              type="button"
              onClick={() => onChange(theme.name)}
              className={cn(
                'text-left p-4 rounded-xl border-2 transition-all',
                selected
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2'
                  : 'border-[var(--border)] hover:border-[var(--accent)]',
              )}
            >
              {/* Color swatch strip */}
              <div className="flex gap-1 mb-3 rounded-md overflow-hidden h-6">
                <div className="flex-1"style={{ backgroundColor: theme.tokens.bg }} />
                <div className="flex-1"style={{ backgroundColor: theme.tokens.primary }} />
                <div className="flex-1"style={{ backgroundColor: theme.tokens.accent }} />
                <div className="flex-1"style={{ backgroundColor: theme.tokens.card }} />
                <div className="flex-1"style={{ backgroundColor: theme.tokens.fg }} />
              </div>
              <p className="font-semibold text-sm text-[var(--fg)]">{theme.label}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5 leading-snug">{theme.description}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-1 opacity-60"style={{ fontFamily: theme.tokens.fontFamily }}>
                {theme.tokens.fontFamily.split(',')[0].replace(/"/g, '')}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sections Tab ──────────────────────────────────────────────────────────────

function SectionsTab({
  sections, onChange,
}: {
  sections: SectionConfig[]
  onChange: (s: SectionConfig[]) => void
}) {
  const t = useTranslations('console')
  const sorted = [...sections].sort((a, b) => a.order - b.order)

  function move(key: SectionKey, dir: -1 | 1) {
    const idx = sorted.findIndex((s) => s.key === key)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const next = [...sorted]
    const temp = next[idx].order
    next[idx] = { ...next[idx], order: next[swapIdx].order }
    next[swapIdx] = { ...next[swapIdx], order: temp }
    onChange(next)
  }

  function toggle(key: SectionKey) {
    onChange(sections.map((s) => s.key === key ? { ...s, enabled: !s.enabled } : s))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--fg-muted)] mb-4">
        {t('sectionsTabDescription')}
      </p>
      {sorted.map((section, idx) => (
        <div
          key={section.key}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
            section.enabled
              ? 'border-[var(--border)] bg-[var(--card)]'
              : 'border-[var(--border)] bg-[var(--bg-secondary)] opacity-60',
          )}
        >
          <GripVertical className="w-4 h-4 text-[var(--fg-muted)] flex-shrink-0"aria-hidden />
          <span className="flex-1 text-sm font-medium text-[var(--fg)]">
            {t(SECTION_LABELS[section.key])}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(section.key, -1)}
              disabled={idx === 0}
              className="p-1 rounded-lg hover:bg-[var(--card-hover)] disabled:opacity-30 transition-colors"
              aria-label={t('moveSectionUpAria', { section: t(SECTION_LABELS[section.key]) })}
            >
              <ChevronUp className="w-4 h-4"/>
            </button>
            <button
              type="button"
              onClick={() => move(section.key, 1)}
              disabled={idx === sorted.length - 1}
              className="p-1 rounded-lg hover:bg-[var(--card-hover)] disabled:opacity-30 transition-colors"
              aria-label={t('moveSectionDownAria', { section: t(SECTION_LABELS[section.key]) })}
            >
              <ChevronDown className="w-4 h-4"/>
            </button>
          </div>
          <button
            type="button"
            onClick={() => toggle(section.key)}
            role="switch"
            aria-checked={section.enabled}
            className={cn(
              'relative w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
              section.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]',
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 w-4 h-4 rounded-full bg-[var(--card)] transition-transform',
                section.enabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Templates Tab ─────────────────────────────────────────────────────────────

function TemplatesTab({
  templates, onChange,
}: {
  templates: SectionTemplates
  onChange: (t: SectionTemplates) => void
}) {
  const t = useTranslations('console')
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--fg-muted)]">
        {t('templatesTabDescription')}
      </p>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('galleryLabel')}</p>
        <PillSelector<GalleryTemplate>
          value={templates.gallery}
          onChange={(v) => onChange({ ...templates, gallery: v })}
          options={Object.entries(GALLERY_TEMPLATE_LABELS).map(([value, labelKey]) => ({ value: value as GalleryTemplate, label: t(labelKey) }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('breadcrumbs.reviews')}</p>
        <PillSelector<ReviewsTemplate>
          value={templates.reviews}
          onChange={(v) => onChange({ ...templates, reviews: v })}
          options={Object.entries(REVIEWS_TEMPLATE_LABELS).map(([value, labelKey]) => ({ value: value as ReviewsTemplate, label: t(labelKey) }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('contactLabel')}</p>
        <PillSelector<ContactTemplate>
          value={templates.contact}
          onChange={(v) => onChange({ ...templates, contact: v })}
          options={Object.entries(CONTACT_TEMPLATE_LABELS).map(([value, labelKey]) => ({ value: value as ContactTemplate, label: t(labelKey) }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('aboutLabel')}</p>
        <PillSelector<AboutTemplate>
          value={templates.about}
          onChange={(v) => onChange({ ...templates, about: v })}
          options={Object.entries(ABOUT_TEMPLATE_LABELS).map(([value, labelKey]) => ({ value: value as AboutTemplate, label: t(labelKey) }))}
        />
      </div>
    </div>
  )
}

// ── Hero Tab ──────────────────────────────────────────────────────────────────

function HeroTab({
  hero, heroConfig, onHeroChange, onHeroConfigChange,
}: {
  hero: HeroContent
  heroConfig: HeroConfig
  onHeroChange: (h: HeroContent) => void
  onHeroConfigChange: (h: HeroConfig) => void
}) {
  const t = useTranslations('console')
  const setHero = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) => onHeroChange({ ...hero, [k]: v })
  const setConfig = <K extends keyof HeroConfig>(k: K, v: HeroConfig[K]) => onHeroConfigChange({ ...heroConfig, [k]: v })

  const heroLayouts: { value: HeroLayoutVariant; label: string }[] = (
    Object.entries(HERO_LAYOUT_LABELS) as [HeroLayoutVariant, { label: string; description: string }][]
  ).map(([value, info]) => ({ value, label: t(info.label) }))

  const bgTypes: { value: HeroBackgroundType; label: string }[] = [
    { value: 'image', label: t('bgTypeImage') },
    { value: 'video', label: t('bgTypeVideo') },
    { value: 'gradient', label: t('bgTypeGradient') },
    { value: 'solid', label: t('bgTypeSolidColor') },
  ]

  const alignments: { value: 'left' | 'center' | 'right'; label: string }[] = [
    { value: 'left', label: t('alignLeft') },
    { value: 'center', label: t('alignCenter') },
    { value: 'right', label: t('alignRight') },
  ]

  const primaryCtaOptions = (
    Object.entries(HERO_PRIMARY_CTA_LABELS) as [HeroPrimaryCtaType, string][]
  ).map(([value, labelKey]) => ({ value, label: t(labelKey) }))

  const secondaryCtaOptions = [
    { value: ''as HeroSecondaryCtaType, label: t('noneOptionDash') },
    ...(Object.entries(HERO_SECONDARY_CTA_LABELS) as [HeroSecondaryCtaType, string][]).map(([value, labelKey]) => ({ value, label: t(labelKey) })),
  ]

  return (
    <div className="space-y-6">
      {/* Layout variant picker */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--fg)]">{t('layoutVariantLabel')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.entries(HERO_LAYOUT_LABELS) as [HeroLayoutVariant, { label: string; description: string }][]).map(([key, info]) => (
            <button
              key={key}
              type="button"
              onClick={() => setConfig('layout', key)}
              className={cn(
                'text-left p-3 rounded-xl border-2 transition-all',
                heroConfig.layout === key
                  ? 'border-[var(--accent)] bg-[var(--card)]'
                  : 'border-[var(--border)] hover:border-[var(--accent)]',
              )}
            >
              <p className="text-sm font-medium text-[var(--fg)]">{t(info.label)}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">{t(info.description)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Background type */}
      <Field label={t('backgroundTypeLabel')}>
        <PillSelector<HeroBackgroundType>
          value={heroConfig.backgroundType}
          onChange={(v) => setConfig('backgroundType', v)}
          options={bgTypes}
        />
      </Field>

      {/* Conditional background inputs */}
      {heroConfig.backgroundType === 'image' && (
        <Field label={t('backgroundImageUrlLabel')}>
          <TextInput
            value={heroConfig.backgroundImage}
            onChange={(v) => setConfig('backgroundImage', v)}
            placeholder="https://…"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'video' && (
        <Field label={t('backgroundVideoUrlLabel')}>
          <TextInput
            value={heroConfig.backgroundVideo}
            onChange={(v) => setConfig('backgroundVideo', v)}
            placeholder="https://…"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'gradient' && (
        <Field label={t('cssGradientLabel')}>
          <TextInput
            value={heroConfig.backgroundGradient}
            onChange={(v) => setConfig('backgroundGradient', v)}
            placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'solid' && (
        <Field label={t('solidColorHexLabel')}>
          <TextInput
            value={heroConfig.backgroundSolid}
            onChange={(v) => setConfig('backgroundSolid', v)}
            placeholder="#1a1a2e"
          />
        </Field>
      )}

      {/* Alignment */}
      <Field label={t('textAlignmentLabel')}>
        <PillSelector<'left' | 'center' | 'right'>
          value={heroConfig.alignment}
          onChange={(v) => setConfig('alignment', v)}
          options={alignments}
        />
      </Field>

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('primaryCtaLabel')}>
          <SelectInput<HeroPrimaryCtaType>
            value={heroConfig.primaryCta}
            onChange={(v) => setConfig('primaryCta', v)}
            options={primaryCtaOptions}
          />
        </Field>
        <Field label={t('secondaryCtaOptionalLabel')}>
          <SelectInput<HeroSecondaryCtaType>
            value={heroConfig.secondaryCta ?? (''as HeroSecondaryCtaType)}
            onChange={(v) => setConfig('secondaryCta', v || undefined)}
            options={secondaryCtaOptions}
          />
        </Field>
      </div>

      {/* Content fields */}
      <div className="border-t border-[var(--border)] pt-5 space-y-4">
        <p className="text-sm font-medium text-[var(--fg)]">{t('heroContentLabel')}</p>
        <Field label={t('headlineLabel')}>
          <TextInput value={hero.headline} onChange={(v) => setHero('headline', v)} placeholder={t('welcomeToOurRestaurantPlaceholder')} />
        </Field>
        <Field label={t('subheadlineLabel')}>
          <TextInput value={hero.subheadline} onChange={(v) => setHero('subheadline', v)} placeholder={t('freshFoodGreatVibesPlaceholder')} multiline />
        </Field>
        <Field label={t('backgroundImageUrlLegacyLabel')}>
          <TextInput value={hero.backgroundImage} onChange={(v) => setHero('backgroundImage', v)} placeholder="https://…"/>
        </Field>
      </div>
    </div>
  )
}

// ── Content Tab (About + Contact combined) ────────────────────────────────────

function ContentTab({
  about, contact, onAboutChange, onContactChange,
}: {
  about: AboutContent
  contact: ContactContent
  onAboutChange: (a: AboutContent) => void
  onContactChange: (c: ContactContent) => void
}) {
  const t = useTranslations('console')
  const setAbout = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) => onAboutChange({ ...about, [k]: v })
  const setContact = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) => onContactChange({ ...contact, [k]: v })

  return (
    <div className="space-y-8">
      {/* About section */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--fg)] border-b border-[var(--border)] pb-2">{t('aboutLabel')}</p>
        <Field label={t('ourStoryLabel')}>
          <TextInput value={about.story} onChange={(v) => setAbout('story', v)} multiline placeholder={t('tellYourStoryPlaceholder')} />
        </Field>
        <Field label={t('missionLabel')}>
          <TextInput value={about.mission} onChange={(v) => setAbout('mission', v)} multiline placeholder={t('ourMissionIsPlaceholder')} />
        </Field>
        <Field label={t('historyLabel')}>
          <TextInput value={about.history} onChange={(v) => setAbout('history', v)} multiline placeholder={t('foundedInPlaceholder')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('founderNameLabel')}>
            <TextInput value={about.founderName} onChange={(v) => setAbout('founderName', v)} placeholder={t('janeDoeExamplePlaceholder')} />
          </Field>
          <Field label={t('founderImageUrlLabel')}>
            <TextInput value={about.founderImage} onChange={(v) => setAbout('founderImage', v)} placeholder="https://…"/>
          </Field>
        </div>
        <Field label={t('founderBioLabel')}>
          <TextInput value={about.founderBio} onChange={(v) => setAbout('founderBio', v)} multiline placeholder={t('bioEllipsisPlaceholder')} />
        </Field>
      </div>

      {/* Contact section */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--fg)] border-b border-[var(--border)] pb-2">{t('contactLabel')}</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('phoneLabel')}><TextInput value={contact.phone_number} onChange={(v) => setContact('phone_number', v)} placeholder="+1 555 000 0000"/></Field>
          <Field label={t('emailLabel')}><TextInput value={contact.email} onChange={(v) => setContact('email', v)} placeholder="hello@restaurant.com"/></Field>
          <Field label={t('websiteLabel')}><TextInput value={contact.website} onChange={(v) => setContact('website', v)} placeholder="https://…"/></Field>
          <Field label={t('whatsappLabel')}><TextInput value={contact.whatsapp} onChange={(v) => setContact('whatsapp', v)} placeholder="+1 555 000 0000"/></Field>
          <Field label={t('instagramLabel')}><TextInput value={contact.instagram} onChange={(v) => setContact('instagram', v)} placeholder="@handle"/></Field>
          <Field label={t('facebookLabel')}><TextInput value={contact.facebook} onChange={(v) => setContact('facebook', v)} placeholder="facebook.com/page"/></Field>
          <Field label={t('tiktokLabel')}><TextInput value={contact.tiktok} onChange={(v) => setContact('tiktok', v)} placeholder="@handle"/></Field>
          <Field label={t('youtubeLabel')}><TextInput value={contact.youtube} onChange={(v) => setContact('youtube', v)} placeholder="youtube.com/channel"/></Field>
          <Field label={t('telegramLabel')}><TextInput value={contact.telegram} onChange={(v) => setContact('telegram', v)} placeholder="t.me/channel"/></Field>
        </div>
        <Field label={t('mapEmbedUrlLabel')}>
          <TextInput value={contact.mapEmbedUrl} onChange={(v) => setContact('mapEmbedUrl', v)} placeholder="https://maps.google.com/embed?…"/>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('latitudeLabel')}><NumberInput value={contact.latitude} onChange={(v) => setContact('latitude', v)} min={-90} max={90} step={0.000001} placeholder="40.7128"/></Field>
          <Field label={t('longitudeLabel')}><NumberInput value={contact.longitude} onChange={(v) => setContact('longitude', v)} min={-180} max={180} step={0.000001} placeholder="-74.0060"/></Field>
        </div>
      </div>
    </div>
  )
}

// ── Modules Tab ───────────────────────────────────────────────────────────────

const MODULE_FEATURES = [
  { key: 'reservations', labelKey: 'breadcrumbs.reservations', descKey: 'moduleFeatureReservationsDesc' },
  { key: 'online_ordering', labelKey: 'moduleFeatureOnlineOrdering', descKey: 'moduleFeatureOnlineOrderingDesc' },
  { key: 'loyalty', labelKey: 'moduleFeatureLoyaltyProgram', descKey: 'moduleFeatureLoyaltyProgramDesc' },
  { key: 'promotions', labelKey: 'breadcrumbs.promotions', descKey: 'moduleFeaturePromotionsDesc' },
  { key: 'gallery', labelKey: 'moduleFeaturePhotoGallery', descKey: 'moduleFeaturePhotoGalleryDesc' },
  { key: 'events', labelKey: 'moduleFeatureEvents', descKey: 'moduleFeatureEventsDesc' },
  { key: 'reviews', labelKey: 'breadcrumbs.reviews', descKey: 'moduleFeatureReviewsDesc' },
  { key: 'branches', labelKey: 'moduleFeatureMultiLocation', descKey: 'moduleFeatureMultiLocationDesc' },
  { key: 'faq', labelKey: 'moduleFeatureFaq', descKey: 'moduleFeatureFaqDesc' },
  { key: 'website_builder', labelKey: 'websiteBuilderTitle', descKey: 'moduleFeatureWebsiteBuilderDesc' },
]

function ModulesTab() {
  const t = useTranslations('console')
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        {t('modulesTabDescription')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULE_FEATURES.map((feature) => (
          <div
            key={feature.key}
            className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)] flex-shrink-0 mt-1.5"aria-hidden />
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{t(feature.labelKey)}</p>
              <p className="text-xs text-[var(--fg-muted)]">{t(feature.descKey)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--fg-muted)] pt-2">
        {t('allModulesIncludedInPlan')}
      </p>
    </div>
  )
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewTab({ tenantSlug, layout }: { tenantSlug: string; layout: HomepageLayout }) {
  const t = useTranslations('console')
  const enabledSections = layout.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.key)

  const activeBrandTheme = BRAND_THEMES.find((t) => t.name === (layout.brandTheme ?? DEFAULT_BRAND_THEME))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--warning-subtle)] border border-[var(--warning-border)]">
        <Eye className="w-4 h-4 text-[var(--warning-text)] flex-shrink-0"aria-hidden />
        <p className="text-sm text-[var(--warning-text)]">
          {t('livePreviewNotice')}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--bg-secondary)] px-4 py-2 flex items-center gap-2 border-b border-[var(--border)]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400"/>
            <div className="w-3 h-3 rounded-full bg-yellow-400"/>
            <div className="w-3 h-3 rounded-full bg-green-400"/>
          </div>
          <span className="text-xs text-[var(--fg-muted)] ml-2 font-mono">/{tenantSlug}</span>
        </div>
        <div className="p-6 space-y-3 min-h-64">
          {activeBrandTheme && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="flex gap-1 rounded overflow-hidden h-4 w-16">
                <div className="flex-1"style={{ backgroundColor: activeBrandTheme.tokens.bg }} />
                <div className="flex-1"style={{ backgroundColor: activeBrandTheme.tokens.primary }} />
                <div className="flex-1"style={{ backgroundColor: activeBrandTheme.tokens.accent }} />
              </div>
              <span className="text-xs text-[var(--fg-muted)]">{t('themeColonLabel')} <strong className="text-[var(--fg)]">{activeBrandTheme.label}</strong></span>
            </div>
          )}
          {layout.hero.headline && (
            <div
              className="rounded-xl p-6 text-center flex flex-col items-center gap-2"
              style={{ backgroundColor: activeBrandTheme?.tokens.primary ?? 'var(--accent)' }}
            >
              <h2 className="text-2xl font-bold text-white">{layout.hero.headline}</h2>
              {layout.hero.subheadline && (
                <p className="text-sm text-white/80">{layout.hero.subheadline}</p>
              )}
            </div>
          )}
          <div className="text-xs text-[var(--fg-muted)] space-y-1">
            <p className="font-medium text-[var(--fg)] mb-2">{t('activeSectionsInOrderLabel')}</p>
            {enabledSections.map((key, i) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{t(SECTION_LABELS[key])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <a
        href={`/${tenantSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
      >
        <Globe className="w-4 h-4"aria-hidden />
        {t('openPublicPage')}
      </a>
    </div>
  )
}

// ── Versions Tab ──────────────────────────────────────────────────────────────

function VersionsTab({
  layout, tenantSlug,
  onRestore,
}: {
  layout: HomepageLayout
  tenantSlug: string
  onRestore: (versionId: string) => void
}) {
  const t = useTranslations('console')
  const versions = layout.versions ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-xs text-[var(--fg-muted)] mb-1">{t('tableHeaders.status')}</p>
          <p className={cn('font-medium', layout.status === 'published' ? 'text-[var(--success-text)]' : 'text-[var(--rating)]')}>
            {layout.status === 'published' ? t('publishedLabel') : t('draftLabel')}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-xs text-[var(--fg-muted)] mb-1">{t('lastSavedLabel')}</p>
          <p className="font-medium text-[var(--fg)]">
            {layout.lastSavedAt ? new Date(layout.lastSavedAt).toLocaleString() : '—'}
          </p>
        </div>
        {layout.lastPublishedAt && (
          <div className="col-span-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <p className="text-xs text-[var(--fg-muted)] mb-1">{t('lastPublishedLabel')}</p>
            <p className="font-medium text-[var(--fg)]">{new Date(layout.lastPublishedAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)] py-4 text-center">{t('noSavedVersionsYet')}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fg)]">{t('versionHistoryLabel')}</p>
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{v.label ?? t('versionNumberLabel', { id: v.id })}</p>
                <p className="text-xs text-[var(--fg-muted)]">{new Date(v.savedAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(v.id)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
              >
                {t('restore')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Branches Tab ──────────────────────────────────────────────────────────────

function BranchOverridesForm({
  tenantId, branchId,
}: {
  tenantId: string
  branchId: string
}) {
  const t = useTranslations('console')
  const { data: overrides = {}, isLoading } = useBranchOverrides(tenantId, branchId)
  const save = useSaveBranchOverrides(tenantId, branchId)
  const [local, setLocal] = useState<BranchContentOverrides | null>(null)
  const current = local ?? overrides

  const set = <K extends keyof BranchContentOverrides>(k: K, v: BranchContentOverrides[K]) =>
    setLocal({ ...current, [k]: v })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-[var(--fg-muted)] py-4">
      <Loader2 className="w-4 h-4 animate-spin"aria-hidden />
      <span>{t('loadingBranchOverrides')}</span>
    </div>
  )

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4">
        <Field label={t('heroHeadlineLabel')}><TextInput value={current.heroHeadline} onChange={(v) => set('heroHeadline', v)} placeholder={t('branchSpecificHeadlinePlaceholder')} /></Field>
        <Field label={t('heroSubheadlineLabel')}><TextInput value={current.heroSubheadline} onChange={(v) => set('heroSubheadline', v)} placeholder={t('branchSpecificSubheadlinePlaceholder')} /></Field>
        <Field label={t('heroImageUrlLabel')}><TextInput value={current.heroImage} onChange={(v) => set('heroImage', v)} placeholder="https://…"/></Field>
        <Field label={t('branchDescriptionLabel')}><TextInput value={current.description} onChange={(v) => set('description', v)} multiline placeholder={t('locatedInPlaceholder')} /></Field>
        <Field label={t('branchPhoneLabel')}><TextInput value={current.phone_number} onChange={(v) => set('phone_number', v)} placeholder="+1 555 000 0000"/></Field>
        <Field label={t('aboutBranchSpecificLabel')}><TextInput value={current.about} onChange={(v) => set('about', v)} multiline placeholder={t('ourDowntownLocationPlaceholder')} /></Field>
      </div>
      <button
        type="button"
        onClick={() => save.mutate(current)}
        disabled={save.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
        {save.isPending ? t('savingEllipsis') : t('saveBranchOverrides')}
      </button>
    </div>
  )
}

function BranchesTab({ tenantId }: { tenantId: string }) {
  const t = useTranslations('console')
  const branches = useBranchStore((s) => s.branches)
  const [selectedBranchId, setSelectedBranchId] = useState('')

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        {t('branchesTabDescription')}
      </p>
      <Field label={t('branchSlugLabel')}>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)]"
        >
          <option value="">{t('branchSlugPlaceholder')}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.slug})
            </option>
          ))}
        </select>
      </Field>
      {selectedBranchId && (
        <BranchOverridesForm tenantId={tenantId} branchId={selectedBranchId} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function WebsiteBuilderContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const tenantSlug = useTenantStore((s) => {
    const tenant = s.tenant
    return tenant?.id === tenantId ? tenant.slug ?? '' : ''
  })
  const { data: layout, isLoading, error } = useHomepageLayout(tenantId)
  const saveLayout = useSaveLayout(tenantId)
  const publishLayout = usePublishLayout(tenantId)
  const restoreVersion = useRestoreVersion(tenantId)

  const [tab, setTab] = useState<Tab>('theme')
  const [draft, setDraft] = useState<HomepageLayout | null>(null)
  const [saved, setSaved] = useState(false)

  const current: HomepageLayout | null = draft ?? layout ?? null

  const update = useCallback((patch: Partial<HomepageLayout>) => {
    setDraft((prev) => ({ ...(prev ?? layout!), ...patch }))
  }, [layout])

  async function handleSave() {
    if (!current) return
    await saveLayout.mutateAsync(current)
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePublish() {
    if (!current) return
    await publishLayout.mutateAsync(current)
    setDraft(null)
  }

  async function handleRestore(versionId: string) {
    await restoreVersion.mutateAsync(versionId)
    setDraft(null)
  }

  if (!tenantId) return (
    <div className="flex items-center justify-center h-64 text-[var(--fg-muted)]">{t('noTenantSelected')}</div>
  )

  if (isLoading) return (
    <div className="flex items-center gap-2 justify-center h-64 text-[var(--fg-muted)]">
      <Loader2 className="w-5 h-5 animate-spin"/>
      {t('loadingWebsiteBuilder')}
    </div>
  )

  if (error || !current) return (
    <div className="flex items-center justify-center h-64 text-[var(--danger-text)] text-sm">
      {t('failedToLoadWebsiteBuilder')}
    </div>
  )

  const isDirty = draft !== null
  const isBusy = saveLayout.isPending || publishLayout.isPending || restoreVersion.isPending

  const brandTheme = current.brandTheme ?? DEFAULT_BRAND_THEME
  const heroConfig = current.heroConfig ?? DEFAULT_HERO_CONFIG
  const sectionTemplates = current.sectionTemplates ?? DEFAULT_SECTION_TEMPLATES

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">{t('websiteBuilderTitle')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            {t('websiteBuilderSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--success-text)]">
              <CheckCircle2 className="w-4 h-4"/> {t('savedLabel')}
            </span>
          )}
          <span className={cn(
            'text-xs px-2 py-1 rounded-full font-medium',
            current.status === 'published'
              ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
              : 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
          )}>
            {current.status === 'published' ? t('publishedLabel') : t('draftLabel')}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] disabled:opacity-40 transition-colors"
          >
            {saveLayout.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
            {t('save')}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
          >
            {publishLayout.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
            {t('publish')}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--warning-subtle)] border border-[var(--warning-border)] text-sm text-[var(--warning-text)]">
          <span className="w-2 h-2 rounded-full bg-[var(--warning)] flex-shrink-0"/>
          {t('unsavedChangesNotice')}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {TABS.map(({ value, labelKey, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === value
                ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            <Icon className="w-4 h-4"aria-hidden />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
        {tab === 'theme' && (
          <ThemeTab
            brandTheme={brandTheme}
            onChange={(t) => update({ brandTheme: t })}
          />
        )}
        {tab === 'layout' && (
          <SectionsTab
            sections={current.sections}
            onChange={(sections) => update({ sections })}
          />
        )}
        {tab === 'templates' && (
          <TemplatesTab
            templates={sectionTemplates}
            onChange={(t) => update({ sectionTemplates: t })}
          />
        )}
        {tab === 'hero' && (
          <HeroTab
            hero={current.hero}
            heroConfig={heroConfig}
            onHeroChange={(hero) => update({ hero })}
            onHeroConfigChange={(h) => update({ heroConfig: h })}
          />
        )}
        {tab === 'content' && (
          <ContentTab
            about={current.about}
            contact={current.contact}
            onAboutChange={(about) => update({ about })}
            onContactChange={(contact) => update({ contact })}
          />
        )}
        {tab === 'modules' && <ModulesTab />}
        {tab === 'preview' && (
          <PreviewTab tenantSlug={tenantSlug} layout={current} />
        )}
        {tab === 'branches' && (
          <BranchesTab tenantId={tenantId} />
        )}
        {tab === 'versions' && (
          <VersionsTab
            layout={current}
            tenantSlug={tenantSlug}
            onRestore={handleRestore}
          />
        )}
      </div>
    </div>
  )
}

export default function WebsiteBuilderPage() {
  return (
    <PermissionGuard permission="settings.view"fallback={<AccessDenied />}>
      <div className="min-h-screen bg-[var(--bg)]">
        <main>
          <WebsiteBuilderContent />
        </main>
      </div>
    </PermissionGuard>
  )
}
