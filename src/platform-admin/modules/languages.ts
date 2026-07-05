/**
 * Platform Administration — Language Management Center — P9.5.5
 *
 * `platform.languages.registry` is the `localization.languages` collection
 * `docs/P9.5.0_LOCALIZATION_ARCHITECTURE.md` §2 designed, finally
 * implemented as a real Collection Framework module (P9.2's `'collection'`
 * field type — the same mechanism Countries and Platform Users already
 * use, not a fourth reimplementation). One ~30-property schema applied to
 * every language in `LANGUAGE_ROSTER` below (the 6 operational languages
 * already live in `src/i18n/language-registry.ts`, P9.5.1A, plus 24
 * additional real languages registered here disabled — proving "exists in
 * the registry, disabled until activated" the same way Countries proved it
 * at 176 entities).
 *
 * Deliberately separate from the existing `languages` config module
 * (`src/config/modules/languages.ts`, P9.0/P9.5.1A) — that module answers
 * "which locales are exposed platform/tenant-wide" (a flat code array +
 * one default pointer, tenant-overridable) and is UNCHANGED by this phase.
 * This module answers "what does Platform Administration know and control
 * about each individual language" (typography, formatting, coverage,
 * lifecycle) and is Platform-Admin-only (`platformPermission`, Phase K) —
 * two different questions, matching the P9.5.0 design's own distinction
 * between the "Configuration" and "Localization" IA groups.
 */
import { defineField } from '@/config/field'
import type { ConfigFieldDefinition } from '@/config/types'
import type { ConfigCollectionValue } from '@/config/collection'
import { registerAdminModule } from '../register-module'
import { LANGUAGE_REGISTRY } from '@/i18n/language-registry'
import type { CountryRegion } from '@/config/modules/countries-registry-data'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

// ── Roster — P9.5.5 Phase B/L ────────────────────────────────────────────────
// The 6 operational languages (LANGUAGE_REGISTRY, P9.5.1A) plus 24
// additional real languages, registered here disabled — the "150+
// eventual roster, most disabled" model P9.5.0 designed, demonstrated at a
// real (if not yet exhaustive) scale rather than 6 fabricated stub rows.
interface RosterEntry {
  code: string
  bcp47: string
  englishName: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  region: CountryRegion
  currency: string
  timezone: string
}

const OPERATIONAL_ROSTER: RosterEntry[] = LANGUAGE_REGISTRY.map((l) => ({
  code: l.code,
  bcp47: l.bcp47,
  englishName: l.englishName,
  nativeName: l.nativeName,
  direction: l.direction,
  region:
    l.code === 'fa' || l.code === 'ar' ? 'Middle East' :
    l.code === 'zh' || l.code === 'tr' ? 'Asia' :
    l.code === 'it' ? 'Europe' : 'North America',
  currency: l.defaultCurrency,
  timezone: l.defaultTimezone,
}))

