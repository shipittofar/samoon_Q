/**
 * Languages Module — P9.0 / Phase C+G, extended P9.5.1A Phase C
 * Replaces the hardcoded SUPPORTED_LOCALES / RTL_LOCALES / DEFAULT_LOCALE
 * constants in src/constants/index.ts with configuration-driven equivalents.
 *
 * P9.5.1A: the option list and defaults are now sourced from
 * `src/i18n/language-registry.ts` (the single per-language metadata table)
 * instead of a duplicated literal array, so registering a 7th language only
 * requires touching the registry, not this module too.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'
import { LANGUAGE_REGISTRY, ALL_LANGUAGE_CODES } from '../../i18n/language-registry'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const LANGUAGE_OPTIONS = LANGUAGE_REGISTRY.map((l) => ({
  value: l.code,
  label: l.code === 'en' ? l.englishName : `${l.nativeName} (${l.englishName})`,
}))

const RTL_DEFAULTS = LANGUAGE_REGISTRY.filter((l) => l.direction === 'rtl').map((l) => l.code)

export const LANGUAGES_MODULE: ConfigModuleDefinition = {
  id: 'languages',
  name: 'Languages',
  description: 'Supported locales, default locale, and RTL rendering rules.',
  category: 'localization',
  group: 'Configuration',
  version: '1.0.0',
  icon: 'Languages',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'languages.locales',
      title: 'Locales',
      fields: [
        defineField({
          id: 'languages.supported',
          title: 'Supported Locales',
          description: 'Locales available in the language switcher.',
          category: 'localization',
          type: 'multi-select',
          default: ALL_LANGUAGE_CODES,
          options: LANGUAGE_OPTIONS,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'languages.default',
          title: 'Default Locale',
          description: 'Locale used when no user preference or tenant override is present.',
          category: 'localization',
          type: 'language',
          default: 'en',
          options: LANGUAGE_OPTIONS,
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
          uiControl: 'language_selector',
          display: { icon: 'Languages' },
        }),
        defineField({
          id: 'languages.rtl_locales',
          title: 'RTL Locales',
          description: 'Locales rendered right-to-left.',
          category: 'localization',
          type: 'multi-select',
          default: RTL_DEFAULTS,
          options: LANGUAGE_OPTIONS,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(LANGUAGES_MODULE)
