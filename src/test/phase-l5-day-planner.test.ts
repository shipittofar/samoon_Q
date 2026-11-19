/**
 * Phase L5 — multi-stop day planner: opening windows, appointment times,
 * exact order + branch optimization, keep-my-order mode, partial plans,
 * candidate building, the plan store and the multi-stop link.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  planDay,
  openWindows,
  earliestStart,
  parseClock,
  formatClock,
  APPOINTMENT_TOLERANCE_MIN,
  type PlanCandidate,
  type PlanTask,
  type PlanOptions,
} from '@/lib/planner/plan'
import { buildPlanTasks, candidatesForTask, defaultVisitMinutes, type PlannerItem } from '@/lib/planner/candidates'
import { buildMultiStopGoogleUrl } from '@/lib/navigation/deep-links'
import { useDayPlanStore } from '@/stores/day-plan-store'
import type { BranchBusinessHours } from '@/types/branch'
import type { PublicBranchInfo } from '@/types/marketplace'

const HOME = { lat: 35.7, lng: 51.4 }
/** Point `kmE` east and `kmN` north of HOME. */
const at = (kmE: number, kmN = 0) => ({ lat: HOME.lat + kmN / 111.32, lng: HOME.lng + kmE / (111.32 * Math.cos((HOME.lat * Math.PI) / 180)) })

const ALL_DAYS: BranchBusinessHours['day'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hours = (open: string, close: string): BranchBusinessHours[] => ALL_DAYS.map((day) => ({ day, open, close, isClosed: false }))

function cand(id: string, point: { lat: number; lng: number }, businessHours?: BranchBusinessHours[]): PlanCandidate {
  return { id, tenantId: id.split('-')[0], tenantName: id, branchId: id, branchName: id, point, businessHours }
}
function task(id: string, candidates: PlanCandidate[], durationMin = 30, atMin: number | null = null): PlanTask {
  return { id, label: id, durationMin, at: atMin, candidates }
}
/** Fixed 1 min per km (straight line) keeps expectations exact. */
const OPTS: PlanOptions = {
  start: HOME,
  startMin: 9 * 60,
  weekday: 1,
  travelMode: 'drive',
  optimizeOrder: true,
  returnToStart: false,
  travelMinutes: (a, b) => Math.round(Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * Math.cos((HOME.lat * Math.PI) / 180))),
}

describe('clock + opening windows', () => {
  it('parses and formats clock times', () => {
    expect(parseClock('17:30')).toBe(1050)
    expect(parseClock('bad')).toBeNull()
    expect(formatClock(1050)).toBe('17:30')
    expect(formatClock(1440 + 75)).toBe('01:15')
  })

  it('builds windows including overnight spill from yesterday and into tomorrow', () => {
    const w = openWindows(hours('18:00', '02:00'), 1)!
    expect(w).toContainEqual([-1440 + 1080, 120]) // yesterday 18:00 → today 02:00
    expect(w).toContainEqual([1080, 1440 + 120]) // today 18:00 → tomorrow 02:00
    expect(openWindows(undefined, 1)).toBeNull()
    // never tomorrow's own opening (no "wait until next morning" plans)
    expect(openWindows(hours('09:00', '17:00'), 1)!.every(([s]) => s < 1440)).toBe(true)
    const closedMonday = hours('09:00', '17:00').map((h) => (h.day === 'Monday' ? { ...h, isClosed: true } : h))
    expect(openWindows(closedMonday, 1)!.some(([s, e]) => s >= 0 && e <= 1440)).toBe(false)
  })

  it('earliestStart waits for opening, needs the visit to fit before closing', () => {
    const w: [number, number][] = [[600, 720]] // 10:00–12:00
    expect(earliestStart(540, 30, w)).toBe(600)
    expect(earliestStart(650, 30, w)).toBe(650)
    expect(earliestStart(700, 30, w)).toBeNull()
    expect(earliestStart(700, 30, null)).toBe(700)
  })

  it('appointments: wait if early, small tolerance if late, else impossible', () => {
    expect(earliestStart(1000, 30, null, 1020)).toBe(1020)
    expect(earliestStart(1020 + APPOINTMENT_TOLERANCE_MIN, 30, null, 1020)).toBe(1030)
    expect(earliestStart(1020 + APPOINTMENT_TOLERANCE_MIN + 1, 30, null, 1020)).toBeNull()
  })
})

