'use client'

/**
 * Customer location store — Phase L2.
 *
 * Privacy: only what the customer chose is persisted (a hand-picked location
 * and the "auto / manual" mode). Live GPS fixes live in memory only and are
 * never written to storage.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GeoPoint } from '@/types/branch'
import { evaluateFix, type LocationFix, type UserLocation } from '@/lib/location/evaluate'

export type GeolocationStatus = 'idle' | 'prompt' | 'watching' | 'denied' | 'unavailable' | 'unsupported' | 'disabled'

export interface PendingConfirmation {
  fix: LocationFix
  reason: 'low_accuracy' | 'implausible_jump'
}

interface LocationState {
  /** 'auto' follows the device; 'manual' keeps the customer's chosen point. */
  mode: 'auto' | 'manual'
  /** Last accepted live fix (memory only). */
  live: UserLocation | null
  /** Customer-chosen location (persisted). */
  manual: UserLocation | null
  pending: PendingConfirmation | null
  status: GeolocationStatus

  applyFix: (fix: LocationFix, options: { minAccuracyM: number }) => void
  /** Pin chosen on the map (also used to confirm a doubtful fix at a corrected spot). */
  setManual: (point: GeoPoint, meta?: { city?: string; area?: string }) => void
  /** Accept the pending fix exactly as reported. */
  confirmPending: () => void
  dismissPending: () => void
  /** Back to following the device. */
  followDevice: () => void
  setStatus: (status: GeolocationStatus) => void
  setPlace: (place: { city?: string; area?: string }) => void
  _reset: () => void
}

const INITIAL = { mode: 'auto' as const, live: null, manual: null, pending: null, status: 'idle' as const }

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      applyFix: (fix, options) => {
        const { mode, live, manual } = get()
        const previous = mode === 'manual' ? manual : live
        const decision = evaluateFix(previous, fix, options)
        if (decision.action === 'update') {
          set({
            live: { ...fix, source: 'gps', confirmed: false, city: live?.city, area: live?.area },
            pending: null,
            status: 'watching',
          })
        } else if (decision.action === 'confirm') {
          set({ pending: { fix, reason: decision.reason }, status: 'watching' })
        }
      },

      setManual: (point, meta) => {
        set({
          mode: 'manual',
          manual: { point, accuracyM: null, timestamp: Date.now(), source: 'manual', confirmed: true, ...meta },
          pending: null,
        })
      },

      confirmPending: () => {
        const { pending, live } = get()
        if (!pending) return
        set({
          live: { ...pending.fix, source: 'gps', confirmed: true, city: live?.city, area: live?.area },
          pending: null,
        })
      },

      dismissPending: () => set({ pending: null }),

      followDevice: () => set({ mode: 'auto', manual: null, pending: null }),

      setStatus: (status) => set({ status }),

      setPlace: (place) => {
        const { mode, manual, live } = get()
        if (mode === 'manual' && manual) set({ manual: { ...manual, ...place } })
        else if (live) set({ live: { ...live, ...place } })
      },

      _reset: () => set({ ...INITIAL }),
    }),
    {
      name: 'samoon-location',
      version: 1,
      partialize: (s) => ({ mode: s.mode, manual: s.manual }),
    },
  ),
)
