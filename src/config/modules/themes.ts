/**
 * Themes Module — P9.0 / Phase C+G
 * Supersedes the ad-hoc TenantTheme shape (src/types/index.ts) as the
 * authoritative, schema-validated source for tenant visual overrides.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const THEMES_MODULE: ConfigModuleDefinition = {
  id: 'themes',
  name: 'Themes',
  description: 'Default brand palette and the CSS variables tenants are permitted to override.',
  category: 'branding',
  version: '1.0.0',
  icon: 'Palette',
  permissions: PERMISSIONS,
  dependencies: [{ moduleId: 'typography', reason: 'Theme preview renders using the configured font stack.' }],
  sections: [
    {
      id: 'themes.palette',
      title: 'Palette',
      fields: [
        defineField({
          id: 'themes.default_mode',
          title: 'Default Color Mode',
          category: 'branding',
          type: 'select',
          default: 'light',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'Follow System' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'themes.primary_color',
          title: 'Primary Color',
          description: 'Overrides --accent. Tenants may customize; branches inherit the tenant value.',
          category: 'branding',
          type: 'color',
          default: '#f97316',
          permissions: PERMISSIONS,
          preview: { kind: 'swatch' },
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'themes.accent_hover_color',
          title: 'Accent Hover Color',
          description: 'Overrides --accent-hover. Defaults to a darker shade of the primary color.',
          category: 'branding',
          type: 'color',
          default: '#ea580c',
          permissions: PERMISSIONS,
          preview: { kind: 'swatch' },
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'themes.logo_url',
          title: 'Logo URL',
          category: 'branding',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          preview: { kind: 'image' },
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(THEMES_MODULE)
