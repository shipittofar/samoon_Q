/**
 * Day planner — Phase L5 ("مسیر روز من").
 *
 * The customer lists things to do ("pizza", "hair salon", "doctor at 17:00",
 * "آش"); each can be met by several branches. We pick a branch per task AND
 * an order so the whole day ends as early as possible, honouring opening
 * hours, fixed appointment times and visit durations.
 *
 * Algorithm: exact dynamic programming over (visited-task subset, last
 * branch) — Held–Karp extended with candidate choice and time windows.
 * Because waiting is allowed, "earliest feasible start" never decreases when
 * you arrive later (FIFO), so keeping only the earliest finish per state is
 * exact. Cost: O(2ⁿ · (nK)²) — n ≤ 8 tasks, K ≤ 4 branches each ≈ 0.3 M steps.
 * If not every task fits, the plan keeps as many as possible and reports
 * the rest.
 *
 * Times are minutes from midnight of the plan day (may exceed 1440).
 */
import type { BranchBusinessHours, GeoPoint } from '@/types/branch'
import { distanceKm, isValidGeoPoint } from '@/lib/geo'
import { estimateTravelMinutes, suggestTravelMode, type TravelMode } from '@/lib/travel'

export const MAX_TASKS = 8
export const MAX_CANDIDATES_PER_TASK = 4
/** How late an appointment may start ("doctor at 17:00" → 17:00–17:10). */
export const APPOINTMENT_TOLERANCE_MIN = 10

export interface PlanCandidate {
  /** Unique per branch. */
  id: string
  tenantId: string
  tenantName: string
  branchId: string
  branchName: string
  point: GeoPoint
  emoji?: string
  address?: string
  businessHours?: BranchBusinessHours[]
}

export interface PlanTask {
  id: string
  label: string
  durationMin: number
  /** Fixed start time (minutes from midnight), e.g. an appointment. */
  at?: number | null
  candidates: PlanCandidate[]
}

export interface PlanOptions {
  start: GeoPoint
  /** Minutes from midnight. */
  startMin: number
  /** Day of week of the plan day: 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** `auto` = walk short legs, drive the rest. */
  travelMode: TravelMode | 'auto'
  /** false = keep the customer's order (tasks may still be skipped). */
  optimizeOrder: boolean
  returnToStart: boolean
  /** Override leg times (e.g. a backend travel matrix). Minutes. */
  travelMinutes?: (from: GeoPoint, to: GeoPoint, mode: TravelMode) => number
}

export interface PlannedStop {
  taskId: string
  candidate: PlanCandidate
  travelMode: TravelMode
  travelMin: number
  arriveAt: number
  startAt: number
  waitMin: number
  leaveAt: number
  /** Branch publishes no hours — assumed open. */
  hoursUnknown: boolean
}

export type SkipReason = 'no_candidates' | 'not_feasible'

export interface DayPlan {
  stops: PlannedStop[]
  skipped: { taskId: string; reason: SkipReason }[]
  startAt: number
  finishAt: number
  returnTravelMin: number
  totalTravelMin: number
  totalWaitMin: number
}

// ── Opening hours ────────────────────────────────────────────────────────────

const WEEKDAYS: BranchBusinessHours['day'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '')
  if (!m) return null
  const v = Number(m[1]) * 60 + Number(m[2])
  return v >= 0 && v <= 1440 ? v : null
}

/** "17:30" → 1050; invalid → null. */
export function parseClock(hhmm: string | null | undefined): number | null {
  return hhmm ? toMinutes(hhmm) : null
}

export function formatClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Open intervals on the plan day and the next morning, in plan-day minutes.
 * `null` = no published hours (treated as always open, flagged in the plan).
 */
export function openWindows(hours: BranchBusinessHours[] | undefined, weekday: number): [number, number][] | null {
  if (!hours?.length) return null
  const windows: [number, number][] = []
  const add = (dayIndex: number, offset: number) => {
    const entry = hours.find((h) => h.day === WEEKDAYS[((dayIndex % 7) + 7) % 7])
    if (!entry || entry.isClosed) return
    const open = toMinutes(entry.open)
    let close = toMinutes(entry.close)
    if (open === null || close === null) return
    if (close <= open) close += 1440 // overnight
    windows.push([open + offset, close + offset])
  }
  add(weekday - 1, -1440) // yesterday's late-night spill
  add(weekday, 0) // today, including its own overnight part
  // Tomorrow's opening is deliberately not offered: a day plan must not
  // "solve" a closed place by waiting until the next morning.
  return windows.filter(([, end]) => end > 0).sort((a, b) => a[0] - b[0])
}

/** Earliest start ≥ arrival such that the visit fits; null if impossible. */
export function earliestStart(
  arrival: number,
  durationMin: number,
  windows: [number, number][] | null,
  at?: number | null,
): number | null {
  let lo = arrival
  let hi = Infinity
  if (at != null) {
    if (arrival > at + APPOINTMENT_TOLERANCE_MIN) return null
    lo = Math.max(arrival, at)
    hi = at + APPOINTMENT_TOLERANCE_MIN
  }
  if (!windows) return lo <= hi ? lo : null
  for (const [open, close] of windows) {
    const s = Math.max(lo, open)
    if (s <= hi && s + durationMin <= close) return s
  }
  return null
}

// ── Planner ──────────────────────────────────────────────────────────────────

interface Cell {
  finish: number
  travel: number
  wait: number
  prevMask: number
  prevNode: number
  arrive: number
  start: number
  legMin: number
  legMode: TravelMode
}