const ADDITIONAL_DISABLED_ROSTER: RosterEntry[] = [
  { code: 'fr', bcp47: 'fr', englishName: 'French', nativeName: 'Français', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Paris' },
  { code: 'de', bcp47: 'de', englishName: 'German', nativeName: 'Deutsch', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Berlin' },
  { code: 'es', bcp47: 'es', englishName: 'Spanish', nativeName: 'Español', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Madrid' },
  { code: 'pt', bcp47: 'pt', englishName: 'Portuguese', nativeName: 'Português', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Lisbon' },
  { code: 'ru', bcp47: 'ru', englishName: 'Russian', nativeName: 'Русский', direction: 'ltr', region: 'Europe', currency: 'RUB', timezone: 'Europe/Moscow' },
  { code: 'ja', bcp47: 'ja', englishName: 'Japanese', nativeName: '日本語', direction: 'ltr', region: 'Asia', currency: 'JPY', timezone: 'Asia/Tokyo' },
  { code: 'ko', bcp47: 'ko', englishName: 'Korean', nativeName: '한국어', direction: 'ltr', region: 'Asia', currency: 'KRW', timezone: 'Asia/Seoul' },
  { code: 'hi', bcp47: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', region: 'Asia', currency: 'INR', timezone: 'Asia/Kolkata' },
  { code: 'ur', bcp47: 'ur', englishName: 'Urdu', nativeName: 'اردو', direction: 'rtl', region: 'Asia', currency: 'PKR', timezone: 'Asia/Karachi' },
  { code: 'bn', bcp47: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', region: 'Asia', currency: 'BDT', timezone: 'Asia/Dhaka' },
  { code: 'vi', bcp47: 'vi', englishName: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', region: 'Asia', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
  { code: 'th', bcp47: 'th', englishName: 'Thai', nativeName: 'ไทย', direction: 'ltr', region: 'Asia', currency: 'THB', timezone: 'Asia/Bangkok' },
  { code: 'id', bcp47: 'id', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', region: 'Asia', currency: 'IDR', timezone: 'Asia/Jakarta' },
  { code: 'ms', bcp47: 'ms', englishName: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', region: 'Asia', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' },
  { code: 'nl', bcp47: 'nl', englishName: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Amsterdam' },
  { code: 'pl', bcp47: 'pl', englishName: 'Polish', nativeName: 'Polski', direction: 'ltr', region: 'Europe', currency: 'PLN', timezone: 'Europe/Warsaw' },
  { code: 'sv', bcp47: 'sv', englishName: 'Swedish', nativeName: 'Svenska', direction: 'ltr', region: 'Europe', currency: 'SEK', timezone: 'Europe/Stockholm' },
  { code: 'he', bcp47: 'he', englishName: 'Hebrew', nativeName: 'עברית', direction: 'rtl', region: 'Middle East', currency: 'ILS', timezone: 'Asia/Jerusalem' },
  { code: 'el', bcp47: 'el', englishName: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', region: 'Europe', currency: 'EUR', timezone: 'Europe/Athens' },
  { code: 'cs', bcp47: 'cs', englishName: 'Czech', nativeName: 'Čeština', direction: 'ltr', region: 'Europe', currency: 'CZK', timezone: 'Europe/Prague' },
  { code: 'ro', bcp47: 'ro', englishName: 'Romanian', nativeName: 'Română', direction: 'ltr', region: 'Europe', currency: 'RON', timezone: 'Europe/Bucharest' },
  { code: 'hu', bcp47: 'hu', englishName: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', region: 'Europe', currency: 'HUF', timezone: 'Europe/Budapest' },
  { code: 'uk', bcp47: 'uk', englishName: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', region: 'Europe', currency: 'UAH', timezone: 'Europe/Kyiv' },
  { code: 'sw', bcp47: 'sw', englishName: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', region: 'Africa', currency: 'KES', timezone: 'Africa/Nairobi' },
]

export const LANGUAGE_ROSTER: RosterEntry[] = [...OPERATIONAL_ROSTER, ...ADDITIONAL_DISABLED_ROSTER]
export const ALL_ROSTER_CODES: string[] = LANGUAGE_ROSTER.map((l) => l.code)
const ROSTER_BY_CODE = new Map(LANGUAGE_ROSTER.map((l) => [l.code, l]))

function rosterEntry(code: string): RosterEntry {
  const entry = ROSTER_BY_CODE.get(code)
  if (!entry) throw new Error(`[platform.languages] unknown roster code "${code}"`)
  return entry
}

const REGIONS: CountryRegion[] = ['North America', 'South America', 'Europe', 'Middle East', 'Asia', 'Africa', 'Oceania']
const CURRENCY_OPTIONS = Array.from(new Set(LANGUAGE_ROSTER.map((l) => l.currency))).sort().map((c) => ({ value: c, label: c }))
const FALLBACK_OPTIONS = [
  { value: '', label: '— None (root of the fallback chain) —' },
  ...LANGUAGE_ROSTER.map((l) => ({ value: l.code, label: `${l.nativeName} (${l.englishName})` })),
]
const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Noto Sans', label: 'Noto Sans' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
  { value: 'Vazirmatn', label: 'Vazirmatn (Persian/Arabic)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
]
const WEIGHT_OPTIONS = [400, 500, 600, 700].map((w) => ({ value: w, label: String(w) }))
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'testing', label: 'Testing' },
  { value: 'published', label: 'Published' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'archived', label: 'Archived' },
]
const DATE_STYLE_OPTIONS = ['short', 'medium', 'long', 'full'].map((v) => ({ value: v, label: v }))
const HOUR_CYCLE_OPTIONS = [{ value: 'h12', label: '12-hour' }, { value: 'h23', label: '24-hour' }]
const NUMBER_NOTATION_OPTIONS = [{ value: 'standard', label: 'Standard (1,234,567)' }, { value: 'compact', label: 'Compact (1.2M)' }]

// ── Phase J — cross-entity validation (a real gap the existing per-field
// ConfigurationValidator can't express: it validates one field's value in
// isolation, never "no two entities may both be `default: true`" or "does
// this entity's fallback chain terminate". Rather than extending the
// framework's shape for one module, this is a small, pure, dedicated
// function — the same "modeling correction over a new framework
// capability" resolution P9.2/P9.4 already used for their own real gaps. ──
export interface LanguageCollectionError {
  code: string
  message: string
}

export function validateLanguageCollection(entries: ConfigCollectionValue): LanguageCollectionError[] {
  const errors: LanguageCollectionError[] = []
  const codes = Object.keys(entries)

  const defaults = codes.filter((c) => Boolean((entries[c] as Record<string, unknown>)?.default))
  if (defaults.length > 1) {
    errors.push({ code: defaults.join(','), message: `Only one language may be the default; found ${defaults.length}: ${defaults.join(', ')}.` })
  }

  for (const code of codes) {
    const values = entries[code] as Record<string, unknown>
    if (!values) continue

    const direction = values.direction
    if (direction !== 'ltr' && direction !== 'rtl') {
      errors.push({ code, message: `${code}: direction must be 'ltr' or 'rtl', got ${JSON.stringify(direction)}.` })
    }
    if (typeof values.rtl === 'boolean' && direction && values.rtl !== (direction === 'rtl')) {
      errors.push({ code, message: `${code}: rtl flag (${values.rtl}) disagrees with direction (${direction}).` })
    }

    if (values.status === 'published') {
      const required = ['nativeName', 'englishName', 'fontFamily', 'dateStyle', 'currency']
      const missing = required.filter((key) => {
        const v = (values as Record<string, unknown>)[key]
        return v === undefined || v === null || v === ''
      })
      if (missing.length > 0) {
        errors.push({ code, message: `${code}: cannot be Published while missing required metadata: ${missing.join(', ')}.` })
      }
    }

    // Fallback-cycle detection — walk each entity's fallbackLanguage chain;
    // a language with no fallback (null/itself) terminates. A cycle among
    // disabled languages would otherwise silently loop forever if this
    // collection's fallback chain were ever walked at runtime the way
    // `resolveFallbackChain()` (src/i18n/runtime.ts) walks the 6-language
    // registry's single-hop pointers today.
    const seen = new Set<string>([code])
    let cursor = values.fallbackLanguage as string | undefined
    let hops = 0
    while (cursor && hops < codes.length + 1) {
      if (seen.has(cursor)) {
        errors.push({ code, message: `${code}: fallback chain cycles back to "${cursor}" — fallback chains must terminate.` })
        break
      }
      seen.add(cursor)
      cursor = (entries[cursor] as Record<string, unknown> | undefined)?.fallbackLanguage as string | undefined
      hops += 1
    }
  }

  return errors
}

// ── Phase B/E/F — the ~30-property schema shared by every language entity ──
const LANGUAGE_SCHEMA: ConfigFieldDefinition[] = [
  // Identity
  defineField({ id: 'nativeName', title: 'Native Name', description: 'The language name written in itself, e.g. "فارسی".', category: 'identity', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text', validation: { required: true } }),
  defineField({ id: 'englishName', title: 'English Name', category: 'identity', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text', validation: { required: true } }),
  defineField({ id: 'region', title: 'Region', category: 'identity', type: 'select', default: 'Europe', options: REGIONS.map((r) => ({ value: r, label: r })), permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'searchKeywords', title: 'Search Keywords', description: 'Extra terms this language should be findable by (aliases, alternate spellings).', category: 'identity', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text' }),
  defineField({ id: 'notes', title: 'Notes', category: 'identity', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'textarea' }),

  // Lifecycle / activation (Phase G)
  // Note: cannot become Published unless nativeName/englishName/fontFamily/dateStyle/currency
  // are set — enforced by validateLanguageCollection(), NOT `validation.custom` here. A
  // per-field custom validator only ever sees this one property's own value (see
  // src/config/validator.ts's validateField(field, value) signature), never sibling
  // entities/properties, so it cannot express a cross-entity/cross-property rule like this
  // one — wiring `custom` here would silently receive the wrong argument shape the moment
  // anything called configurationValidator.validate() on a collection schema property.
  defineField({ id: 'status', title: 'Status', category: 'lifecycle', type: 'select', default: 'draft', options: STATUS_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'enabled', title: 'Enabled', description: 'Master on/off switch. Platform Administration only — see docs/P9.5.5_LANGUAGE_MANAGEMENT.md Phase K.', category: 'lifecycle', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'visibility', title: 'Visible in Switcher', description: 'Shown in the language switcher. Enabled-but-invisible is reachable by direct link only.', category: 'lifecycle', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'default', title: 'Platform Default', description: 'Exactly one language may be the default — enforced by validateLanguageCollection().', category: 'lifecycle', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'beta', title: 'Beta', category: 'lifecycle', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'experimental', title: 'Experimental', category: 'lifecycle', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'lastUpdated', title: 'Last Updated', category: 'lifecycle', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text', preview: { kind: 'datetime' } }),
  defineField({ id: 'translator', title: 'Translator / Owner', category: 'lifecycle', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text' }),
  defineField({ id: 'version', title: 'Version', description: 'Free-form revision marker for this language entry (e.g. "1.2.0"), bumped by an admin alongside published changes.', category: 'lifecycle', type: 'string', default: '0.1.0', permissions: PERMISSIONS, uiControl: 'text' }),

  // Coverage (Phase H)
  defineField({ id: 'translationCoverage', title: 'Translation Coverage %', description: 'Percentage of reference (en) keys with any value in this locale.', category: 'coverage', type: 'number', default: 0, validation: { min: 0, max: 100 }, permissions: PERMISSIONS, uiControl: 'slider' }),
  defineField({ id: 'completionPercent', title: 'Completion %', description: 'Percentage of translated keys considered final (reviewed, not machine-only).', category: 'coverage', type: 'number', default: 0, validation: { min: 0, max: 100 }, permissions: PERMISSIONS, uiControl: 'slider' }),
  defineField({ id: 'machineTranslated', title: 'Machine Translated', category: 'coverage', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'humanReviewed', title: 'Human Reviewed', category: 'coverage', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),

  // Formatting (Phase F) — every value here is an Intl.* option, never a
  // hand-rolled pattern string, per docs/P9.5.0_LOCALIZATION_ARCHITECTURE.md §4.
  defineField({ id: 'currency', title: 'Default Currency', category: 'formatting', type: 'select', default: 'USD', options: CURRENCY_OPTIONS, permissions: PERMISSIONS, uiControl: 'currency_picker' }),
  defineField({ id: 'timezone', title: 'Default Timezone', category: 'formatting', type: 'string', default: 'UTC', permissions: PERMISSIONS, uiControl: 'timezone_picker', preview: { kind: 'datetime' } }),
  defineField({ id: 'dateStyle', title: 'Date Format', description: 'Intl.DateTimeFormat dateStyle.', category: 'formatting', type: 'select', default: 'medium', options: DATE_STYLE_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'hourCycle', title: 'Time Format', description: 'Intl.DateTimeFormat hourCycle.', category: 'formatting', type: 'select', default: 'h23', options: HOUR_CYCLE_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'numberNotation', title: 'Number Format', description: 'Intl.NumberFormat notation.', category: 'formatting', type: 'select', default: 'standard', options: NUMBER_NOTATION_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'pluralRules', title: 'Plural Rules Locale', description: 'The BCP 47 tag Intl.PluralRules should be constructed with — not a custom plural engine.', category: 'formatting', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text' }),
  defineField({ id: 'fallbackLanguage', title: 'Fallback Language', description: 'One-hop fallback pointer; chain resolution is a pure traversal (see validateLanguageCollection()\'s cycle check).', category: 'formatting', type: 'select', default: 'en', options: FALLBACK_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),

  // Direction / RTL (Phase I)
  defineField({ id: 'direction', title: 'Direction', category: 'direction', type: 'select', default: 'ltr', options: [{ value: 'ltr', label: 'Left-to-right' }, { value: 'rtl', label: 'Right-to-left' }], permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'rtl', title: 'RTL', description: 'Must agree with Direction — see validateLanguageCollection().', category: 'direction', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),

  // Typography (Phase E)
  defineField({ id: 'fontFamily', title: 'Primary Font', category: 'typography', type: 'font', default: 'Inter', options: FONT_OPTIONS, permissions: PERMISSIONS, uiControl: 'font_selector', preview: { kind: 'font-sample' } }),
  defineField({ id: 'secondaryFontFamily', title: 'Secondary Font', category: 'typography', type: 'font', default: 'Roboto', options: FONT_OPTIONS, permissions: PERMISSIONS, uiControl: 'font_selector', preview: { kind: 'font-sample' } }),
  defineField({ id: 'headingFontFamily', title: 'Heading Font', category: 'typography', type: 'font', default: 'Poppins', options: FONT_OPTIONS, permissions: PERMISSIONS, uiControl: 'font_selector', preview: { kind: 'font-sample' } }),
  defineField({ id: 'monoFontFamily', title: 'Monospace Font', category: 'typography', type: 'font', default: 'JetBrains Mono', options: FONT_OPTIONS, permissions: PERMISSIONS, uiControl: 'font_selector', preview: { kind: 'font-sample' } }),
  defineField({ id: 'fontScale', title: 'Font Scale', description: 'Multiplier applied to the platform base font size.', category: 'typography', type: 'number', default: 1, validation: { min: 0.8, max: 1.3, step: 0.05 }, permissions: PERMISSIONS, uiControl: 'slider' }),
  defineField({ id: 'lineHeight', title: 'Line Height', category: 'typography', type: 'number', default: 1.5, validation: { min: 1.1, max: 2.2, step: 0.05 }, permissions: PERMISSIONS, uiControl: 'slider' }),
  defineField({ id: 'letterSpacing', title: 'Letter Spacing (em)', category: 'typography', type: 'number', default: 0, validation: { min: -0.03, max: 0.1, step: 0.005 }, permissions: PERMISSIONS, uiControl: 'slider' }),
  defineField({ id: 'fontWeight', title: 'Primary Weight', category: 'typography', type: 'select', default: 400, options: WEIGHT_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
]

// ── Phase L — realistic mock data ────────────────────────────────────────────
// The 6 operational languages carry the exact coverage percentages the
// phase brief specifies; the 24 additional roster languages exist,
// disabled, at 0% coverage — a real "not yet started" state, not a fake
// number invented to look complete.
const OPERATIONAL_DEFAULTS: Record<string, Partial<Record<string, unknown>>> = {
  en: { translationCoverage: 100, completionPercent: 100, machineTranslated: false, humanReviewed: true, status: 'published', enabled: true, visibility: true, default: true, translator: 'Platform Team', lastUpdated: '2026-06-01' },
  fa: { translationCoverage: 99, completionPercent: 97, machineTranslated: false, humanReviewed: true, status: 'published', enabled: true, visibility: true, translator: 'Sara K.', lastUpdated: '2026-06-15' },
  ar: { translationCoverage: 97, completionPercent: 94, machineTranslated: false, humanReviewed: true, status: 'published', enabled: true, visibility: true, translator: 'Omar H.', lastUpdated: '2026-06-10' },
  zh: { translationCoverage: 20, completionPercent: 8, machineTranslated: true, humanReviewed: false, status: 'testing', enabled: true, visibility: false, beta: true, translator: 'Unassigned', lastUpdated: '2026-05-01' },
  it: { translationCoverage: 15, completionPercent: 5, machineTranslated: true, humanReviewed: false, status: 'testing', enabled: true, visibility: false, beta: true, translator: 'Unassigned', lastUpdated: '2026-04-20' },
  tr: { translationCoverage: 12, completionPercent: 3, machineTranslated: true, humanReviewed: false, status: 'draft', enabled: true, visibility: false, experimental: true, translator: 'Unassigned', lastUpdated: '2026-04-10' },
}

const LANGUAGE_REGISTRY_DEFAULT: ConfigCollectionValue = Object.fromEntries(
  LANGUAGE_ROSTER.map((l) => {
    const isOperational = Boolean(OPERATIONAL_DEFAULTS[l.code])
    const isRtl = l.direction === 'rtl'
    return [l.code, {
      nativeName: l.nativeName,
      englishName: l.englishName,
      region: l.region,
      searchKeywords: '',
      notes: '',
      status: 'draft',
      enabled: false,
      visibility: false,
      default: false,
      beta: false,
      experimental: false,
      lastUpdated: '',
      translator: '',
      version: isOperational ? '1.0.0' : '0.1.0',
      translationCoverage: 0,
      completionPercent: 0,
      machineTranslated: false,
      humanReviewed: false,
      currency: l.currency,
      timezone: l.timezone,
      dateStyle: 'medium',
      hourCycle: 'h23',
      numberNotation: 'standard',
      pluralRules: l.code,
      fallbackLanguage: l.code === 'en' ? '' : 'en',
      direction: l.direction,
      rtl: isRtl,
      fontFamily: isRtl ? 'Vazirmatn' : 'Inter',
      secondaryFontFamily: isRtl ? 'Noto Sans Arabic' : 'Roboto',
      headingFontFamily: isRtl ? 'Vazirmatn' : 'Poppins',
      monoFontFamily: 'JetBrains Mono',
      fontScale: isRtl ? 1.05 : 1,
      lineHeight: isRtl ? 1.7 : 1.5,
      letterSpacing: 0,
      fontWeight: 400,
      ...(isOperational ? OPERATIONAL_DEFAULTS[l.code] : {}),
    }]
  }),
)

registerAdminModule({
  id: 'platform.languages',
  name: 'Language Management',
  description: 'Every platform language — activation, typography, formatting, fallback, and translation coverage. Reuses the P9.2 Collection Framework; nothing here is a new engine.',
  group: 'Localization',
  icon: 'Languages',
  platformPermission: 'platform.localization.view',
  fields: [
    defineField<ConfigCollectionValue>({
      id: 'platform.languages.registry',
      title: 'Languages',
      description: `Every language in the ${LANGUAGE_ROSTER.length}-language roster (${OPERATIONAL_ROSTER.length} operational, ${ADDITIONAL_DISABLED_ROSTER.length} disabled) with its own configurable properties.`,
      category: 'localization',
      type: 'collection',
      default: LANGUAGE_REGISTRY_DEFAULT,
      permissions: PERMISSIONS,
      inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
      display: { icon: 'Languages' },
      collection: {
        entityLabel: 'Language',
        entityIdLabel: 'Code',
        schema: LANGUAGE_SCHEMA,
        entityIds: ALL_ROSTER_CODES,
        defaultGroupBy: 'region',
        getEntityLabel: (code) => rosterEntry(code).nativeName,
        getEntitySearchTerms: (code) => {
          const entry = rosterEntry(code)
          return [entry.bcp47, entry.englishName]
        },
        buildPreview: (values) => ({
          Direction: String(values.direction ?? ''),
          'Sample (RTL-aware)': values.direction === 'rtl' ? '← نص تجريبي' : 'Sample text →',
          'Date Style': String(values.dateStyle ?? ''),
          Currency: String(values.currency ?? ''),
          'Fallback': String(values.fallbackLanguage ?? ''),
        }),
        // P9.5.6 Phase H — wires the existing (previously unused by any UI
        // path) validateLanguageCollection() into the generic collection
        // framework's validateEntries hook, so its errors now surface as a
        // banner in ConfigurationCollectionTable and gate the 'publish' bulk
        // action (useConfigurationBulkActions). The function itself is
        // unchanged from P9.5.5.
        validateEntries: validateLanguageCollection,
      },
    }),
  ],
})

