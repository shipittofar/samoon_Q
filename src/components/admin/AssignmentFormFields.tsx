'use client'

import { useTranslations } from 'next-intl'
import { useAdminBranches, useTenantRoles } from '@/hooks'
import type { AssignmentMode } from '@/types/rbac-api'

export interface AssignmentFormState {
  roleId: string
  locationIds: string[]
  allLocations: boolean
  mode: AssignmentMode
  validFrom: string
  validUntil: string
}

export const emptyAssignmentForm = (): AssignmentFormState => ({
  roleId: '',
  locationIds: [],
  allLocations: false,
  mode: 'manage',
  validFrom: '',
  validUntil: '',
})

export function requiresAssignmentLocations(allLocations: boolean, locationIds: string[]): boolean {
  if (allLocations) return false
  return locationIds.length === 0
}

export interface AssignmentFormFieldsProps {
  tenantId: string
  form: AssignmentFormState
  onChange: (form: AssignmentFormState) => void
  showRoleSelect?: boolean
  roleError?: string
  locationsError?: string
}

export function AssignmentFormFields({
  tenantId,
  form,
  onChange,
  showRoleSelect = true,
  roleError,
  locationsError,
}: AssignmentFormFieldsProps) {
  const t = useTranslations('console')
  const { data: roleCatalog = [], isLoading: rolesLoading } = useTenantRoles(tenantId)
  const { data: branches = [], isLoading: branchesLoading } = useAdminBranches(tenantId)

  function toggleLocation(id: string) {
    onChange({
      ...form,
      locationIds: form.locationIds.includes(id)
        ? form.locationIds.filter((x) => x !== id)
        : [...form.locationIds, id],
    })
  }

  return (
    <div className="space-y-4">
      {showRoleSelect && (
        <div>
          <label htmlFor="assignment-role-select" className="block text-sm font-medium mb-1">
            {t('rolesLabel')}
          </label>
          {rolesLoading ? (
            <p className="text-sm text-gray-500">{t('loadingStaffEllipsis')}</p>
          ) : (
            <select
              id="assignment-role-select"
              value={form.roleId}
              onChange={(e) => onChange({ ...form, roleId: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">{t('selectRolePlaceholder')}</option>
              {roleCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          {roleError && <p className="text-xs text-red-600 mt-1">{roleError}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">{t('locationAssignmentLabel')}</label>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={form.allLocations}
            onChange={(e) => onChange({ ...form, allLocations: e.target.checked })}
          />
          {t('allLocationsTenantWideLabel')}
        </label>
        {!form.allLocations && (
          <>
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
                      checked={form.locationIds.includes(b.id)}
                      onChange={() => toggleLocation(b.id)}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {locationsError && <p className="text-xs text-red-600 mt-1">{locationsError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('assignmentModeLabel')}</label>
          <select
            value={form.mode}
            onChange={(e) => onChange({ ...form, mode: e.target.value as AssignmentMode })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="manage">{t('assignmentModeManage')}</option>
            <option value="read">{t('assignmentModeRead')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('validFromLabel')}</label>
          <input
            type="datetime-local"
            value={form.validFrom}
            onChange={(e) => onChange({ ...form, validFrom: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('validUntilLabel')}</label>
          <input
            type="datetime-local"
            value={form.validUntil}
            onChange={(e) => onChange({ ...form, validUntil: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
