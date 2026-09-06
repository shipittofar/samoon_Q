/**
 * Platform Homepage CMS — public marketplace `/` hero.
 *
 * Registered from the `@/config` barrel at import time (same wave as
 * Authentication / Countries) so the first `getField()`/`getModules()` seal
 * (root layout → i18n/runtime) cannot run before this id exists.
 *
 * Ownership is Platform Super Admin only (`platform.homepage.manage`).
 * This module is Studio metadata; hero payloads live in the isolated
 * platform homepage store / `/api/platform/homepage/hero/` API — never
 * tenant Website Builder.
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export const PLATFORM_HOMEPAGE_MODULE: ConfigModuleDefinition = {
  id: 'platform.homepage',
  name: 'Platform Homepage',
  description:
    'Public marketplace homepage (/) hero background gallery. Platform Super Admin only — not tenant Website Builder.',
  category: 'Platform',
  group: 'Platform',
  version: '1.0.0',
  icon: 'Image',
  permissions: PERMISSIONS,
  platformPermission: 'platform.homepage.manage',
  sections: [
    {
      id: 'platform.homepage.general',
      title: 'General',
      fields: [
        defineField({
          id: 'platform.homepage.cms',
          title: 'Hero CMS',
          category: 'platform',
          type: 'string',
          default: 'gallery',
          permissions: PERMISSIONS,
          uiControl: 'text',
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(PLATFORM_HOMEPAGE_MODULE)
