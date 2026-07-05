/**
 * Countries Module — P9.0 / Phase C+G, extended P9.2 Phase B/G/J
 *
 * `countries.enabled_codes` / `pinned_codes` / `default_code` answer
 * "which countries exist in pickers" and are unchanged from P9.0 — genuine
 * platform-wide list settings, not per-country configuration.
 *
 * `countries.registry` (new, P9.2) is the first real consumer of the
 * `'collection'` field type: one ~20-property schema applied to all 176
 * countries in src/data/countries.ts, instead of registering 176 x 20
 * individual fields (see docs/P9.2_COUNTRIES_AUDIT.md §2 for why that would
 * violate Rule 3 and the registry's duplicate-id safety check). Every
 * property below reuses an existing `uiControl` kind — no new Console
 * control was needed for Countries, per the phase's reuse mandate.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import { COUNTRIES, COUNTRY_ALIASES, getFlagEmoji } from '@/data/countries'
import { ALL_COUNTRY_CODES, CODE_TO_REGION, COUNTRY_OVERRIDES, type CountryRegion } from './countries-registry-data'
import type { ConfigModuleDefinition, ConfigFieldDefinition } from '../types'
import type { ConfigCollectionValue } from '../collection'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const REGIONS: CountryRegion[] = ['North America', 'South America', 'Europe', 'Middle East', 'Asia', 'Africa', 'Oceania']

const CURRENCY_OPTIONS = Array.from(
  new Set(Object.values(COUNTRY_OVERRIDES).map((o) => o.currency).filter((c): c is string => Boolean(c))),
)
  .sort()
  .map((code) => ({ value: code, label: code }))

const LANGUAGE_OPTIONS = Array.from(
  new Set(Object.values(COUNTRY_OVERRIDES).map((o) => o.default_language).filter((l): l is string => Boolean(l))),
)
  .sort()
  .map((code) => ({ value: code, label: code }))

const ADDRESS_FORMAT_OPTIONS = [
  { value: 'street_city_state_zip', label: 'Street, City, State, ZIP (US-style)' },
  { value: 'street_postal_city', label: 'Street, Postal Code, City (EU-style)' },
  { value: 'street_city_postal', label: 'Street, City, Postal Code' },
  { value: 'street_district_city_postal', label: 'Street, District, City, Postal Code' },
  { value: 'street_city_state_postal', label: 'Street, City, State, Postal Code (AU/NZ-style)' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'testing', label: 'Experimental' },
  { value: 'published', label: 'Published' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'archived', label: 'Archived' },
]

/** One property schema shared by every country entity — see ConfigCollectionMeta.schema. */
const COUNTRY_SCHEMA: ConfigFieldDefinition[] = [
  defineField({ id: 'enabled', title: 'Enabled', category: 'localization', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'visible', title: 'Visible in pickers', category: 'localization', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'supported', title: 'Fully Supported', description: 'Off marks a country as partially supported (limited feature coverage).', category: 'localization', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'phone_login_enabled', title: 'Phone Login', category: 'authentication', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'sms_enabled', title: 'SMS', category: 'authentication', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'registration_enabled', title: 'Registration', category: 'authentication', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'reservations_enabled', title: 'Reservations', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'ordering_enabled', title: 'Ordering', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'payments_enabled', title: 'Payments', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'delivery_enabled', title: 'Delivery', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'pickup_enabled', title: 'Pickup', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'currency', title: 'Currency', category: 'localization', type: 'select', default: 'USD', options: CURRENCY_OPTIONS, permissions: PERMISSIONS, uiControl: 'currency_picker' }),
  defineField({ id: 'timezone', title: 'Representative Timezone', category: 'localization', type: 'string', default: 'UTC', permissions: PERMISSIONS, uiControl: 'timezone_picker', preview: { kind: 'datetime' } }),
  defineField({ id: 'default_language', title: 'Default Language', category: 'localization', type: 'select', default: 'en', options: LANGUAGE_OPTIONS, permissions: PERMISSIONS, uiControl: 'language_selector' }),
  defineField({ id: 'default_phone_prefix', title: 'Phone Prefix', category: 'localization', type: 'string', default: '+1', permissions: PERMISSIONS, uiControl: 'text' }),
  defineField({ id: 'phone_example', title: 'Example Phone Number', description: 'National-format example shown in phone input placeholders.', category: 'localization', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'text', preview: { kind: 'formatted', format: (v) => `Formatted as dialed: ${String(v)}` } }),
  defineField({ id: 'vat_supported', title: 'VAT / Tax Support', category: 'commerce', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'address_format', title: 'Address Format', category: 'localization', type: 'select', default: 'street_city_postal', options: ADDRESS_FORMAT_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'postal_code_validation', title: 'Postal Code Validation', category: 'localization', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'national_id_required', title: 'National ID Required', description: 'Future-ready — not yet enforced at checkout/registration.', category: 'compliance', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  defineField({ id: 'region', title: 'Region', category: 'localization', type: 'select', default: 'Africa', options: REGIONS.map((r) => ({ value: r, label: r })), permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'status', title: 'Status', category: 'governance', type: 'select', default: 'published', options: STATUS_OPTIONS, permissions: PERMISSIONS, uiControl: 'radio' }),
  defineField({ id: 'notes', title: 'Notes', category: 'localization', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'textarea' }),
]

const COUNTRY_ALIASES_REVERSE: Record<string, string[]> = {}
for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
  COUNTRY_ALIASES_REVERSE[code] = [...(COUNTRY_ALIASES_REVERSE[code] ?? []), alias]
}

function findCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code)
}

