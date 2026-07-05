/**
 * Languages Module — P9.0 / Phase C+G
 * Replaces the hardcoded SUPPORTED_LOCALES / RTL_LOCALES / DEFAULT_LOCALE
 * constants in src/constants/index.ts with configuration-driven equivalents.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'فارسی (Persian)' },
  { value: 'ar', label: 'العربية (Arabic)' },
]

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
          default: ['en', 'fa', 'ar'],
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
          default: ['fa', 'ar'],
          options: LANGUAGE_OPTIONS,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(LANGUAGES_MODULE)
