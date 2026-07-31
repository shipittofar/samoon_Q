import type { Extra, ExtraGroup } from '@/types'
import type { Review } from '@/types'
import type { RatingBreakdownData } from '@/types/business-review'

export function buildRatingBreakdownFromReviews(reviews: Review[]): RatingBreakdownData {
  const total = reviews.length
  const average = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length
    return {
      star,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })
  return { average, total, distribution }
}

export function getAssignedExtraGroups(
  groups: ExtraGroup[] | undefined,
  groupIds: string[] | undefined,
): ExtraGroup[] {
  if (!groups?.length || !groupIds?.length) return []
  const idSet = new Set(groupIds)
  return groups.filter((g) => idSet.has(g.id) && g.is_active).sort((a, b) => a.order - b.order)
}

export function getExtrasForGroup(extras: Extra[], groupId: string): Extra[] {
  return extras
    .filter((e) => e.group_id === groupId && e.available !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function getUngroupedExtras(itemExtras: Extra[] | undefined, branchExtras: Extra[]): Extra[] {
  const groupedIds = new Set(branchExtras.map((e) => e.id))
  const legacy = (itemExtras ?? []).filter((e) => !e.group_id && !groupedIds.has(e.id))
  return legacy
}

export interface ExtraGroupValidation {
  valid: boolean
  message?: string
}

const NUTRITION_UNITS: Record<string, string> = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sodium: 'mg',
  sugar: 'g',
}

export function formatNutritionValue(key: string, value: number | string): string {
  const unit = NUTRITION_UNITS[key.toLowerCase()]
  if (unit) return `${value}${unit}`
  return String(value)
}

export function validateExtraSelections(
  groups: ExtraGroup[],
  selected: Extra[],
): ExtraGroupValidation {
  for (const group of groups) {
    const selectedInGroup = selected.filter((e) => e.group_id === group.id)
    const count = selectedInGroup.length

    if (group.required && count < Math.max(1, group.min_selection)) {
      return { valid: false, message: group.name }
    }
    if (count < group.min_selection) {
      return { valid: false, message: group.name }
    }
    if (group.max_selection > 0 && count > group.max_selection) {
      return { valid: false, message: group.name }
    }
    if (group.selection_type === 'single' && count > 1) {
      return { valid: false, message: group.name }
    }
  }
  return { valid: true }
}
