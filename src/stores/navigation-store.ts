'use client'

/**
 * Navigation preferences — Phase L4. The customer's remembered navigation
 * app and preferred travel mode (`auto` = walk when close, else drive).
 * Preferences only; no positions are stored here.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NavigationAppId } from '@/lib/navigation/deep-links'
import type { TravelMode } from '@/lib/travel'

export type TravelModePreference = TravelMode | 'auto'

interface NavigationState {
  preferredApp: NavigationAppId | null
  travelMode: TravelModePreference
  setPreferredApp: (app: NavigationAppId | null) => void
  setTravelMode: (mode: TravelModePreference) => void
  _reset: () => void
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      preferredApp: null,
      travelMode: 'auto',
      setPreferredApp: (preferredApp) => set({ preferredApp }),
      setTravelMode: (travelMode) => set({ travelMode }),
      _reset: () => set({ preferredApp: null, travelMode: 'auto' }),
    }),
    {
      name: 'samoon-navigation',
      version: 1,
      partialize: (s) => ({ preferredApp: s.preferredApp, travelMode: s.travelMode }),
    },
  ),
)
