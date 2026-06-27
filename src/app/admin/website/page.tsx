'use client'

import { useState, useCallback } from 'react'
import {
  Layout, Image, Info, Phone, Palette, Eye,
  Globe, GitBranch, Save, Upload, RotateCcw, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X,
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
  AboutContent, ContactContent, ThemeSettings, BranchContentOverrides,
  HomepageVersion,
} from '@/types/website-builder'
import { SECTION_LABELS } from '@/types/website-builder'

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = 'layout' | 'hero' | 'about' | 'contact' | 'theme' | 'preview' | 'branches' | 'versions'

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: 'layout',   label: 'Sections',  icon: Layout },
  { value: 'hero',     label: 'Hero',      icon: Image },
  { value: 'about',    label: 'About',     icon: Info },
  { value: 'contact',  label: 'Contact',   icon: Phone },
  { value: 'theme',    label: 'Theme',     icon: Palette },
  { value: 'preview',  label: 'Preview',   icon: Eye },
  { value: 'branches', label: 'Branches',  icon: GitBranch },
  { value: 'versions', label: 'Versions',  icon: RotateCcw },
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

function ColorInput({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer bg-transparent"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <TextInput value={value} onChange={onChange} placeholder="#000000" />
    </div>
  )
}

// ── Layout Tab (section order & toggle) ───────────────────────────────────────

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

// ── Hero Tab ──────────────────────────────────────────────────────────────────

function HeroTab({ hero, onChange }: { hero: HeroContent; onChange: (h: HeroContent) => void }) {
  const set = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) => onChange({ ...hero, [k]: v })
  return (
    <div className="space-y-5">
      <Field label="Headline">
        <TextInput value={hero.headline} onChange={(v) => set('headline', v)} placeholder="Welcome to our restaurant" />
      </Field>
      <Field label="Subheadline">
        <TextInput value={hero.subheadline} onChange={(v) => set('subheadline', v)} placeholder="Fresh food, great vibes" multiline />
      </Field>
      <Field label="Background Image URL">
        <TextInput value={hero.backgroundImage} onChange={(v) => set('backgroundImage', v)} placeholder="https://…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="CTA Button Text">
          <TextInput value={hero.ctaText} onChange={(v) => set('ctaText', v)} placeholder="Order Now" />
        </Field>
        <Field label="CTA Button Link">
          <TextInput value={hero.ctaTarget} onChange={(v) => set('ctaTarget', v)} placeholder="/menu" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Alignment">
          <SelectInput
            value={hero.alignment}
            onChange={(v) => set('alignment', v)}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
          />
        </Field>
        <Field label="Theme">
          <SelectInput
            value={hero.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        </Field>
        <Field label="Mobile Variant">
          <SelectInput
            value={hero.mobileVariant}
            onChange={(v) => set('mobileVariant', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'full', label: 'Full' },
            ]}
          />
        </Field>
      </div>
      <Field label="Overlay Opacity (0–1)">
        <NumberInput value={hero.overlayOpacity} onChange={(v) => set('overlayOpacity', v)} min={0} max={1} step={0.05} placeholder="0.45" />
      </Field>
    </div>
  )
}

// ── About Tab ─────────────────────────────────────────────────────────────────

function AboutTab({ about, onChange }: { about: AboutContent; onChange: (a: AboutContent) => void }) {
  const set = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) => onChange({ ...about, [k]: v })
  return (
    <div className="space-y-5">
      <Field label="Our Story">
        <TextInput value={about.story} onChange={(v) => set('story', v)} multiline placeholder="Tell your story…" />
      </Field>
      <Field label="Mission">
        <TextInput value={about.mission} onChange={(v) => set('mission', v)} multiline placeholder="Our mission is…" />
      </Field>
      <Field label="History">
        <TextInput value={about.history} onChange={(v) => set('history', v)} multiline placeholder="Founded in…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Founder Name">
          <TextInput value={about.founderName} onChange={(v) => set('founderName', v)} placeholder="Jane Doe" />
        </Field>
        <Field label="Founder Image URL">
          <TextInput value={about.founderImage} onChange={(v) => set('founderImage', v)} placeholder="https://…" />
        </Field>
      </div>
      <Field label="Founder Bio">
        <TextInput value={about.founderBio} onChange={(v) => set('founderBio', v)} multiline placeholder="Bio…" />
      </Field>
    </div>
  )
}

// ── Contact Tab ───────────────────────────────────────────────────────────────

