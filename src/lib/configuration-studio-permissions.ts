import type { User } from '@/types'
import type { ConfigFieldDefinition } from '@/config'
import { configurationService } from '@/config'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'

/**
 * Configuration Studio permission context.
 * Default is tenant Console RBAC. Platform Admin must pass `'platform'`
 * explicitly — never inferred from the pathname.
 */
export type ConfigurationPermissionContext = 'tenant' | 'platform'

export function canViewStudioField(
  field: ConfigFieldDefinition,
  permissionContext: ConfigurationPermissionContext,
  tenantPermissions: readonly string[],
  user: User | null | undefined,
): boolean {
  if (permissionContext === 'platform') {
    return isPlatformSuperuser(user)
  }
  return configurationService.canView(field, tenantPermissions)
}

export function canEditStudioField(
  field: ConfigFieldDefinition,
  permissionContext: ConfigurationPermissionContext,
  tenantPermissions: readonly string[],
  user: User | null | undefined,
): boolean {
  if (permissionContext === 'platform') {
    return isPlatformSuperuser(user)
  }
  // Platform-wide fields are changed by platform superusers only (the API
  // refuses anyone else); in a business's console they are read-only for
  // its owner and settings managers, who edit the business-level fields.
  if (field.inheritance?.level === 'platform' && !isPlatformSuperuser(user)) return false
  return configurationService.canEdit(field, tenantPermissions)
}
