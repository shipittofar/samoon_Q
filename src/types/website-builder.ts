// P8.8.6 — Business Website Builder & Public Content Management

export type SectionKey =
  | 'hero'
  | 'featured_menu'
  | 'about'
  | 'gallery'
  | 'promotions'
  | 'reviews'
  | 'branches'
  | 'events'
  | 'faq'
  | 'contact'

export interface SectionConfig {
  key: SectionKey
  enabled: boolean
  order: number
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'hero',          enabled: true,  order: 0 },
  { key: 'featured_menu', enabled: true,  order: 1 },
  { key: 'about',         enabled: true,  order: 2 },
  { key: 'promotions',    enabled: true,  order: 3 },
  { key: 'reviews',       enabled: true,  order: 4 },
  { key: 'branches',      enabled: true,  order: 5 },
  { key: 'gallery',       enabled: true,  order: 6 },
  { key: 'events',        enabled: false, order: 7 },
  { key: 'faq',           enabled: false, order: 8 },
  { key: 'contact',       enabled: true,  order: 9 },
]

// Translation-key suffixes under the `console.*` namespace — resolve via
// useTranslations('console') at render time, not raw English. Kept as string
// values (not raw labels) so the Console can localize section chrome; see
// docs/P9.5.7C_CONSOLE_LOCALIZATION.md for the P9.5.7C.5 migration notes.
export const SECTION_LABELS: Record<SectionKey, string> = {
  hero:          'websiteSectionHero',
  featured_menu: 'websiteSectionFeaturedMenu',
  about:         'websiteSectionAboutUs',
  gallery:       'galleryLabel',
  promotions:    'promotionsLabel',
  reviews:       'breadcrumbs.reviews',
  branches:      'websiteSectionOurLocations',
  events:        'moduleFeatureEvents',
  faq:           'moduleFeatureFaq',
  contact:       'contactLabel',
}

export type HeroAlignment = 'left' | 'center' | 'right'
export type HeroTheme = 'light' | 'dark' | 'auto'

export interface HeroContent {
  headline?: string
  subheadline?: string
  backgroundImage?: string
  ctaText?: string
  ctaTarget?: string
  overlayOpacity?: number
  alignment?: HeroAlignment
  theme?: HeroTheme
  mobileVariant?: 'compact' | 'full'
}

export interface FAQItem {
  id: string
  question: string
  answer: string
}

export interface AboutContent {
  story?: string
  mission?: string
  history?: string
  founderName?: string
  founderBio?: string
  founderImage?: string
  awards?: string[]
  languages?: string[]
}

export interface ContactContent {
  phone_number?: string
  email?: string
  website?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  tiktok?: string
  youtube?: string
  telegram?: string
  mapEmbedUrl?: string
  latitude?: number
  longitude?: number
}

export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type CardStyle = 'flat' | 'elevated' | 'outlined'
export type DarkModePreference = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  borderRadius?: BorderRadius
  cardStyle?: CardStyle
  fontFamily?: string
  darkModePreference?: DarkModePreference
}

export type PublishStatus = 'draft' | 'published'

export interface HomepageVersion {
  id: string
  savedAt: string
  label?: string
  sections: SectionConfig[]
  hero: HeroContent
  about: AboutContent
  contact: ContactContent
  faq: FAQItem[]
  theme: ThemeSettings
}

export interface HomepageLayout {
  sections: SectionConfig[]
  hero: HeroContent
  about: AboutContent
  contact: ContactContent
  faq: FAQItem[]
  theme: ThemeSettings
  status: PublishStatus
  lastPublishedAt?: string
  lastSavedAt?: string
  publishedVersion?: HomepageVersion
  versions?: HomepageVersion[]
  brandTheme?: BrandThemeName      // P8.8.6.1 opinionated theme
  heroConfig?: HeroConfig          // P8.8.6.1 opinionated hero
  sectionTemplates?: SectionTemplates  // P8.8.6.1 per-section templates
  navItems?: TenantNavItemConfig[] // P8.8.11.1 owner-configurable nav order/visibility
}

