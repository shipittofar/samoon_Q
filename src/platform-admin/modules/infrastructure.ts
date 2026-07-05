/**
 * Platform Administration — Infrastructure group — P9.4 Phase C
 *
 * `storage` (P9.0) already lives in this IA group via its own
 * `group: 'Infrastructure'` tag. This file adds Media, CDN, Cache,
 * Backups, Restore, Database, and Search.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.media',
  name: 'Media',
  description: 'Uploaded media limits and processing.',
  group: 'Infrastructure',
  icon: 'Image',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'max_upload_size_mb', title: 'Max Upload Size (MB)', category: 'infrastructure', type: 'number', default: 25, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1, max: 500 } }),
    defineField({ id: 'auto_generate_thumbnails', title: 'Auto-Generate Thumbnails', category: 'infrastructure', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.cdn',
  name: 'CDN',
  description: 'CDN edge caching and purge policy.',
  group: 'Infrastructure',
  icon: 'Globe',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'default_cache_ttl_seconds', title: 'Default Cache TTL (seconds)', category: 'infrastructure', type: 'number', default: 3600, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0 } }),
    defineField({ id: 'auto_purge_on_deploy', title: 'Auto-Purge on Deploy', category: 'infrastructure', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.cache',
  name: 'Cache',
  description: 'Application-level cache configuration.',
  group: 'Infrastructure',
  icon: 'Zap',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'cache_provider', title: 'Cache Provider', category: 'infrastructure', type: 'select', default: 'in_memory', options: [
      { value: 'in_memory', label: 'In-Memory' },
      { value: 'redis', label: 'Redis' },
      { value: 'memcached', label: 'Memcached' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'default_ttl_seconds', title: 'Default TTL (seconds)', category: 'infrastructure', type: 'number', default: 300, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0 } }),
  ],
})

registerAdminModule({
  id: 'platform.backups',
  name: 'Backups',
  description: 'Automated backup schedule and retention.',
  group: 'Infrastructure',
  icon: 'DatabaseBackup',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'backup_frequency', title: 'Backup Frequency', category: 'infrastructure', type: 'select', default: 'daily', options: [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'backup_retention_days', title: 'Backup Retention (days)', category: 'infrastructure', type: 'number', default: 30, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.restore',
  name: 'Restore',
  description: 'Restore-from-backup safeguards.',
  group: 'Infrastructure',
  icon: 'RotateCcw',
  platformPermission: 'platform.infrastructure.manage',
  fields: [
    defineField({ id: 'require_dual_approval', title: 'Require Dual Approval for Restore', category: 'infrastructure', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch', governance: { dangerous: true, requiresApproval: true } }),
  ],
})

registerAdminModule({
  id: 'platform.database',
  name: 'Database',
  description: 'Database connection pool and query safety limits.',
  group: 'Infrastructure',
  icon: 'Database',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'max_connections', title: 'Max Connection Pool Size', category: 'infrastructure', type: 'number', default: 50, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'slow_query_threshold_ms', title: 'Slow Query Threshold (ms)', category: 'infrastructure', type: 'number', default: 1000, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 10 } }),
  ],
})

registerAdminModule({
  id: 'platform.search_infra',
  name: 'Search',
  description: 'Platform search index configuration (distinct from the Studio command palette, P9.3).',
  group: 'Infrastructure',
  icon: 'Search',
  platformPermission: 'platform.infrastructure.view',
  fields: [
    defineField({ id: 'reindex_frequency_hours', title: 'Reindex Frequency (hours)', category: 'infrastructure', type: 'number', default: 24, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'fuzzy_matching_enabled', title: 'Fuzzy Matching Enabled', category: 'infrastructure', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