describe('planDay', () => {
  it('orders stops to minimise the day (nearest-chain beats the listed order)', () => {
    // Listed: far (10 km E), near (2 km E), mid (5 km E) → best: near, mid, far
    const plan = planDay(
      [task('far', [cand('far', at(10))]), task('near', [cand('near', at(2))]), task('mid', [cand('mid', at(5))])],
      OPTS,
    )
    expect(plan.stops.map((s) => s.taskId)).toEqual(['near', 'mid', 'far'])
    expect(plan.totalTravelMin).toBe(10)
    expect(plan.finishAt).toBe(540 + 10 + 3 * 30)
    expect(plan.skipped).toEqual([])
  })

  it('picks the branch per task that fits the whole route, not just the nearest to home', () => {
    // Pizza A is nearest to home but opposite to the salon; pizza B sits next to the salon.
    const plan = planDay(
      [
        task('pizza', [cand('pizzaA', at(-3)), cand('pizzaB', at(8))]),
        task('salon', [cand('salon', at(9))]),
      ],
      OPTS,
    )
    expect(plan.stops.map((s) => s.candidate.id).sort()).toEqual(['pizzaB', 'salon'])
    expect(plan.totalTravelMin).toBe(9)
  })

  it('keep-my-order mode respects the listed order', () => {
    const plan = planDay(
      [task('far', [cand('far', at(10))]), task('near', [cand('near', at(2))])],
      { ...OPTS, optimizeOrder: false },
    )
    expect(plan.stops.map((s) => s.taskId)).toEqual(['far', 'near'])
  })

  it('schedules around opening hours and an appointment', () => {
    // Salon opens at 11:00; doctor appointment at 10:00; both 1 km apart.
    const plan = planDay(
      [
        task('salon', [cand('salon', at(1), hours('11:00', '20:00'))], 60),
        task('doctor', [cand('doctor', at(2))], 30, 600),
      ],
      OPTS,
    )
    expect(plan.stops.map((s) => s.taskId)).toEqual(['doctor', 'salon'])
    const [doctor, salon] = plan.stops
    expect(doctor.startAt).toBe(600)
    expect(doctor.waitMin).toBe(600 - (540 + 2))
    expect(salon.startAt).toBe(660)
    expect(plan.finishAt).toBe(720)
  })

  it('returns home when asked, adding the last leg', () => {
    const plan = planDay([task('a', [cand('a', at(4))])], { ...OPTS, returnToStart: true })
    expect(plan.returnTravelMin).toBe(4)
    expect(plan.finishAt).toBe(540 + 4 + 30 + 4)
  })

  it('keeps as many tasks as possible and reports the rest', () => {
    const plan = planDay(
      [
        task('open', [cand('open', at(1))]),
        task('closedAllDay', [cand('closed', at(2), hours('00:00', '00:00').map((h) => ({ ...h, isClosed: true })))]),
        task('nothing', []),
      ],
      OPTS,
    )
    expect(plan.stops.map((s) => s.taskId)).toEqual(['open'])
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        { taskId: 'nothing', reason: 'no_candidates' },
        { taskId: 'closedAllDay', reason: 'not_feasible' },
      ]),
    )
  })

  it('two clashing appointments: one is kept, one reported', () => {
    const plan = planDay(
      [task('a', [cand('a', at(1))], 60, 600), task('b', [cand('b', at(30))], 30, 620)],
      OPTS,
    )
    expect(plan.stops).toHaveLength(1)
    expect(plan.skipped).toHaveLength(1)
  })

  it('is exact on a brute-force check (5 tasks × 2 branches)', () => {
    const pts = [[3, 1], [-2, 4], [6, -3], [1, 7], [-5, -2], [4, 4], [-1, -6], [7, 2], [2, -4], [-4, 3]]
    const tasks = [0, 1, 2, 3, 4].map((t) =>
      task(`t${t}`, [cand(`t${t}-a`, at(pts[2 * t][0], pts[2 * t][1])), cand(`t${t}-b`, at(pts[2 * t + 1][0], pts[2 * t + 1][1]))], 20),
    )
    const plan = planDay(tasks, OPTS)
    // brute force
    const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])))
    let best = Infinity
    for (const order of perms([0, 1, 2, 3, 4])) {
      for (let choice = 0; choice < 32; choice++) {
        let pos = HOME
        let time = 540
        for (const t of order) {
          const c = tasks[t].candidates[(choice >> t) & 1]
          time += OPTS.travelMinutes!(pos, c.point, 'drive') + 20
          pos = c.point
        }
        best = Math.min(best, time)
      }
    }
    expect(plan.finishAt).toBe(best)
  })

  it('handles the maximum size quickly', () => {
    const tasks = Array.from({ length: 8 }, (_, t) =>
      task(`t${t}`, Array.from({ length: 4 }, (_, k) => cand(`t${t}-${k}`, at((t * 7 + k * 3) % 11 - 5, (t * 5 + k * 2) % 9 - 4)))),
    )
    const t0 = performance.now()
    const plan = planDay(tasks, OPTS)
    expect(plan.stops).toHaveLength(8)
    expect(performance.now() - t0).toBeLessThan(1500)
  })
})