export interface BranchContentOverrides {
  heroHeadline?: string
  heroSubheadline?: string
  heroImage?: string
  description?: string
  phone_number?: string
  gallery?: string[]
  about?: string
}

export const DEFAULT_HERO: HeroContent = {
  alignment: 'center',
  theme: 'dark',
  overlayOpacity: 0.45,
  mobileVariant: 'compact',
}

export const DEFAULT_THEME: ThemeSettings = {
  borderRadius: 'xl',
  cardStyle: 'elevated',
  darkModePreference: 'system',
}

// ── P8.8.11.1 — Tenant Navigation Configuration ───────────────────────────────

/**
 * A single entry in the owner-configurable tenant navigation.
 * Owners select from a curated list of keys — no free-form URL editing.
 * The key maps to a known route segment that the TenantHeader converts to
 * a branch-aware full path at render time.
 */
export interface TenantNavItemConfig {
  /** Curated nav key — matches a route segment or special key ('discover', 'locations'). */
  key: string
  /** Whether this item is visible in the navigation. */
  enabled: boolean
  /** Display order (ascending). */
  order: number
  /** Optional custom label override (e.g., owner renames "Menu" → "Our Menu"). */
  label?: string
}

/** Default nav configuration — mirrors the module registry navItems order. */
export const DEFAULT_TENANT_NAV: TenantNavItemConfig[] = [
  { key: 'discover',     enabled: true,  order: 0 },
  { key: 'menu',         enabled: true,  order: 1 },
  { key: 'locations',    enabled: false, order: 2 },
  { key: 'reservation',  enabled: true,  order: 3 },
  { key: 'gallery',      enabled: false, order: 4 },
  { key: 'reviews',      enabled: true,  order: 5 },
  { key: 'about',        enabled: true,  order: 6 },
  { key: 'contact',      enabled: false, order: 7 },
]

export const DEFAULT_LAYOUT: HomepageLayout = {
  sections: DEFAULT_SECTIONS,
  hero: DEFAULT_HERO,
  about: {},
  contact: {},
  faq: [],
  theme: DEFAULT_THEME,
  status: 'draft',
}

// ── P8.8.6.1 — Opinionated Website Builder ────────────────────────────────────

export type BrandThemeName =
  | 'elegant' | 'modern' | 'luxury' | 'coffee' | 'street_food'
  | 'minimal' | 'dark' | 'fresh' | 'family' | 'premium'

export interface BrandThemeTokens {
  primary: string      // hex
  accent: string       // hex
  bg: string
  fg: string
  card: string
  fgMuted: string
  fontFamily: string
  borderRadius: string // css value e.g. '1rem'
  cardShadow: string
}

export interface BrandThemeDef {
  name: BrandThemeName
  label: string
  description: string
  tokens: BrandThemeTokens
  darkModePreference: DarkModePreference
}

