'use client'

import { useState, useCallback } from 'react'
import {
  Layout, Image, Info, Phone, Palette, Eye,
  Globe, GitBranch, Save, Upload, RotateCcw, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, GripVertical, Layers, Cpu,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/utils'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useTenantStore } from '@/stores'
import {
  useHomepageLayout, useSaveLayout, usePublishLayout,
  useRestoreVersion, useBranchOverrides, useSaveBranchOverrides,
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

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: 'theme',     label: 'Theme',      icon: Palette },
  { value: 'layout',   label: 'Sections',   icon: Layout },
  { value: 'templates', label: 'Templates',  icon: Layers },
  { value: 'hero',     label: 'Hero',       icon: Image },
  { value: 'content',  label: 'Content',    icon: Info },
  { value: 'modules',  label: 'Modules',    icon: Cpu },
  { value: 'preview',  label: 'Preview',    icon: Eye },
  { value: 'branches', label: 'Branches',   icon: GitBranch },
  { value: 'versions', label: 'Versions',   icon: RotateCcw },
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
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        Choose a curated brand theme that sets your colors, fonts, and visual style.
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
                <div className="flex-1" style={{ backgroundColor: theme.tokens.bg }} />
                <div className="flex-1" style={{ backgroundColor: theme.tokens.primary }} />
                <div className="flex-1" style={{ backgroundColor: theme.tokens.accent }} />
                <div className="flex-1" style={{ backgroundColor: theme.tokens.card }} />
                <div className="flex-1" style={{ backgroundColor: theme.tokens.fg }} />
              </div>
              <p className="font-semibold text-sm text-[var(--fg)]">{theme.label}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5 leading-snug">{theme.description}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-1 opacity-60" style={{ fontFamily: theme.tokens.fontFamily }}>
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
        Enable or disable sections and reorder them on your public homepage.
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
          <GripVertical className="w-4 h-4 text-[var(--fg-muted)] flex-shrink-0" aria-hidden />
          <span className="flex-1 text-sm font-medium text-[var(--fg)]">
            {SECTION_LABELS[section.key]}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(section.key, -1)}
              disabled={idx === 0}
              className="p-1 rounded-lg hover:bg-[var(--card-hover)] disabled:opacity-30 transition-colors"
              aria-label={`Move ${SECTION_LABELS[section.key]} up`}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => move(section.key, 1)}
              disabled={idx === sorted.length - 1}
              className="p-1 rounded-lg hover:bg-[var(--card-hover)] disabled:opacity-30 transition-colors"
              aria-label={`Move ${SECTION_LABELS[section.key]} down`}
            >
              <ChevronDown className="w-4 h-4" />
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
                'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
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
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--fg-muted)]">
        Choose the layout template for each section type.
      </p>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">Gallery</p>
        <PillSelector<GalleryTemplate>
          value={templates.gallery}
          onChange={(v) => onChange({ ...templates, gallery: v })}
          options={Object.entries(GALLERY_TEMPLATE_LABELS).map(([value, label]) => ({ value: value as GalleryTemplate, label }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">Reviews</p>
        <PillSelector<ReviewsTemplate>
          value={templates.reviews}
          onChange={(v) => onChange({ ...templates, reviews: v })}
          options={Object.entries(REVIEWS_TEMPLATE_LABELS).map(([value, label]) => ({ value: value as ReviewsTemplate, label }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">Contact</p>
        <PillSelector<ContactTemplate>
          value={templates.contact}
          onChange={(v) => onChange({ ...templates, contact: v })}
          options={Object.entries(CONTACT_TEMPLATE_LABELS).map(([value, label]) => ({ value: value as ContactTemplate, label }))}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--fg)]">About</p>
        <PillSelector<AboutTemplate>
          value={templates.about}
          onChange={(v) => onChange({ ...templates, about: v })}
          options={Object.entries(ABOUT_TEMPLATE_LABELS).map(([value, label]) => ({ value: value as AboutTemplate, label }))}
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
  const setHero = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) => onHeroChange({ ...hero, [k]: v })
  const setConfig = <K extends keyof HeroConfig>(k: K, v: HeroConfig[K]) => onHeroConfigChange({ ...heroConfig, [k]: v })

  const heroLayouts: { value: HeroLayoutVariant; label: string }[] = (
    Object.entries(HERO_LAYOUT_LABELS) as [HeroLayoutVariant, { label: string; description: string }][]
  ).map(([value, info]) => ({ value, label: info.label }))

  const bgTypes: { value: HeroBackgroundType; label: string }[] = [
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'solid', label: 'Solid Color' },
  ]

  const alignments: { value: 'left' | 'center' | 'right'; label: string }[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ]

  const primaryCtaOptions = (
    Object.entries(HERO_PRIMARY_CTA_LABELS) as [HeroPrimaryCtaType, string][]
  ).map(([value, label]) => ({ value, label }))

  const secondaryCtaOptions = [
    { value: '' as HeroSecondaryCtaType, label: '— None —' },
    ...(Object.entries(HERO_SECONDARY_CTA_LABELS) as [HeroSecondaryCtaType, string][]).map(([value, label]) => ({ value, label })),
  ]

  return (
    <div className="space-y-6">
      {/* Layout variant picker */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--fg)]">Layout Variant</p>
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
              <p className="text-sm font-medium text-[var(--fg)]">{info.label}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">{info.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Background type */}
      <Field label="Background Type">
        <PillSelector<HeroBackgroundType>
          value={heroConfig.backgroundType}
          onChange={(v) => setConfig('backgroundType', v)}
          options={bgTypes}
        />
      </Field>

      {/* Conditional background inputs */}
      {heroConfig.backgroundType === 'image' && (
        <Field label="Background Image URL">
          <TextInput
            value={heroConfig.backgroundImage}
            onChange={(v) => setConfig('backgroundImage', v)}
            placeholder="https://…"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'video' && (
        <Field label="Background Video URL">
          <TextInput
            value={heroConfig.backgroundVideo}
            onChange={(v) => setConfig('backgroundVideo', v)}
            placeholder="https://…"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'gradient' && (
        <Field label="CSS Gradient">
          <TextInput
            value={heroConfig.backgroundGradient}
            onChange={(v) => setConfig('backgroundGradient', v)}
            placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        </Field>
      )}
      {heroConfig.backgroundType === 'solid' && (
        <Field label="Solid Color (hex)">
          <TextInput
            value={heroConfig.backgroundSolid}
            onChange={(v) => setConfig('backgroundSolid', v)}
            placeholder="#1a1a2e"
          />
        </Field>
      )}

      {/* Alignment */}
      <Field label="Text Alignment">
        <PillSelector<'left' | 'center' | 'right'>
          value={heroConfig.alignment}
          onChange={(v) => setConfig('alignment', v)}
          options={alignments}
        />
      </Field>

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Primary CTA">
          <SelectInput<HeroPrimaryCtaType>
            value={heroConfig.primaryCta}
            onChange={(v) => setConfig('primaryCta', v)}
            options={primaryCtaOptions}
          />
        </Field>
        <Field label="Secondary CTA (optional)">
          <SelectInput<HeroSecondaryCtaType>
            value={heroConfig.secondaryCta ?? ('' as HeroSecondaryCtaType)}
            onChange={(v) => setConfig('secondaryCta', v || undefined)}
            options={secondaryCtaOptions}
          />
        </Field>
      </div>

      {/* Content fields */}
      <div className="border-t border-[var(--border)] pt-5 space-y-4">
        <p className="text-sm font-medium text-[var(--fg)]">Hero Content</p>
        <Field label="Headline">
          <TextInput value={hero.headline} onChange={(v) => setHero('headline', v)} placeholder="Welcome to our restaurant" />
        </Field>
        <Field label="Subheadline">
          <TextInput value={hero.subheadline} onChange={(v) => setHero('subheadline', v)} placeholder="Fresh food, great vibes" multiline />
        </Field>
        <Field label="Background Image URL (legacy)">
          <TextInput value={hero.backgroundImage} onChange={(v) => setHero('backgroundImage', v)} placeholder="https://…" />
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
  const setAbout = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) => onAboutChange({ ...about, [k]: v })
  const setContact = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) => onContactChange({ ...contact, [k]: v })

  return (
    <div className="space-y-8">
      {/* About section */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--fg)] border-b border-[var(--border)] pb-2">About</p>
        <Field label="Our Story">
          <TextInput value={about.story} onChange={(v) => setAbout('story', v)} multiline placeholder="Tell your story…" />
        </Field>
        <Field label="Mission">
          <TextInput value={about.mission} onChange={(v) => setAbout('mission', v)} multiline placeholder="Our mission is…" />
        </Field>
        <Field label="History">
          <TextInput value={about.history} onChange={(v) => setAbout('history', v)} multiline placeholder="Founded in…" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Founder Name">
            <TextInput value={about.founderName} onChange={(v) => setAbout('founderName', v)} placeholder="Jane Doe" />
          </Field>
          <Field label="Founder Image URL">
            <TextInput value={about.founderImage} onChange={(v) => setAbout('founderImage', v)} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Founder Bio">
          <TextInput value={about.founderBio} onChange={(v) => setAbout('founderBio', v)} multiline placeholder="Bio…" />
        </Field>
      </div>

      {/* Contact section */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--fg)] border-b border-[var(--border)] pb-2">Contact</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><TextInput value={contact.phone} onChange={(v) => setContact('phone', v)} placeholder="+1 555 000 0000" /></Field>
          <Field label="Email"><TextInput value={contact.email} onChange={(v) => setContact('email', v)} placeholder="hello@restaurant.com" /></Field>
          <Field label="Website"><TextInput value={contact.website} onChange={(v) => setContact('website', v)} placeholder="https://…" /></Field>
          <Field label="WhatsApp"><TextInput value={contact.whatsapp} onChange={(v) => setContact('whatsapp', v)} placeholder="+1 555 000 0000" /></Field>
          <Field label="Instagram"><TextInput value={contact.instagram} onChange={(v) => setContact('instagram', v)} placeholder="@handle" /></Field>
          <Field label="Facebook"><TextInput value={contact.facebook} onChange={(v) => setContact('facebook', v)} placeholder="facebook.com/page" /></Field>
          <Field label="TikTok"><TextInput value={contact.tiktok} onChange={(v) => setContact('tiktok', v)} placeholder="@handle" /></Field>
          <Field label="YouTube"><TextInput value={contact.youtube} onChange={(v) => setContact('youtube', v)} placeholder="youtube.com/channel" /></Field>
          <Field label="Telegram"><TextInput value={contact.telegram} onChange={(v) => setContact('telegram', v)} placeholder="t.me/channel" /></Field>
        </div>
        <Field label="Map Embed URL">
          <TextInput value={contact.mapEmbedUrl} onChange={(v) => setContact('mapEmbedUrl', v)} placeholder="https://maps.google.com/embed?…" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude"><NumberInput value={contact.latitude} onChange={(v) => setContact('latitude', v)} min={-90} max={90} step={0.000001} placeholder="40.7128" /></Field>
          <Field label="Longitude"><NumberInput value={contact.longitude} onChange={(v) => setContact('longitude', v)} min={-180} max={180} step={0.000001} placeholder="-74.0060" /></Field>
        </div>
      </div>
    </div>
  )
}