const popcount = (x: number) => {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

const better = (a: Cell, b: Cell | undefined) => !b || a.finish < b.finish || (a.finish === b.finish && a.travel < b.travel)

export function planDay(tasksIn: readonly PlanTask[], options: PlanOptions): DayPlan {
  const tasks = tasksIn.slice(0, MAX_TASKS)
  const skipped: DayPlan['skipped'] = []

  // Flatten candidates into nodes; node -1 = start.
  const nodes: { task: number; cand: PlanCandidate; windows: [number, number][] | null }[] = []
  const nodesOfTask: number[][] = tasks.map(() => [])
  tasks.forEach((task, t) => {
    const cands = task.candidates.filter((c) => isValidGeoPoint(c.point)).slice(0, MAX_CANDIDATES_PER_TASK)
    if (!cands.length) skipped.push({ taskId: task.id, reason: 'no_candidates' })
    for (const cand of cands) {
      nodesOfTask[t].push(nodes.length)
      nodes.push({ task: t, cand, windows: openWindows(cand.businessHours, options.weekday) })
    }
  })

  const leg = (from: GeoPoint, to: GeoPoint): { min: number; mode: TravelMode } => {
    const km = distanceKm(from, to)
    const mode = options.travelMode === 'auto' ? suggestTravelMode(km) : options.travelMode
    const min = options.travelMinutes ? options.travelMinutes(from, to, mode) : km < 0.05 ? 0 : estimateTravelMinutes(km, mode)
    return { min, mode }
  }
  const pointOf = (node: number) => (node < 0 ? options.start : nodes[node].cand.point)
  const legCache = new Map<number, { min: number; mode: TravelMode }>()
  const legBetween = (a: number, b: number) => {
    const k = (a + 1) * 4096 + (b + 1)
    let v = legCache.get(k)
    if (!v) legCache.set(k, (v = leg(pointOf(a), pointOf(b))))
    return v
  }

  // Order constraint for "keep my order": a task may follow only lower-index tasks.
  const allowed = (mask: number, t: number) => {
    if (mask & (1 << t)) return false
    if (options.optimizeOrder) return true
    return mask >> t === 0 // no higher task visited yet
  }

  const dp = new Map<number, Map<number, Cell>>()
  const put = (mask: number, node: number, cell: Cell) => {
    let row = dp.get(mask)
    if (!row) dp.set(mask, (row = new Map()))
    if (better(cell, row.get(node))) row.set(node, cell)
  }

  const expand = (mask: number, fromNode: number, from: { finish: number; travel: number; wait: number }) => {
    for (let t = 0; t < tasks.length; t++) {
      if (!allowed(mask, t)) continue
      for (const node of nodesOfTask[t]) {
        const l = legBetween(fromNode, node)
        const arrive = from.finish + l.min
        const s = earliestStart(arrive, tasks[t].durationMin, nodes[node].windows, tasks[t].at)
        if (s === null) continue
        put(mask | (1 << t), node, {
          finish: s + tasks[t].durationMin,
          travel: from.travel + l.min,
          wait: from.wait + (s - arrive),
          prevMask: mask,
          prevNode: fromNode,
          arrive,
          start: s,
          legMin: l.min,
          legMode: l.mode,
        })
      }
    }
  }

  expand(0, -1, { finish: options.startMin, travel: 0, wait: 0 })
  // Every transition adds exactly one task, so sweep subsets level by level.
  for (let size = 1; size < tasks.length; size++) {
    const level = [...dp.keys()].filter((m) => popcount(m) === size)
    for (const mask of level) {
      for (const [node, cell] of dp.get(mask)!) expand(mask, node, cell)
    }
  }

  // Best end state: most tasks, then earliest finish (incl. the way home).
  let best: { mask: number; node: number; cell: Cell; home: number; end: number } | null = null
  for (const [mask, row] of dp) {
    for (const [node, cell] of row) {
      const home = options.returnToStart ? legBetween(node, -1).min : 0
      const end = cell.finish + home
      const cand = { mask, node, cell, home, end }
      if (
        !best ||
        popcount(mask) > popcount(best.mask) ||
        (popcount(mask) === popcount(best.mask) && (end < best.end || (end === best.end && cell.travel + home < best.cell.travel + best.home)))
      ) {
        best = cand
      }
    }
  }

  const stops: PlannedStop[] = []
  if (best) {
    let mask = best.mask
    let node = best.node
    while (mask) {
      const cell = dp.get(mask)!.get(node)!
      const n = nodes[node]
      stops.unshift({
        taskId: tasks[n.task].id,
        candidate: n.cand,
        travelMode: cell.legMode,
        travelMin: cell.legMin,
        arriveAt: cell.arrive,
        startAt: cell.start,
        waitMin: cell.start - cell.arrive,
        leaveAt: cell.finish,
        hoursUnknown: n.windows === null,
      })
      mask = cell.prevMask
      node = cell.prevNode
    }
  }
  const visited = new Set(stops.map((s) => s.taskId))
  for (const task of tasks) {
    if (!visited.has(task.id) && !skipped.some((s) => s.taskId === task.id)) {
      skipped.push({ taskId: task.id, reason: 'not_feasible' })
    }
  }

  return {
    stops,
    skipped,
    startAt: options.startMin,
    finishAt: best ? best.end : options.startMin,
    returnTravelMin: best?.home ?? 0,
    totalTravelMin: best ? best.cell.travel + best.home : 0,
    totalWaitMin: best?.cell.wait ?? 0,
  }
}