export const BRAND_THEMES: BrandThemeDef[] = [
  {
    name: 'elegant',
    label: 'Elegant',
    description: 'Refined serif typography, champagne tones, subtle gold accents',
    tokens: { primary: '#b8964a', accent: '#d4af37', bg: '#faf8f4', fg: '#1a1208', card: '#f5f0e8', fgMuted: '#7a6a50', fontFamily: '"Playfair Display", Georgia, serif', borderRadius: '0.5rem', cardShadow: '0 1px 4px rgba(0,0,0,0.08)' },
    darkModePreference: 'light',
  },
  {
    name: 'modern',
    label: 'Modern',
    description: 'Clean sans-serif, crisp white, vibrant blue accents',
    tokens: { primary: '#2563eb', accent: '#3b82f6', bg: '#ffffff', fg: '#111827', card: '#f9fafb', fgMuted: '#6b7280', fontFamily: '"Inter", system-ui, sans-serif', borderRadius: '0.75rem', cardShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    darkModePreference: 'system',
  },
  {
    name: 'luxury',
    label: 'Luxury',
    description: 'Deep black canvas, gold typography, premium feel',
    tokens: { primary: '#c9a84c', accent: '#f0d060', bg: '#0a0a0a', fg: '#f5f0e0', card: '#1a1a1a', fgMuted: '#8a7a60', fontFamily: '"Cormorant Garamond", Georgia, serif', borderRadius: '0.25rem', cardShadow: '0 4px 16px rgba(0,0,0,0.4)' },
    darkModePreference: 'dark',
  },
  {
    name: 'coffee',
    label: 'Coffee',
    description: 'Warm espresso browns, cream backgrounds, cozy atmosphere',
    tokens: { primary: '#6f4e37', accent: '#a07850', bg: '#fdf6ec', fg: '#2d1b0e', card: '#f5ead8', fgMuted: '#7a5c40', fontFamily: '"Lora", Georgia, serif', borderRadius: '0.625rem', cardShadow: '0 2px 6px rgba(111,78,55,0.12)' },
    darkModePreference: 'light',
  },
  {
    name: 'street_food',
    label: 'Street Food',
    description: 'Bold orange energy, dark backgrounds, urban attitude',
    tokens: { primary: '#f97316', accent: '#fb923c', bg: '#1c1917', fg: '#fafaf9', card: '#292524', fgMuted: '#a8a29e', fontFamily: '"Oswald", "Arial Narrow", sans-serif', borderRadius: '0.375rem', cardShadow: '0 2px 12px rgba(249,115,22,0.2)' },
    darkModePreference: 'dark',
  },
  {
    name: 'minimal',
    label: 'Minimal',
    description: 'Pure white, black type, zero distraction',
    tokens: { primary: '#000000', accent: '#374151', bg: '#ffffff', fg: '#000000', card: '#f8f8f8', fgMuted: '#9ca3af', fontFamily: '"DM Sans", system-ui, sans-serif', borderRadius: '0.25rem', cardShadow: 'none' },
    darkModePreference: 'light',
  },
  {
    name: 'dark',
    label: 'Dark',
    description: 'Slate dark surfaces, emerald accent, sleek and modern',
    tokens: { primary: '#10b981', accent: '#34d399', bg: '#0f172a', fg: '#f1f5f9', card: '#1e293b', fgMuted: '#94a3b8', fontFamily: '"Inter", system-ui, sans-serif', borderRadius: '0.75rem', cardShadow: '0 4px 16px rgba(0,0,0,0.3)' },
    darkModePreference: 'dark',
  },
  {
    name: 'fresh',
    label: 'Fresh',
    description: 'Vibrant greens, natural whites, healthy and inviting',
    tokens: { primary: '#16a34a', accent: '#22c55e', bg: '#f0fdf4', fg: '#14532d', card: '#dcfce7', fgMuted: '#4ade80', fontFamily: '"Nunito", "Trebuchet MS", sans-serif', borderRadius: '1rem', cardShadow: '0 2px 8px rgba(22,163,74,0.1)' },
    darkModePreference: 'light',
  },
  {
    name: 'family',
    label: 'Family',
    description: 'Warm orange, rounded corners, approachable and fun',
    tokens: { primary: '#ea580c', accent: '#f97316', bg: '#fff7ed', fg: '#431407', card: '#ffedd5', fgMuted: '#9a3412', fontFamily: '"Poppins", "Trebuchet MS", sans-serif', borderRadius: '1.25rem', cardShadow: '0 2px 8px rgba(234,88,12,0.1)' },
    darkModePreference: 'light',
  },
  {
    name: 'premium',
    label: 'Premium',
    description: 'Deep navy, champagne gold, executive presence',
    tokens: { primary: '#1e3a5f', accent: '#c9a84c', bg: '#f8f9fb', fg: '#0f2040', card: '#eef0f5', fgMuted: '#64748b', fontFamily: '"Montserrat", "Gill Sans", sans-serif', borderRadius: '0.5rem', cardShadow: '0 4px 12px rgba(30,58,95,0.1)' },
    darkModePreference: 'light',
  },
]

export type HeroLayoutVariant = 'hero_a' | 'hero_b' | 'hero_c' | 'hero_d' | 'hero_e'
export type HeroBackgroundType = 'image' | 'video' | 'gradient' | 'solid'
export type HeroPrimaryCtaType = 'reserve' | 'order_online' | 'view_menu' | 'contact' | 'directions'
export type HeroSecondaryCtaType = 'promotions' | 'loyalty' | 'gallery' | 'reviews'

export interface HeroConfig {
  layout: HeroLayoutVariant
  backgroundType: HeroBackgroundType
  backgroundImage?: string
  backgroundVideo?: string
  backgroundGradient?: string
  backgroundSolid?: string
  alignment: HeroAlignment
  primaryCta?: HeroPrimaryCtaType
  secondaryCta?: HeroSecondaryCtaType
}

// Translation-key suffixes under `console.*` — resolve via useTranslations('console').
export const HERO_LAYOUT_LABELS: Record<HeroLayoutVariant, { label: string; description: string }> = {
  hero_a: { label: 'heroLayoutACenteredLabel',    description: 'heroLayoutACenteredDesc' },
  hero_b: { label: 'heroLayoutBLeftAlignedLabel', description: 'heroLayoutBLeftAlignedDesc' },
  hero_c: { label: 'heroLayoutCSplitLabel',       description: 'heroLayoutCSplitDesc' },
  hero_d: { label: 'heroLayoutDMinimalLabel',     description: 'heroLayoutDMinimalDesc' },
  hero_e: { label: 'heroLayoutECinematicLabel',   description: 'heroLayoutECinematicDesc' },
}

export const HERO_PRIMARY_CTA_LABELS: Record<HeroPrimaryCtaType, string> = {
  reserve:      'ctaReserveATable',
  order_online: 'ctaOrderOnline',
  view_menu:    'ctaViewMenu',
  contact:      'ctaContactUs',
  directions:   'ctaGetDirections',
}

export const HERO_SECONDARY_CTA_LABELS: Record<HeroSecondaryCtaType, string> = {
  promotions: 'ctaSeePromotions',
  loyalty:    'ctaJoinLoyalty',
  gallery:    'ctaViewGallery',
  reviews:    'ctaReadReviews',
}

export type GalleryTemplate  = 'grid' | 'slider' | 'masonry' | 'compact'
export type ReviewsTemplate  = 'cards' | 'carousel' | 'minimal' | 'compact'
export type ContactTemplate  = 'map_left' | 'map_right' | 'card' | 'minimal'
export type AboutTemplate    = 'story_left' | 'story_right' | 'wide' | 'compact'

export interface SectionTemplates {
  gallery?:  GalleryTemplate
  reviews?:  ReviewsTemplate
  contact?:  ContactTemplate
  about?:    AboutTemplate
}

export const GALLERY_TEMPLATE_LABELS: Record<GalleryTemplate, string> = {
  grid:    'templateGrid',
  slider:  'templateSlider',
  masonry: 'templateMasonry',
  compact: 'templateCompact',
}

export const REVIEWS_TEMPLATE_LABELS: Record<ReviewsTemplate, string> = {
  cards:    'templateCards',
  carousel: 'templateCarousel',
  minimal:  'templateMinimal',
  compact:  'templateCompact',
}

export const CONTACT_TEMPLATE_LABELS: Record<ContactTemplate, string> = {
  map_left:  'templateMapLeft',
  map_right: 'templateMapRight',
  card:      'templateCard',
  minimal:   'templateMinimal',
}

export const ABOUT_TEMPLATE_LABELS: Record<AboutTemplate, string> = {
  story_left:  'templateStoryLeft',
  story_right: 'templateStoryRight',
  wide:        'templateWide',
  compact:     'templateCompact',
}

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  layout: 'hero_a',
  backgroundType: 'image',
  alignment: 'center',
  primaryCta: 'view_menu',
}

export const DEFAULT_SECTION_TEMPLATES: SectionTemplates = {
  gallery: 'grid',
  reviews: 'cards',
  contact: 'map_left',
  about:   'story_left',
}

export const DEFAULT_BRAND_THEME: BrandThemeName = 'modern'
