'use client'

import { ChipRail } from './ChipRail'
import { FilterChip } from './FilterChip'

export interface ActiveFilter {
  id: string
  label: string
}

interface ActiveFilterRowProps {
  filters: ActiveFilter[]
  onRemove: (id: string) => void
  ariaLabel: string
  removeLabel: (label: string) => string
}

export function ActiveFilterRow({ filters, onRemove, ariaLabel, removeLabel }: ActiveFilterRowProps) {
  if (filters.length === 0) return null

  return (
    <ChipRail aria-label={ariaLabel}>
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          selected
          onClick={() => onRemove(filter.id)}
          aria-label={removeLabel(filter.label)}
          className="snap-start"
        >
          {filter.label}
          <span aria-hidden="true" className="ms-0.5">×</span>
        </FilterChip>
      ))}
    </ChipRail>
  )
}
