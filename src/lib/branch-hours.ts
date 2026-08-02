import type { BranchBusinessHours } from '@/types/branch'
import type { WorkingHours } from '@/types'

const WEEKDAYS: BranchBusinessHours['day'][] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export interface BranchHoursStatus {
  openNow: boolean
  todayHours?: string
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes = '0'] = time.split(':')
  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10)
}

function isOpenAtMinutes(
  openMinutes: number,
  closeMinutes: number,
  nowMinutes: number,
): boolean {
  if (closeMinutes <= openMinutes) {
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes
  }
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes
}

/** Computes open/closed + today's hours string from backend businessHours. */
export function resolveBranchHoursStatus(
  businessHours: BranchBusinessHours[] | undefined,
  now: Date = new Date(),
): BranchHoursStatus {
  if (!businessHours?.length) {
    return { openNow: false }
  }

  const todayName = WEEKDAYS[now.getDay()]
  const today = businessHours.find((entry) => entry.day === todayName)

  if (!today || today.isClosed) {
    return { openNow: false, todayHours: 'Closed today' }
  }

  const todayHours = `${today.open}–${today.close}`
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const openNow = isOpenAtMinutes(
    parseTimeToMinutes(today.open),
    parseTimeToMinutes(today.close),
    nowMinutes,
  )

  return { openNow, todayHours }
}

/** Storefront Location uses legacy working_hours wire shape from adapters. */
export function resolveLocationHoursStatus(
  workingHours: WorkingHours[] | undefined,
  now: Date = new Date(),
): BranchHoursStatus {
  if (!workingHours?.length) {
    return { openNow: false }
  }

  const todayName = WEEKDAYS[now.getDay()]
  const today = workingHours.find((entry) => entry.day === todayName)

  if (!today || today.is_closed) {
    return { openNow: false, todayHours: 'Closed today' }
  }

  const todayHours = `${today.open}–${today.close}`
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const openNow = isOpenAtMinutes(
    parseTimeToMinutes(today.open),
    parseTimeToMinutes(today.close),
    nowMinutes,
  )

  return { openNow, todayHours }
}
