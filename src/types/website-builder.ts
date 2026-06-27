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

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero:          'Hero Banner',
  featured_menu: 'Featured Menu',
  about:         'About Us',
  gallery:       'Gallery',
  promotions:    'Promotions',
  reviews:       'Reviews',
  branches:      'Our Locations',
  events:        'Events',
  faq:           'FAQ',
  contact:       'Contact',
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
  phone?: string
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
}

export interface BranchContentOverrides {
  heroHeadline?: string
  heroSubheadline?: string
  heroImage?: string
  description?: string
  phone?: string
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

export const DEFAULT_LAYOUT: HomepageLayout = {
  sections: DEFAULT_SECTIONS,
  hero: DEFAULT_HERO,
  about: {},
  contact: {},
  faq: [],
  theme: DEFAULT_THEME,
  status: 'draft',
}
