/**
 * Storage Module — P9.0 / Phase C+G
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const STORAGE_MODULE: ConfigModuleDefinition = {
  id: 'storage',
  name: 'Storage',
  description: 'Media storage provider, upload limits, and CDN behavior.',
  category: 'infrastructure',
  group: 'Infrastructure',
  version: '1.0.0',
  icon: 'HardDrive',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'storage.provider',
      title: 'Provider',
      fields: [
        defineField({
          id: 'storage.provider',
          title: 'Storage Provider',
          category: 'infrastructure',
          type: 'select',
          default: 's3',
          options: [
            { value: 's3', label: 'Amazon S3' },
            { value: 'gcs', label: 'Google Cloud Storage' },
            { value: 'local', label: 'Local Disk (dev only)' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'storage.max_upload_mb',
          title: 'Max Upload Size (MB)',
          category: 'infrastructure',
          type: 'number',
          default: 10,
          validation: { min: 1, max: 100 },
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'storage.allowed_mime_types',
          title: 'Allowed File Types',
          category: 'infrastructure',
          type: 'multi-select',
          default: ['image/png', 'image/jpeg', 'image/webp'],
          options: [
            { value: 'image/png', label: 'PNG' },
            { value: 'image/jpeg', label: 'JPEG' },
            { value: 'image/webp', label: 'WebP' },
            { value: 'application/pdf', label: 'PDF' },
          ],
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'storage.cdn_base_url',
          title: 'CDN Base URL',
          category: 'infrastructure',
          type: 'string',
          default: 'https://cdn.savor.app',
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(STORAGE_MODULE)