describe('candidates', () => {
  const branch = (id: string, kmE: number, extra: Partial<PublicBranchInfo> = {}): PublicBranchInfo => {
    const p = at(kmE)
    return { id, slug: id, name: id, address: 'St', city: 'Tehran', openNow: true, latitude: p.lat, longitude: p.lng, ...extra }
  }
  const items: PlannerItem[] = [
    { tenant: { id: 'pz', name: 'Pizza Co', businessTypes: ['restaurant'] }, meta: {}, branches: [branch('pz1', 5), branch('pz2', 1, { menuItemNames: ['Pepperoni Pizza'] })] },
    { tenant: { id: 'gl', name: 'Glow', businessTypes: ['beauty_salon'] }, meta: {}, branches: [branch('gl1', 3)] },
    { tenant: { id: 'np', name: 'No Pin', businessTypes: ['beauty_salon'] }, meta: {}, branches: [branch('np1', 1, { latitude: undefined })] },
  ]

  it('category, query (menu) and business tasks find nearest located branches', () => {
    expect(candidatesForTask(items, { id: '1', kind: 'category', label: 'Salon', businessType: 'beauty_salon' }, HOME).map((c) => c.branchId)).toEqual(['gl1'])
    expect(candidatesForTask(items, { id: '2', kind: 'query', label: 'پیتزا', query: 'پیتزا' }, HOME).map((c) => c.branchId)).toEqual(['pz2', 'pz1'])
    expect(candidatesForTask(items, { id: '3', kind: 'business', label: 'Pizza Co', tenantId: 'pz' }, HOME)).toHaveLength(2)
  })

  it('default visit length comes from the vertical; the customer can override', () => {
    expect(defaultVisitMinutes('beauty_salon')).toBe(60)
    expect(defaultVisitMinutes(undefined)).toBe(30)
    const [salon, pizza] = buildPlanTasks(
      items,
      [
        { id: 's', kind: 'category', label: 'Salon', businessType: 'beauty_salon' },
        { id: 'p', kind: 'query', label: 'pizza', query: 'pizza', durationMin: 25, at: '13:00' },
      ],
      HOME,
    )
    expect(salon.durationMin).toBe(60)
    expect(pizza).toMatchObject({ durationMin: 25, at: 780 })
  })
})

describe('day plan store + multi-stop link', () => {
  beforeEach(() => useDayPlanStore.setState({ tasks: [], optimizeOrder: true, returnToStart: false }))

  it('adds (max 8), moves and removes tasks; persists without positions', () => {
    const s = useDayPlanStore.getState()
    s.addTask({ kind: 'query', label: 'pizza', query: 'pizza' })
    s.addTask({ kind: 'category', label: 'Salon', businessType: 'beauty_salon' })
    const [a, b] = useDayPlanStore.getState().tasks
    useDayPlanStore.getState().moveTask(b.id, -1)
    expect(useDayPlanStore.getState().tasks.map((t) => t.id)).toEqual([b.id, a.id])
    for (let i = 0; i < 10; i++) useDayPlanStore.getState().addTask({ kind: 'query', label: `x${i}` })
    expect(useDayPlanStore.getState().tasks).toHaveLength(8)
    useDayPlanStore.getState().removeTask(a.id)
    expect(useDayPlanStore.getState().tasks).toHaveLength(7)
    const persisted = localStorage.getItem('samoon-day-plan') ?? ''
    expect(persisted).not.toMatch(/lat|lng/)
  })

  it('Google multi-stop link: stops as waypoints, last is the destination, no origin', () => {
    const url = buildMultiStopGoogleUrl([{ lat: 35.71, lng: 51.41 }, { lat: 35.72, lng: 51.42 }, { lat: 35.73, lng: 51.43 }], 'walk')!
    expect(url).toContain('destination=35.73,51.43')
    expect(decodeURIComponent(url)).toContain('waypoints=35.71,51.41|35.72,51.42')
    expect(url).toContain('travelmode=walking')
    expect(url).not.toContain('origin')
    expect(buildMultiStopGoogleUrl([])).toBeNull()
  })
})
