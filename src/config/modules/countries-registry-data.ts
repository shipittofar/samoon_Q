/**
 * Countries Registry Data — P9.2 Phase B/G/J
 *
 * Pure data backing the `countries.registry` collection field
 * (src/config/modules/countries.ts). Countries-specific by definition — this
 * is the "one piece of genuinely Countries-specific work" the audit doc
 * calls out (docs/P9.2_COUNTRIES_AUDIT.md §7); everything that *reads* this
 * data (ConfigurationCollectionTable, the bulk-action engine, search/filter)
 * is generic framework code untouched by what's declared here.
 *
 * `CODE_TO_REGION` covers all 176 countries in `src/data/countries.ts`,
 * remapped from that file's 8 region-comment groups onto the 7 canonical
 * regions this phase asks for (North America, South America, Europe, Middle
 * East, Asia, Africa, Oceania) — Central America/Caribbean folds into North
 * America, and Pakistan/Afghanistan move from the source file's "Middle
 * East" grouping into Asia for real-world accuracy. Georgia/Armenia/
 * Azerbaijan stay under Europe, matching the source file's own section.
 *
 * `COUNTRY_OVERRIDES` is a hand-curated set of 50+ countries spanning every
 * region with deliberately mixed enabled/disabled/draft/testing states,
 * multiple currencies, languages, and address formats — proving the
 * collection type's storage is genuinely sparse (an entity with no entry
 * here still renders in the table via `entityIds` + schema defaults, per
 * the P9.2 `getCollectionEntries` fix). Countries not listed take the
 * schema's plain defaults (enabled, USD/en/UTC placeholders) rather than a
 * second, parallel "default" data table — Rule 3, single source of truth.
 */
import { COUNTRIES } from '@/data/countries'

export type CountryRegion = 'North America' | 'South America' | 'Europe' | 'Middle East' | 'Asia' | 'Africa' | 'Oceania'

const NORTH_AMERICA = ['US', 'CA', 'MX', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'DO', 'PR', 'TT', 'JM', 'BB']
const SOUTH_AMERICA = ['BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY']
const MIDDLE_EAST = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'YE', 'IL', 'JO', 'LB', 'SY', 'IQ', 'IR', 'TR']
const ASIA_EXTRA = ['PK', 'AF']
const OCEANIA = ['AU', 'NZ', 'FJ', 'PG', 'WS', 'TO', 'VU', 'SB']

function regionFor(code: string): CountryRegion {
  if (NORTH_AMERICA.includes(code)) return 'North America'
  if (SOUTH_AMERICA.includes(code)) return 'South America'
  if (MIDDLE_EAST.includes(code)) return 'Middle East'
  if (OCEANIA.includes(code)) return 'Oceania'
  // Europe (44 codes incl. GE/AM/AZ) is everything between South America and
  // Middle East in the source file's own ordering — cheaper and less
  // error-prone to compute from file position than to re-list all 44 codes.
  const europeStart = COUNTRIES.findIndex((c) => c.code === 'GB')
  const middleEastStart = COUNTRIES.findIndex((c) => c.code === 'AE')
  const idx = COUNTRIES.findIndex((c) => c.code === code)
  if (idx >= europeStart && idx < middleEastStart) return 'Europe'
  if (ASIA_EXTRA.includes(code)) return 'Asia'
  const southAsiaStart = COUNTRIES.findIndex((c) => c.code === 'IN')
  const africaStart = COUNTRIES.findIndex((c) => c.code === 'NG')
  if (idx >= southAsiaStart && idx < africaStart) return 'Asia'
  return 'Africa'
}

export const CODE_TO_REGION: Record<string, CountryRegion> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, regionFor(c.code)]),
)

export const ALL_COUNTRY_CODES: string[] = COUNTRIES.map((c) => c.code)