function ContactTab({ contact, onChange }: { contact: ContactContent; onChange: (c: ContactContent) => void }) {
  const set = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) => onChange({ ...contact, [k]: v })
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone"><TextInput value={contact.phone} onChange={(v) => set('phone', v)} placeholder="+1 555 000 0000" /></Field>
        <Field label="Email"><TextInput value={contact.email} onChange={(v) => set('email', v)} placeholder="hello@restaurant.com" /></Field>
        <Field label="Website"><TextInput value={contact.website} onChange={(v) => set('website', v)} placeholder="https://…" /></Field>
        <Field label="WhatsApp"><TextInput value={contact.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+1 555 000 0000" /></Field>
        <Field label="Instagram"><TextInput value={contact.instagram} onChange={(v) => set('instagram', v)} placeholder="@handle" /></Field>
        <Field label="Facebook"><TextInput value={contact.facebook} onChange={(v) => set('facebook', v)} placeholder="facebook.com/page" /></Field>
        <Field label="TikTok"><TextInput value={contact.tiktok} onChange={(v) => set('tiktok', v)} placeholder="@handle" /></Field>
        <Field label="YouTube"><TextInput value={contact.youtube} onChange={(v) => set('youtube', v)} placeholder="youtube.com/channel" /></Field>
        <Field label="Telegram"><TextInput value={contact.telegram} onChange={(v) => set('telegram', v)} placeholder="t.me/channel" /></Field>
      </div>
      <Field label="Map Embed URL">
        <TextInput value={contact.mapEmbedUrl} onChange={(v) => set('mapEmbedUrl', v)} placeholder="https://maps.google.com/embed?…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Latitude"><NumberInput value={contact.latitude} onChange={(v) => set('latitude', v)} min={-90} max={90} step={0.000001} placeholder="40.7128" /></Field>
        <Field label="Longitude"><NumberInput value={contact.longitude} onChange={(v) => set('longitude', v)} min={-180} max={180} step={0.000001} placeholder="-74.0060" /></Field>
      </div>
    </div>
  )
}

// ── Theme Tab ─────────────────────────────────────────────────────────────────

function ThemeTab({ theme, onChange }: { theme: ThemeSettings; onChange: (t: ThemeSettings) => void }) {
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => onChange({ ...theme, [k]: v })
  return (
    <div className="space-y-5">
      <Field label="Primary Color">
        <ColorInput value={theme.primaryColor} onChange={(v) => set('primaryColor', v)} label="Primary color" />
      </Field>
      <Field label="Accent Color">
        <ColorInput value={theme.accentColor} onChange={(v) => set('accentColor', v)} label="Accent color" />
      </Field>
      <Field label="Background Color">
        <ColorInput value={theme.backgroundColor} onChange={(v) => set('backgroundColor', v)} label="Background color" />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Border Radius">
          <SelectInput
            value={theme.borderRadius}
            onChange={(v) => set('borderRadius', v)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
              { value: 'xl', label: 'XL' },
              { value: '2xl', label: '2XL' },
            ]}
          />
        </Field>
        <Field label="Card Style">
          <SelectInput
            value={theme.cardStyle}
            onChange={(v) => set('cardStyle', v)}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'elevated', label: 'Elevated' },
              { value: 'outlined', label: 'Outlined' },
            ]}
          />
        </Field>
        <Field label="Dark Mode">
          <SelectInput
            value={theme.darkModePreference}
            onChange={(v) => set('darkModePreference', v)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Field>
      </div>
      <Field label="Font Family">
        <TextInput value={theme.fontFamily} onChange={(v) => set('fontFamily', v)} placeholder="Inter, sans-serif" />
      </Field>
    </div>
  )
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewTab({ tenantSlug, layout }: { tenantSlug: string; layout: HomepageLayout }) {
  const enabledSections = layout.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.key)

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
          {layout.hero.headline && (
            <div
              className="rounded-xl p-6 text-center flex flex-col items-center gap-2"
              style={{ backgroundColor: layout.theme.primaryColor ?? 'var(--accent)' }}
            >
              <h2 className="text-2xl font-bold text-white">{layout.hero.headline}</h2>
              {layout.hero.subheadline && (
                <p className="text-sm text-white/80">{layout.hero.subheadline}</p>
              )}
              {layout.hero.ctaText && (
                <button
                  type="button"
                  className="mt-2 px-4 py-2 rounded-lg bg-white/20 text-white text-sm font-medium"
                >
                  {layout.hero.ctaText}
                </button>
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

  const [tab, setTab] = useState<Tab>('layout')
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
        {tab === 'layout' && (
          <SectionsTab
            sections={current.sections}
            onChange={(sections) => update({ sections })}
          />
        )}
        {tab === 'hero' && (
          <HeroTab
            hero={current.hero}
            onChange={(hero) => update({ hero })}
          />
        )}
        {tab === 'about' && (
          <AboutTab
            about={current.about}
            onChange={(about) => update({ about })}
          />
        )}
        {tab === 'contact' && (
          <ContactTab
            contact={current.contact}
            onChange={(contact) => update({ contact })}
          />
        )}
        {tab === 'theme' && (
          <ThemeTab
            theme={current.theme}
            onChange={(theme) => update({ theme })}
          />
        )}
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
