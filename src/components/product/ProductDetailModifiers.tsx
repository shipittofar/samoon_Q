'use client'

import { useMemo } from 'react'
import { SelectableOptionRow } from '@/components/ui/SelectableOptionRow'
import {
  getAssignedExtraGroups,
  getExtrasForGroup,
  getUngroupedExtras,
  validateExtraSelections,
} from '@/lib/product-detail-utils'
import type { Extra, ExtraGroup, MenuItem } from '@/types'

interface ProductDetailModifiersProps {
  item: MenuItem
  groups: ExtraGroup[] | undefined
  branchExtras: Extra[] | undefined
  selectedExtras: Extra[]
  onToggleExtra: (extra: Extra, group?: ExtraGroup) => void
  addExtrasLabel: string
  requiredLabel: string
  chooseUpToLabel: (name: string, max: number) => string
  validationError?: string | null
}

export function ProductDetailModifiers({
  item,
  groups,
  branchExtras,
  selectedExtras,
  onToggleExtra,
  addExtrasLabel,
  requiredLabel,
  chooseUpToLabel,
  validationError,
}: ProductDetailModifiersProps) {
  const assignedGroups = useMemo(
    () => getAssignedExtraGroups(groups, item.extra_group_ids),
    [groups, item.extra_group_ids],
  )

  const allBranchExtras = branchExtras ?? []
  const ungrouped = useMemo(
    () => getUngroupedExtras(item.extras, allBranchExtras),
    [item.extras, allBranchExtras],
  )

  const hasContent = assignedGroups.length > 0 || ungrouped.length > 0 || (item.extras?.length ?? 0) > 0
  if (!hasContent) return null

  return (
    <div className="space-y-6">
      {assignedGroups.map((group) => {
        const groupExtras = getExtrasForGroup(allBranchExtras, group.id)
        if (groupExtras.length === 0) return null

        return (
          <section key={group.id} aria-labelledby={`extra-group-${group.id}`}>
            <div className="mb-3">
              <h2 id={`extra-group-${group.id}`} className="text-base font-semibold text-[var(--fg)]">
                {group.name}
                {group.required && (
                  <span className="ms-1.5 text-xs font-medium text-[var(--accent)]">({requiredLabel})</span>
                )}
              </h2>
              {group.description && (
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">{group.description}</p>
              )}
              {group.max_selection > 0 && group.selection_type === 'multiple' && (
                <p className="text-xs text-[var(--fg-subtle)] mt-0.5">
                  {chooseUpToLabel(group.name, group.max_selection)}
                </p>
              )}
            </div>
            <div className="space-y-2"role={group.selection_type === 'single' ? 'radiogroup' : undefined}>
              {groupExtras.map((extra) => {
                const selected = selectedExtras.some((e) => e.id === extra.id)
                return (
                  <SelectableOptionRow
                    key={extra.id}
                    name={extra.name}
                    price={extra.price}
                    currency={item.currency}
                    selected={selected}
                    disabled={!extra.available}
                    selectionType={group.selection_type}
                    onClick={() => onToggleExtra(extra, group)}
                  />
                )
              })}
            </div>
          </section>
        )
      })}

      {ungrouped.length > 0 && (
        <section aria-labelledby="legacy-extras-heading">
          <h2 id="legacy-extras-heading"className="text-base font-semibold text-[var(--fg)] mb-3">
            {addExtrasLabel}
          </h2>
          <div className="space-y-2">
            {ungrouped.map((extra) => {
              const selected = selectedExtras.some((e) => e.id === extra.id)
              return (
                <SelectableOptionRow
                  key={extra.id}
                  name={extra.name}
                  price={extra.price}
                  currency={item.currency}
                  selected={selected}
                  disabled={!extra.available}
                  onClick={() => onToggleExtra(extra)}
                />
              )
            })}
          </div>
        </section>
      )}

      {validationError && (
        <p className="text-sm text-[var(--danger-text)]"role="alert">
          {validationError}
        </p>
      )}
    </div>
  )
}

export { validateExtraSelections }