export interface CountryOverride {
  enabled?: boolean
  visible?: boolean
  supported?: boolean
  phone_login_enabled?: boolean
  sms_enabled?: boolean
  registration_enabled?: boolean
  reservations_enabled?: boolean
  ordering_enabled?: boolean
  payments_enabled?: boolean
  delivery_enabled?: boolean
  pickup_enabled?: boolean
  currency?: string
  timezone?: string
  default_language?: string
  vat_supported?: boolean
  address_format?: string
  postal_code_validation?: boolean
  national_id_required?: boolean
  notes?: string
  status?: 'draft' | 'testing' | 'published' | 'deprecated' | 'archived'
}

/**
 * Hand-curated overrides for 58 countries — every region represented, with
 * a deliberate mix of disabled/draft/testing states, currencies, languages,
 * timezones, and address formats. Everything else in `ALL_COUNTRY_CODES`
 * renders with plain schema defaults (see the module file's `defaultFor`).
 */
export const COUNTRY_OVERRIDES: Record<string, CountryOverride> = {
  US: { currency: 'USD', timezone: 'America/New_York', default_language: 'en', vat_supported: false, address_format: 'street_city_state_zip', notes: 'Largest market; sales tax varies by state, not VAT.' },
  CA: { currency: 'CAD', timezone: 'America/Toronto', default_language: 'en', vat_supported: true, address_format: 'street_city_state_zip' },
  MX: { currency: 'MXN', timezone: 'America/Mexico_City', default_language: 'es', vat_supported: true, address_format: 'street_city_postal' },
  GT: { currency: 'GTQ', timezone: 'America/Guatemala', default_language: 'es', status: 'draft', notes: 'Onboarding in progress — draft configuration.' },
  CR: { currency: 'CRC', timezone: 'America/Costa_Rica', default_language: 'es' },
  PA: { currency: 'PAB', timezone: 'America/Panama', default_language: 'es', postal_code_validation: false, notes: 'No formal postal code system.' },
  CU: { enabled: false, visible: false, currency: 'CUP', timezone: 'America/Havana', default_language: 'es', payments_enabled: false, notes: 'Disabled — payment rail restrictions.' },
  DO: { currency: 'DOP', timezone: 'America/Santo_Domingo', default_language: 'es' },
  JM: { currency: 'JMD', timezone: 'Jamaica', default_language: 'en', postal_code_validation: false },
  TT: { currency: 'TTD', timezone: 'America/Port_of_Spain', default_language: 'en' },
  BB: { currency: 'BBD', timezone: 'America/Barbados', default_language: 'en' },

  BR: { currency: 'BRL', timezone: 'America/Sao_Paulo', default_language: 'pt', address_format: 'street_district_city_postal' },
  AR: { currency: 'ARS', timezone: 'America/Buenos_Aires', default_language: 'es' },
  CL: { currency: 'CLP', timezone: 'America/Santiago', default_language: 'es' },
  CO: { currency: 'COP', timezone: 'America/Bogota', default_language: 'es' },
  PE: { currency: 'PEN', timezone: 'America/Lima', default_language: 'es' },
  VE: { enabled: false, currency: 'VES', timezone: 'America/Caracas', default_language: 'es', payments_enabled: false, sms_enabled: false, notes: 'Disabled — unstable currency and gateway coverage.' },
  EC: { currency: 'USD', timezone: 'America/Guayaquil', default_language: 'es', notes: 'Officially dollarized since 2000.' },
  BO: { currency: 'BOB', timezone: 'America/La_Paz', default_language: 'es', status: 'draft' },
  UY: { currency: 'UYU', timezone: 'America/Montevideo', default_language: 'es' },

  GB: { currency: 'GBP', timezone: 'Europe/London', default_language: 'en', address_format: 'street_city_postal' },
  DE: { currency: 'EUR', timezone: 'Europe/Berlin', default_language: 'de', address_format: 'street_postal_city' },
  FR: { currency: 'EUR', timezone: 'Europe/Paris', default_language: 'fr', address_format: 'street_postal_city' },
  IT: { currency: 'EUR', timezone: 'Europe/Rome', default_language: 'it', address_format: 'street_postal_city' },
  ES: { currency: 'EUR', timezone: 'Europe/Madrid', default_language: 'es', address_format: 'street_postal_city' },
  PT: { currency: 'EUR', timezone: 'Europe/Lisbon', default_language: 'pt', address_format: 'street_postal_city' },
  NL: { currency: 'EUR', timezone: 'Europe/Amsterdam', default_language: 'nl', address_format: 'street_postal_city' },
  CH: { currency: 'CHF', timezone: 'Europe/Zurich', default_language: 'de', vat_supported: true },
  SE: { currency: 'SEK', timezone: 'Europe/Stockholm', default_language: 'sv' },
  NO: { currency: 'NOK', timezone: 'Europe/Oslo', default_language: 'no' },
  DK: { currency: 'DKK', timezone: 'Europe/Copenhagen', default_language: 'da' },
  PL: { currency: 'PLN', timezone: 'Europe/Warsaw', default_language: 'pl' },
  RO: { currency: 'RON', timezone: 'Europe/Bucharest', default_language: 'ro', status: 'testing', notes: 'Experimental rollout — evaluating demand.' },
  GR: { currency: 'EUR', timezone: 'Europe/Athens', default_language: 'el' },
  IE: { currency: 'EUR', timezone: 'Europe/Dublin', default_language: 'en' },
  RU: { enabled: false, currency: 'RUB', timezone: 'Europe/Moscow', default_language: 'ru', payments_enabled: false, notes: 'Disabled — payment network sanctions.' },
  UA: { currency: 'UAH', timezone: 'Europe/Kiev', default_language: 'uk', status: 'testing' },
  IS: { currency: 'ISK', timezone: 'Atlantic/Reykjavik', default_language: 'is', status: 'draft' },
  GE: { currency: 'GEL', timezone: 'Asia/Tbilisi', default_language: 'ka' },
  AM: { currency: 'AMD', timezone: 'Asia/Yerevan', default_language: 'hy' },
  AZ: { currency: 'AZN', timezone: 'Asia/Baku', default_language: 'az' },

  AE: { currency: 'AED', timezone: 'Asia/Dubai', default_language: 'ar', postal_code_validation: false, notes: 'No formal postal code system.' },
  SA: { currency: 'SAR', timezone: 'Asia/Riyadh', default_language: 'ar', postal_code_validation: false },
  QA: { currency: 'QAR', timezone: 'Asia/Qatar', default_language: 'ar', postal_code_validation: false },
  IL: { currency: 'ILS', timezone: 'Asia/Jerusalem', default_language: 'he' },
  TR: { currency: 'TRY', timezone: 'Europe/Istanbul', default_language: 'tr' },
  IR: { enabled: false, currency: 'IRR', timezone: 'Asia/Tehran', default_language: 'fa', payments_enabled: false, sms_enabled: false, notes: 'Disabled — payment rail restrictions.' },
  IQ: { currency: 'IQD', timezone: 'Asia/Baghdad', default_language: 'ar', status: 'draft' },
  YE: { enabled: false, currency: 'YER', timezone: 'Asia/Aden', default_language: 'ar', notes: 'Disabled pending regional stability review.' },

  PK: { currency: 'PKR', timezone: 'Asia/Karachi', default_language: 'ur' },
  AF: { enabled: false, currency: 'AFN', timezone: 'Asia/Kabul', default_language: 'ps', notes: 'Disabled — limited banking/payment coverage.' },
  IN: { currency: 'INR', timezone: 'Asia/Kolkata', default_language: 'hi', national_id_required: true, address_format: 'street_district_city_postal' },
  BD: { currency: 'BDT', timezone: 'Asia/Dhaka', default_language: 'bn' },
  TH: { currency: 'THB', timezone: 'Asia/Bangkok', default_language: 'th' },
  VN: { currency: 'VND', timezone: 'Asia/Ho_Chi_Minh', default_language: 'vi' },
  ID: { currency: 'IDR', timezone: 'Asia/Jakarta', default_language: 'id' },
  MY: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', default_language: 'ms' },
  SG: { currency: 'SGD', timezone: 'Asia/Singapore', default_language: 'en' },
  PH: { currency: 'PHP', timezone: 'Asia/Manila', default_language: 'en' },
  CN: { currency: 'CNY', timezone: 'Asia/Shanghai', default_language: 'zh', national_id_required: true, address_format: 'street_district_city_postal' },
  JP: { currency: 'JPY', timezone: 'Asia/Tokyo', default_language: 'ja', address_format: 'street_district_city_postal' },
  KR: { currency: 'KRW', timezone: 'Asia/Seoul', default_language: 'ko', national_id_required: true },
  HK: { currency: 'HKD', timezone: 'Asia/Hong_Kong', default_language: 'zh', postal_code_validation: false },
  KZ: { currency: 'KZT', timezone: 'Asia/Almaty', default_language: 'kk', status: 'draft' },
  MN: { currency: 'MNT', timezone: 'Asia/Ulaanbaatar', default_language: 'mn', status: 'draft' },
  KP: { enabled: false, visible: false, currency: 'KPW', timezone: 'Asia/Pyongyang', default_language: 'ko', notes: 'Disabled — no operational market presence.' },

  AU: { currency: 'AUD', timezone: 'Australia/Sydney', default_language: 'en', address_format: 'street_city_state_postal' },
  NZ: { currency: 'NZD', timezone: 'Pacific/Auckland', default_language: 'en', address_format: 'street_city_state_postal' },
  FJ: { currency: 'FJD', timezone: 'Pacific/Fiji', default_language: 'en', status: 'testing' },
  WS: { currency: 'WST', timezone: 'Pacific/Apia', default_language: 'en', status: 'draft' },
  PG: { currency: 'PGK', timezone: 'Pacific/Port_Moresby', default_language: 'en', postal_code_validation: false, status: 'draft' },

  NG: { currency: 'NGN', timezone: 'Africa/Lagos', default_language: 'en' },
  ZA: { currency: 'ZAR', timezone: 'Africa/Johannesburg', default_language: 'en' },
  EG: { currency: 'EGP', timezone: 'Africa/Cairo', default_language: 'ar' },
  KE: { currency: 'KES', timezone: 'Africa/Nairobi', default_language: 'en' },
  GH: { currency: 'GHS', timezone: 'Africa/Accra', default_language: 'en' },
  ET: { currency: 'ETB', timezone: 'Africa/Addis_Ababa', default_language: 'am', status: 'draft' },
  MA: { currency: 'MAD', timezone: 'Africa/Casablanca', default_language: 'ar' },
  TN: { currency: 'TND', timezone: 'Africa/Tunis', default_language: 'ar' },
  DZ: { currency: 'DZD', timezone: 'Africa/Algiers', default_language: 'ar' },
  LY: { enabled: false, currency: 'LYD', timezone: 'Africa/Tripoli', default_language: 'ar', postal_code_validation: false, notes: 'Disabled pending regional stability review.' },
  SD: { enabled: false, currency: 'SDG', timezone: 'Africa/Khartoum', default_language: 'ar', notes: 'Disabled pending regional stability review.' },
  SS: { enabled: false, visible: false, currency: 'SSP', timezone: 'Africa/Juba', default_language: 'en', notes: 'Disabled — no operational market presence.' },
  RW: { currency: 'RWF', timezone: 'Africa/Kigali', default_language: 'en', status: 'testing' },
  SO: { enabled: false, visible: false, currency: 'SOS', timezone: 'Africa/Mogadishu', default_language: 'so', postal_code_validation: false, notes: 'Disabled — no operational market presence.' },
}