/**
 * Seeds `region`, `default_phone_prefix`/`phone_example` (derived from
 * src/data/countries.ts — the single source of truth for dial codes/
 * placeholders, never re-typed here) plus whatever `COUNTRY_OVERRIDES`
 * curates for that code — the collection field's default value.
 */
const COUNTRIES_REGISTRY_DEFAULT: ConfigCollectionValue = Object.fromEntries(
  ALL_COUNTRY_CODES.map((code) => {
    const country = findCountry(code)
    return [code, {
      region: CODE_TO_REGION[code],
      default_phone_prefix: country?.dialCode ?? '+1',
      phone_example: country?.placeholder ?? '',
      ...COUNTRY_OVERRIDES[code],
    }]
  }),
)

export const COUNTRIES_MODULE: ConfigModuleDefinition = {
  id: 'countries',
  name: 'Countries',
  description: 'The set of countries available across signup, checkout, and localization pickers, plus per-country configuration.',
  category: 'localization',
  version: '1.1.0',
  icon: 'Globe2',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'countries.availability',
      title: 'Availability',
      fields: [
        defineField({
          id: 'countries.enabled_codes',
          title: 'Enabled Countries',
          description: 'ISO 3166-1 alpha-2 codes available platform-wide.',
          category: 'localization',
          type: 'multi-select',
          default: COUNTRIES.map((c) => c.code),
          options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'countries.pinned_codes',
          title: 'Pinned Countries',
          description: 'Codes pinned to the top of country pickers, in display order.',
          category: 'localization',
          type: 'array',
          default: ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'AE', 'TR', 'IR', 'AZ'],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'countries.default_code',
          title: 'Default Country',
          description: 'Country pre-selected when a tenant has no signal (IP/locale) to infer one.',
          category: 'localization',
          type: 'country',
          default: 'US',
          options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
          uiControl: 'country_selector',
          display: { icon: 'MapPin', exampleValue: 'US' },
          search: { keywords: ['default locale country', 'fallback country'] },
        }),
      ],
    },
    {
      id: 'countries.registry',
      title: 'Country Management',
      description: 'Per-country configuration — enablement, features, currency, locale, and governance status for all 176 countries.',
      fields: [
        defineField<ConfigCollectionValue>({
          id: 'countries.registry',
          title: 'Countries',
          description: 'Every supported country with its own configurable properties.',
          category: 'localization',
          type: 'collection',
          default: COUNTRIES_REGISTRY_DEFAULT,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
          display: { icon: 'Globe2' },
          collection: {
            entityLabel: 'Country',
            entityIdLabel: 'ISO Code',
            schema: COUNTRY_SCHEMA,
            entityIds: ALL_COUNTRY_CODES,
            defaultGroupBy: 'region',
            getEntityLabel: (code) => findCountry(code)?.name ?? code,
            getEntitySearchTerms: (code) => {
              const country = findCountry(code)
              const terms = COUNTRY_ALIASES_REVERSE[code] ?? []
              return country ? [country.dialCode, getFlagEmoji(code), ...terms] : terms
            },
            buildPreview: (values) => ({
              'Example Phone': `${values.default_phone_prefix ?? ''} ${values.phone_example ?? ''}`.trim(),
              Currency: String(values.currency ?? ''),
              Timezone: String(values.timezone ?? ''),
              'Address Format': String(values.address_format ?? ''),
              Language: String(values.default_language ?? ''),
            }),
          },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(COUNTRIES_MODULE)
