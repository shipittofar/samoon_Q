'use client'

/**
 * Day plan draft — Phase L5. The customer's task list and planner options,
 * kept on the device so the plan survives a reload. No positions stored.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlanTaskSpec } from '@/lib/planner/candidates'
import { MAX_TASKS } from '@/lib/planner/plan'

interface DayPlanState {
  tasks: PlanTaskSpec[]
  optimizeOrder: boolean
  returnToStart: boolean
  addTask: (task: Omit<PlanTaskSpec, 'id'>) => boolean
  updateTask: (id: string, patch: Partial<Omit<PlanTaskSpec, 'id'>>) => void
  removeTask: (id: string) => void
  moveTask: (id: string, delta: -1 | 1) => void
  clear: () => void
  setOptimizeOrder: (v: boolean) => void
  setReturnToStart: (v: boolean) => void
}

let seq = 0
const newId = () => `task-${Date.now().toString(36)}-${(seq++).toString(36)}`

export const useDayPlanStore = create<DayPlanState>()(
  persist(
    (set, get) => ({
      tasks: [],
      optimizeOrder: true,
      returnToStart: false,
      addTask: (task) => {
        if (get().tasks.length >= MAX_TASKS) return false
        set((s) => ({ tasks: [...s.tasks, { ...task, id: newId() }] }))
        return true
      },
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      moveTask: (id, delta) =>
        set((s) => {
          const i = s.tasks.findIndex((t) => t.id === id)
          const j = i + delta
          if (i < 0 || j < 0 || j >= s.tasks.length) return s
          const tasks = [...s.tasks]
          ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
          return { tasks }
        }),
      clear: () => set({ tasks: [] }),
      setOptimizeOrder: (optimizeOrder) => set({ optimizeOrder }),
      setReturnToStart: (returnToStart) => set({ returnToStart }),
    }),
    { name: 'samoon-day-plan', version: 1 },
  ),
)
