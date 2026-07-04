/**
 * Typography (Fonts) Module — P9.0 / Phase C+G
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Vazirmatn', label: 'Vazirmatn (Persian/Arabic)' },
]

export const TYPOGRAPHY_MODULE: ConfigModuleDefinition = {
  id: 'typography',
  name: 'Typography',
  description: 'Platform default font stack and per-tenant font overrides.',
  category: 'branding',
  version: '1.0.0',
  icon: 'Type',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'typography.fonts',
      title: 'Fonts',
      fields: [
        defineField({
          id: 'typography.body_font',
          title: 'Body Font',
          description: 'Default font-family for body text, overridable per tenant.',
          category: 'branding',
          type: 'font',
          default: 'Inter',
          options: FONT_OPTIONS,
          permissions: PERMISSIONS,
          preview: { kind: 'font-sample' },
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'typography.heading_font',
          title: 'Heading Font',
          description: 'Default font-family for headings, overridable per tenant.',
          category: 'branding',
          type: 'font',
          default: 'Poppins',
          options: FONT_OPTIONS,
          permissions: PERMISSIONS,
          preview: { kind: 'font-sample' },
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'typography.rtl_font',
          title: 'RTL Font',
          description: 'Font-family used when the active locale renders right-to-left.',
          category: 'branding',
          type: 'font',
          default: 'Vazirmatn',
          options: FONT_OPTIONS,
          permissions: PERMISSIONS,
          preview: { kind: 'font-sample' },
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'typography.base_size_px',
          title: 'Base Font Size (px)',
          category: 'branding',
          type: 'number',
          default: 16,
          validation: { min: 12, max: 20 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(TYPOGRAPHY_MODULE)
