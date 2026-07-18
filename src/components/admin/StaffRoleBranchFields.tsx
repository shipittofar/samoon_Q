'use client'

/**
 * Console Staff — shared roles + branches fields, used by both the Invite
 * Staff modal (staff/page.tsx) and the Edit Roles & Branches modal
 * (staff/[id]/page.tsx). Consumes ROLE_TEMPLATES/getPermissionsForRole
 * from permission.service.ts and useAdminBranches() unchanged — no new
 * permission or branch-access logic is introduced here.
 *
 * Multiple roles union permissions and multiple branches union visibility
 * exactly as getPermissionsForRole()/resolveBranchAccess() already do —
 * this component only collects the role/branch selection, it does not
 * recompute what they grant.
 */

import { useTranslations } from 'next-intl'
import { ROLE_TEMPLATES } from '@/services/permission.service'
import { useAdminBranches } from '@/hooks'
import type { Role } from '@/types/rbac'

/** Roles that hold tenant-wide access by design (see ROLE_PERMISSION_MAP /
 * resolveBranchAccess()'s owner exception) — a branch selection is not
 * required when every selected role is one of these. */
const TENANT_WIDE_ROLES: readonly Role[] = ['owner', 'admin']

export function requiresBranchSelection(roles: Role[]): boolean {
  return roles.some((r) => !TENANT_WIDE_ROLES.includes(r))
}

export interface StaffRoleBranchFieldsProps {
  tenantId: string
  selectedRoles: Role[]
  selectedBranchIds: string[]
  onChangeRoles: (roles: Role[]) => void
  onChangeBranchIds: (branchIds: string[]) => void
  roleError?: string
  branchError?: string
}

export function StaffRoleBranchFields({
  tenantId,
  selectedRoles,
  selectedBranchIds,
  onChangeRoles,
  onChangeBranchIds,
  roleError,
  branchError,
}: StaffRoleBranchFieldsProps) {
  const t = useTranslations('console')
  const { data: branches = [], isLoading: branchesLoading } = useAdminBranches(tenantId)

  function toggleRole(role: Role) {
    onChangeRoles(
      selectedRoles.includes(role)
        ? selectedRoles.filter((r) => r !== role)
        : [...selectedRoles, role],
    )
  }

  function toggleBranch(branchId: string) {
    onChangeBranchIds(
      selectedBranchIds.includes(branchId)
        ? selectedBranchIds.filter((id) => id !== branchId)
        : [...selectedBranchIds, branchId],
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('rolesLabel')}</label>
        <p className="text-xs text-gray-500 mb-2">{t('selectRolesHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_TEMPLATES.map((rt) => (
            <label
              key={rt.role}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(rt.role)}
                onChange={() => toggleRole(rt.role)}
              />
              {rt.label}
            </label>
          ))}
        </div>
        {roleError && <p className="mt-1.5 text-xs text-red-600">{roleError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t('branchesLabel')}</label>
        <p className="text-xs text-gray-500 mb-2">{t('selectBranchesHint')}</p>
        {branchesLoading ? (
          <p className="text-sm text-gray-500">{t('loadingBranchEllipsis')}</p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noBranchesConfigured')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {branches.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedBranchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                {b.name}
              </label>
            ))}
          </div>
        )}
        {branchError && <p className="mt-1.5 text-xs text-red-600">{branchError}</p>}
      </div>
    </div>
  )
}