// ── Modules Tab ───────────────────────────────────────────────────────────────

const MODULE_FEATURES = [
  { key: 'reservations', label: 'Reservations', description: 'Table booking system' },
  { key: 'online_ordering', label: 'Online Ordering', description: 'Order ahead / delivery' },
  { key: 'loyalty', label: 'Loyalty Program', description: 'Points and rewards' },
  { key: 'promotions', label: 'Promotions', description: 'Deals and discounts' },
  { key: 'gallery', label: 'Photo Gallery', description: 'Image showcase' },
  { key: 'events', label: 'Events', description: 'Upcoming events calendar' },
  { key: 'reviews', label: 'Reviews', description: 'Customer testimonials' },
  { key: 'branches', label: 'Multi-location', description: 'Multiple branch support' },
  { key: 'faq', label: 'FAQ', description: 'Frequently asked questions' },
  { key: 'website_builder', label: 'Website Builder', description: 'Public homepage editor' },
]

function ModulesTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        Overview of features and modules available in your plan. Contact support to enable or upgrade capabilities.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULE_FEATURES.map((feature) => (
          <div
            key={feature.key}
            className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" aria-hidden />
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{feature.label}</p>
              <p className="text-xs text-[var(--fg-muted)]">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--fg-muted)] pt-2">
        All modules shown above are included in your current plan.
      </p>
    </div>
  )
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewTab({ tenantSlug, layout }: { tenantSlug: string; layout: HomepageLayout }) {
  const enabledSections = layout.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.key)

  const activeBrandTheme = BRAND_THEMES.find((t) => t.name === (layout.brandTheme ?? DEFAULT_BRAND_THEME))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Live preview — changes reflect after saving. Open the public URL to see the full experience.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--bg-secondary)] px-4 py-2 flex items-center gap-2 border-b border-[var(--border)]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-[var(--fg-muted)] ml-2 font-mono">/{tenantSlug}</span>
        </div>
        <div className="p-6 space-y-3 min-h-64">
          {activeBrandTheme && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="flex gap-1 rounded overflow-hidden h-4 w-16">
                <div className="flex-1" style={{ backgroundColor: activeBrandTheme.tokens.bg }} />
                <div className="flex-1" style={{ backgroundColor: activeBrandTheme.tokens.primary }} />
                <div className="flex-1" style={{ backgroundColor: activeBrandTheme.tokens.accent }} />
              </div>
              <span className="text-xs text-[var(--fg-muted)]">Theme: <strong className="text-[var(--fg)]">{activeBrandTheme.label}</strong></span>
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
            <p className="font-medium text-[var(--fg)] mb-2">Active sections (in order):</p>
            {enabledSections.map((key, i) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{SECTION_LABELS[key]}</span>
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
        <Globe className="w-4 h-4" aria-hidden />
        Open public page
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
  const versions = layout.versions ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-xs text-[var(--fg-muted)] mb-1">Status</p>
          <p className={cn('font-medium', layout.status === 'published' ? 'text-emerald-500' : 'text-amber-500')}>
            {layout.status === 'published' ? 'Published' : 'Draft'}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-xs text-[var(--fg-muted)] mb-1">Last saved</p>
          <p className="font-medium text-[var(--fg)]">
            {layout.lastSavedAt ? new Date(layout.lastSavedAt).toLocaleString() : '—'}
          </p>
        </div>
        {layout.lastPublishedAt && (
          <div className="col-span-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <p className="text-xs text-[var(--fg-muted)] mb-1">Last published</p>
            <p className="font-medium text-[var(--fg)]">{new Date(layout.lastPublishedAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)] py-4 text-center">No saved versions yet. Publish to create a version.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fg)]">Version History</p>
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{v.label ?? `Version ${v.id}`}</p>
                <p className="text-xs text-[var(--fg-muted)]">{new Date(v.savedAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(v.id)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
              >
                Restore
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
  tenantSlug, branchSlug,
}: {
  tenantSlug: string
  branchSlug: string
}) {
  const { data: overrides = {}, isLoading } = useBranchOverrides(tenantSlug, branchSlug)
  const save = useSaveBranchOverrides(tenantSlug, branchSlug)
  const [local, setLocal] = useState<BranchContentOverrides | null>(null)
  const current = local ?? overrides

  const set = <K extends keyof BranchContentOverrides>(k: K, v: BranchContentOverrides[K]) =>
    setLocal({ ...current, [k]: v })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-[var(--fg-muted)] py-4">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      <span>Loading branch overrides…</span>
    </div>
  )

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4">
        <Field label="Hero Headline"><TextInput value={current.heroHeadline} onChange={(v) => set('heroHeadline', v)} placeholder="Branch-specific headline" /></Field>
        <Field label="Hero Subheadline"><TextInput value={current.heroSubheadline} onChange={(v) => set('heroSubheadline', v)} placeholder="Branch-specific subheadline" /></Field>
        <Field label="Hero Image URL"><TextInput value={current.heroImage} onChange={(v) => set('heroImage', v)} placeholder="https://…" /></Field>
        <Field label="Branch Description"><TextInput value={current.description} onChange={(v) => set('description', v)} multiline placeholder="Located in…" /></Field>
        <Field label="Branch Phone"><TextInput value={current.phone} onChange={(v) => set('phone', v)} placeholder="+1 555 000 0000" /></Field>
        <Field label="About (branch-specific)"><TextInput value={current.about} onChange={(v) => set('about', v)} multiline placeholder="Our downtown location…" /></Field>
      </div>
      <button
        type="button"
        onClick={() => save.mutate(current)}
        disabled={save.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {save.isPending ? 'Saving…' : 'Save Branch Overrides'}
      </button>
    </div>
  )
}

function BranchesTab({ tenantSlug }: { tenantSlug: string }) {
  const [selectedBranch, setSelectedBranch] = useState('')

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        Override hero content, images, description, and phone number for a specific branch without changing the main website.
      </p>
      <Field label="Branch Slug">
        <TextInput
          value={selectedBranch}
          onChange={setSelectedBranch}
          placeholder="e.g. downtown, westside"
        />
      </Field>
      {selectedBranch.trim() && (
        <BranchOverridesForm tenantSlug={tenantSlug} branchSlug={selectedBranch.trim()} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function WebsiteBuilderContent() {
  const tenantSlug = useTenantStore((s) => s.tenant?.slug ?? '')
  const { data: layout, isLoading, error } = useHomepageLayout(tenantSlug)
  const saveLayout = useSaveLayout(tenantSlug)
  const publishLayout = usePublishLayout(tenantSlug)
  const restoreVersion = useRestoreVersion(tenantSlug)

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

  if (!tenantSlug) return (
    <div className="flex items-center justify-center h-64 text-[var(--fg-muted)]">No tenant selected.</div>
  )

  if (isLoading) return (
    <div className="flex items-center gap-2 justify-center h-64 text-[var(--fg-muted)]">
      <Loader2 className="w-5 h-5 animate-spin" />
      Loading website builder…
    </div>
  )

  if (error || !current) return (
    <div className="flex items-center justify-center h-64 text-red-500 text-sm">
      Failed to load website builder. Please refresh.
    </div>
  )

  const isDirty = draft !== null
  const isBusy = saveLayout.isPending || publishLayout.isPending || restoreVersion.isPending

  const brandTheme = current.brandTheme ?? DEFAULT_BRAND_THEME
  const heroConfig = current.heroConfig ?? DEFAULT_HERO_CONFIG
  const sectionTemplates = current.sectionTemplates ?? DEFAULT_SECTION_TEMPLATES

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">Website Builder</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            Customize your public homepage — no code required.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-500">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
          <span className={cn(
            'text-xs px-2 py-1 rounded-full font-medium',
            current.status === 'published'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          )}>
            {current.status === 'published' ? 'Published' : 'Draft'}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] disabled:opacity-40 transition-colors"
          >
            {saveLayout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
          >
            {publishLayout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
          You have unsaved changes. Save before publishing.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {TABS.map(({ value, label, icon: Icon }) => (
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
            <Icon className="w-4 h-4" aria-hidden />
            {label}
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
          <BranchesTab tenantSlug={tenantSlug} />
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
    <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <main>
          <WebsiteBuilderContent />
        </main>
      </div>
    </PermissionGuard>
  )
}
