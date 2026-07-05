/**
 * registerAdminModule — P9.4 Phase C (Framework Improvement)
 *
 * Thin convenience wrapper around `defineField()`/
 * `platformConfigurationRegistry.register()` (both unchanged, P9.0) so the
 * ~50 Platform Administration modules registered in this phase can be
 * declared as compact data rather than repeating the same
 * permissions/version/section boilerplate fifty times. Every module it
 * produces is a completely ordinary `ConfigModuleDefinition` — nothing
 * about how it resolves, renders, or audits is special-cased; it flows
 * through the exact same registry/service/Studio as Authentication or
 * Countries.
 */
import { platformConfigurationRegistry } from '@/config/registry'
import type { ConfigFieldDefinition, ConfigModuleDefinition, ConfigLifecycleState } from '@/config/types'
import type { PlatformAdminGroup } from './nav-groups'

const DEFAULT_PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

export interface RegisterAdminModuleInput {
  id: string
  name: string
  description: string
  group: PlatformAdminGroup
  icon?: string
  platformPermission?: string
  lifecycle?: ConfigLifecycleState
  fields: ConfigFieldDefinition[]
}

export function registerAdminModule(input: RegisterAdminModuleInput): ConfigModuleDefinition {
  // Field ids must be globally unique across the whole registry (Rule 3 —
  // enforced by PlatformConfigurationRegistry.register()), not just within
  // one module — so a short id like 'primary_provider' or 'enabled' is
  // namespaced under this module's id here, the same convention every
  // P9.0–P9.2 module file already follows by hand (e.g.
  // 'authentication.otp.enabled').
  const fields = input.fields.map((field) =>
    field.id.startsWith(`${input.id}.`) ? field : { ...field, id: `${input.id}.${field.id}` },
  )

  const mod: ConfigModuleDefinition = {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.group,
    group: input.group,
    version: '1.0.0',
    icon: input.icon,
    permissions: DEFAULT_PERMISSIONS,
    platformPermission: input.platformPermission,
    lifecycle: input.lifecycle,
    sections: [
      {
        id: `${input.id}.general`,
        title: 'General',
        fields,
      },
    ],
  }
  platformConfigurationRegistry.register(mod)
  return mod
}
