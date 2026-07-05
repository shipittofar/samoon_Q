/**
 * Feature Flags Module — P9.0 / Phase C+G
 *
 * This module governs *platform-wide* flags (rollout switches for platform
 * capabilities). It is a distinct concern from the per-tenant capability flags
 * already produced by src/modules/registry.ts + featureFlagsService — those
 * remain business-type-driven. This module is where a Platform Administrator
 * enables/disables whole platform capabilities (e.g. AI, Website Builder)
 * before any tenant can toggle their own instance of it.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'featureflags.manage' }

export const FEATURE_FLAGS_MODULE: ConfigModuleDefinition = {
  id: 'feature_flags',
  name: 'Feature Flags',
  description: 'Platform-level rollout switches gating entire capabilities before tenants can enable them.',
  category: 'platform',
  group: 'Configuration',
  version: '1.0.0',
  icon: 'Flag',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'feature_flags.platform',
      title: 'Platform Capabilities',
      fields: [
        defineField({
          id: 'feature_flags.website_builder',
          title: 'Website Builder',
          category: 'platform',
          type: 'feature_flag',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'feature_flags.ai_assistant',
          title: 'AI Assistant',
          description: 'Master switch for AI-powered features (menu copy, review replies, insights).',
          category: 'platform',
          type: 'feature_flag',
          default: false,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
        defineField({
          id: 'feature_flags.billing_self_serve',
          title: 'Self-Serve Billing',
          category: 'platform',
          type: 'feature_flag',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' },
        }),
        defineField({
          id: 'feature_flags.rbac_custom_roles',
          title: 'Custom RBAC Roles',
          category: 'platform',
          type: 'feature_flag',
          default: true,
          permissions: PERMISSIONS,
          inheritance: { level: 'platform', canOverride: true, mode: 'override', fallback: 'inherit' },
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(FEATURE_FLAGS_MODULE)
