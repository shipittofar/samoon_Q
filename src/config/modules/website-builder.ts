/**
 * Website Builder Module — P9.0 / Phase C+G
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const WEBSITE_BUILDER_MODULE: ConfigModuleDefinition = {
  id: 'website_builder',
  name: 'Website Builder',
  description: 'Default block library, publishing rules, and section limits for the tenant website builder.',
  category: 'content',
  version: '1.0.0',
  icon: 'LayoutTemplate',
  permissions: PERMISSIONS,
  featureFlag: 'feature_flags.website_builder',
  dependencies: [{ moduleId: 'themes', reason: 'Builder sections render using the resolved tenant theme.' }],
  sections: [
    {
      id: 'website_builder.defaults',
      title: 'Defaults',
      fields: [
        defineField({
          id: 'website_builder.enabled_blocks',
          title: 'Enabled Blocks',
          category: 'content',
          type: 'multi-select',
          default: ['hero', 'menu_preview', 'gallery', 'testimonials', 'hours', 'map', 'cta'],
          options: [
            { value: 'hero', label: 'Hero' },
            { value: 'menu_preview', label: 'Menu Preview' },
            { value: 'gallery', label: 'Gallery' },
            { value: 'testimonials', label: 'Testimonials' },
            { value: 'hours', label: 'Hours' },
            { value: 'map', label: 'Map' },
            { value: 'cta', label: 'Call to Action' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'website_builder.max_sections',
          title: 'Max Sections Per Page',
          category: 'content',
          type: 'number',
          default: 12,
          validation: { min: 1, max: 40 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'website_builder.custom_domain_enabled',
          title: 'Custom Domain Enabled',
          category: 'content',
          type: 'feature_flag',
          default: false,
          permissions: PERMISSIONS,
          inheritance: { level: 'tenant', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(WEBSITE_BUILDER_MODULE)
