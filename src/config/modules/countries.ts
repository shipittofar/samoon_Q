/**
 * Countries Module — P9.0 / Phase C+G
 * Registers the platform's supported-country list and country-level defaults
 * (currency, dial code) as configuration instead of the previously-hardcoded
 * PINNED_COUNTRY_CODES export in src/data/countries.ts.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import { COUNTRIES } from '@/data/countries'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const COUNTRIES_MODULE: ConfigModuleDefinition = {
  id: 'countries',
  name: 'Countries',
  description: 'The set of countries available across signup, checkout, and localization pickers.',
  category: 'localization',
  version: '1.0.0',
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
  ],
}

platformConfigurationRegistry.register(COUNTRIES_MODULE)
