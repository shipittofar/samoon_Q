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
import { evaluateFix, isConsistent, type LocationFix, type UserLocation } from '@/lib/location/evaluate'

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
  /**
   * The customer closed a low-accuracy prompt this session: further rough
   * readings are ignored (memory only) until an accurate fix arrives or they
   * ask for their location again.
   */
  roughDeclined: boolean
  status: GeolocationStatus

  applyFix: (fix: LocationFix, options: { minAccuracyM: number }) => void
  /** Pin chosen on the map (also used to confirm a doubtful fix at a corrected spot). */
  setManual: (point: GeoPoint, meta?: { city?: string; area?: string }) => void
  /** Accept the pending fix exactly as reported. */
  confirmPending: () => void
  /** The customer asked for and accepted a fresh device position. */
  acceptDeviceFix: (fix: LocationFix) => void
  dismissPending: () => void
  /** Back to following the device. */
  followDevice: () => void
  setStatus: (status: GeolocationStatus) => void
  setPlace: (place: { city?: string; area?: string }) => void
  _reset: () => void
}

const INITIAL = { mode: 'auto' as const, live: null, manual: null, pending: null, roughDeclined: false, status: 'idle' as const }

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      applyFix: (fix, options) => {
        const { mode, live, manual, pending, roughDeclined } = get()
        const previous = mode === 'manual' ? manual : live
        const decision = evaluateFix(previous, fix, options)
        if (decision.action === 'update') {
          set({
            live: { ...fix, source: 'gps', confirmed: false, city: live?.city, area: live?.area },
            pending: null,
            roughDeclined: false,
            status: 'watching',
          })
        } else if (decision.action === 'confirm') {
          if (decision.reason === 'low_accuracy' && roughDeclined) return
          // Same question already on screen and the reading agrees: don't re-ask.
          if (pending && pending.reason === decision.reason && isConsistent(pending.fix, fix)) return
          set({ pending: { fix, reason: decision.reason }, status: 'watching' })
        }
      },

      setManual: (point, meta) => {
        set({
          mode: 'manual',
          manual: { point, accuracyM: null, timestamp: Date.now(), source: 'manual', confirmed: true, ...meta },
          pending: null,
          roughDeclined: false,
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

      acceptDeviceFix: (fix) => {
        set({
          mode: 'auto',
          manual: null,
          live: { ...fix, source: 'gps', confirmed: true },
          pending: null,
          roughDeclined: false,
          status: 'watching',
        })
      },

      dismissPending: () => {
        const { pending } = get()
        set({ pending: null, roughDeclined: get().roughDeclined || pending?.reason === 'low_accuracy' })
      },

      followDevice: () => set({ mode: 'auto', manual: null, pending: null, roughDeclined: false }),

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
