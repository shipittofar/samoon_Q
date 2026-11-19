/**
 * Phase L2 — accurate live customer location: fix evaluation, fallbacks,
 * the location store, mock reverse geocoding, and branch pin verification.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  evaluateFix,
  resolveFallbackLocation,
  roundForAnalytics,
  describeAccuracy,
  MIN_MOVE_M,
  type UserLocation,
} from '@/lib/location/evaluate'
import { useLocationStore } from '@/stores/location-store'
import { mockReverseGeocode } from '@/lib/address-mock-data'
import { branchFormToWriteRequest, branchToFormInput } from '@/types/branch-form'
import { buildBranchCheckout } from '@/lib/branch-checkout'
import type { Branch } from '@/types/branch'

const TEHRAN = { lat: 35.6892, lng: 51.389 }
const OPTS = { minAccuracyM: 1000 }

const gps = (point = TEHRAN, accuracyM = 20, timestamp = 1_000_000): UserLocation => ({
  point, accuracyM, timestamp, source: 'gps', confirmed: false,
})

/** Move `meters` north of a point. */
const north = (p: { lat: number; lng: number }, meters: number) => ({ lat: p.lat + meters / 111_320, lng: p.lng })

describe('evaluateFix', () => {
  it('accepts the first accurate fix', () => {
    expect(evaluateFix(null, { point: TEHRAN, accuracyM: 25, timestamp: 1 }, OPTS).action).toBe('update')
  })

  it('asks to confirm a low-accuracy fix (or unknown accuracy)', () => {
    expect(evaluateFix(null, { point: TEHRAN, accuracyM: 3000, timestamp: 1 }, OPTS)).toMatchObject({ action: 'confirm', reason: 'low_accuracy' })
    expect(evaluateFix(null, { point: TEHRAN, accuracyM: null, timestamp: 1 }, OPTS)).toMatchObject({ action: 'confirm', reason: 'low_accuracy' })
  })

  it('does not nag about a low-accuracy fix right next to a good one', () => {
    const d = evaluateFix(gps(), { point: north(TEHRAN, 50), accuracyM: 3000, timestamp: 1_010_000 }, OPTS)
    expect(d).toMatchObject({ action: 'ignore', reason: 'small_move' })
  })

  it('ignores movements under the minimum move threshold', () => {
    const d = evaluateFix(gps(), { point: north(TEHRAN, MIN_MOVE_M / 2), accuracyM: 20, timestamp: 1_010_000 }, OPTS)
    expect(d).toMatchObject({ action: 'ignore', reason: 'small_move' })
  })

  it('accepts a small move when accuracy improves a lot', () => {
    const d = evaluateFix(gps(TEHRAN, 400), { point: north(TEHRAN, 80), accuracyM: 15, timestamp: 1_010_000 }, OPTS)
    expect(d.action).toBe('update')
  })

  it('accepts a real move (walking/driving)', () => {
    // 1.5 km in 3 minutes ≈ 30 km/h
    const d = evaluateFix(gps(), { point: north(TEHRAN, 1500), accuracyM: 20, timestamp: 1_000_000 + 180_000 }, OPTS)
    expect(d.action).toBe('update')
  })

  it('flags an implausible jump (GPS jamming/spoofing)', () => {
    // 50 km in 10 seconds
    const d = evaluateFix(gps(), { point: north(TEHRAN, 50_000), accuracyM: 20, timestamp: 1_010_000 }, OPTS)
    expect(d).toMatchObject({ action: 'confirm', reason: 'implausible_jump' })
  })

  it('keeps a manual choice over GPS', () => {
    const manual: UserLocation = { ...gps(), source: 'manual', confirmed: true }
    expect(evaluateFix(manual, { point: north(TEHRAN, 5000), accuracyM: 10, timestamp: 2_000_000 }, OPTS)).toMatchObject({
      action: 'ignore', reason: 'manual_preferred',
    })
  })

  it('ignores invalid points', () => {
    expect(evaluateFix(null, { point: { lat: 0, lng: 0 }, accuracyM: 5, timestamp: 1 }, OPTS)).toMatchObject({ action: 'ignore', reason: 'invalid' })
  })
})

describe('resolveFallbackLocation', () => {
  it('manual → address → platform centre', () => {
    const manual: UserLocation = { ...gps(), source: 'manual', confirmed: true }
    expect(resolveFallbackLocation({ manual, platformCenter: TEHRAN }).source).toBe('manual')
    const fromAddress = resolveFallbackLocation({
      defaultAddress: { latitude: 32.65, longitude: 51.66, city: 'Isfahan' },
      platformCenter: TEHRAN,
    })
    expect(fromAddress).toMatchObject({ source: 'address', city: 'Isfahan', confirmed: true })
    const fallback = resolveFallbackLocation({ defaultAddress: { latitude: null, longitude: null }, platformCenter: TEHRAN })
    expect(fallback).toMatchObject({ source: 'default', point: TEHRAN, confirmed: false })
  })
})

describe('helpers', () => {
  it('roundForAnalytics keeps ~110 m precision', () => {
    expect(roundForAnalytics({ lat: 35.689234, lng: 51.389876 })).toEqual({ lat: 35.689, lng: 51.39 })
  })

  it('describeAccuracy formats metres and kilometres', () => {
    expect(describeAccuracy(23)).toEqual({ value: 25, unit: 'm' })
    expect(describeAccuracy(1840)).toEqual({ value: 1.8, unit: 'km' })
    expect(describeAccuracy(null)).toBeNull()
  })
})

describe('useLocationStore', () => {
  beforeEach(() => useLocationStore.getState()._reset())

  it('applies an accurate fix as live GPS', () => {
    useLocationStore.getState().applyFix({ point: TEHRAN, accuracyM: 20, timestamp: 1 }, OPTS)
    expect(useLocationStore.getState().live).toMatchObject({ source: 'gps', point: TEHRAN })
    expect(useLocationStore.getState().pending).toBeNull()
  })

  it('holds a doubtful fix as pending until confirmed', () => {
    const s = useLocationStore.getState()
    s.applyFix({ point: TEHRAN, accuracyM: 5000, timestamp: 1 }, OPTS)
    expect(useLocationStore.getState().live).toBeNull()
    expect(useLocationStore.getState().pending?.reason).toBe('low_accuracy')
    useLocationStore.getState().confirmPending()
    expect(useLocationStore.getState().live).toMatchObject({ source: 'gps', confirmed: true })
    expect(useLocationStore.getState().pending).toBeNull()
  })

  it('manual choice switches mode; followDevice switches back and forgets it', () => {
    useLocationStore.getState().setManual(TEHRAN, { city: 'Tehran' })
    expect(useLocationStore.getState()).toMatchObject({ mode: 'manual', manual: { source: 'manual', city: 'Tehran' } })
    useLocationStore.getState().followDevice()
    expect(useLocationStore.getState()).toMatchObject({ mode: 'auto', manual: null })
  })

  it('persists only the customer choice, never live GPS', () => {
    useLocationStore.getState().applyFix({ point: TEHRAN, accuracyM: 20, timestamp: 1 }, OPTS)
    const persisted = JSON.parse(localStorage.getItem('samoon-location') ?? '{}').state
    expect(persisted).toEqual({ mode: 'auto', manual: null })
  })
})

describe('mock reverse geocoding', () => {
  it('names the nearest known city', () => {
    expect(mockReverseGeocode(35.70, 51.40).city).toBe('Tehran')
    expect(mockReverseGeocode(36.70, 51.20).city).toBe('Salman Shahr')
  })

  it('keeps the original answer for New York and unknown places', () => {
    expect(mockReverseGeocode(40.71, -74.0).city).toBe('New York')
    expect(mockReverseGeocode(-33.86, 151.2).city).toBe('New York')
  })
})

describe('branch pin verification', () => {
  const base = {
    id: 'b1', tenantId: 't1', name: 'Main', slug: 'main', status: 'active', type: 'physical',
    location: { address: 'a', city: 'c', country: 'IR', latitude: TEHRAN.lat, longitude: TEHRAN.lng },
    contact: {}, businessHours: [], checkout: buildBranchCheckout({ delivery: false }),
    marketplaceVisible: true, reservationsEnabled: false, created_at: '', updated_at: '',
  } as unknown as Branch

  it('round-trips locationVerifiedAt; null marks the pin unverified', () => {
    const verified = branchToFormInput({ ...base, locationVerifiedAt: '2026-11-19T10:00:00.000Z' })
    expect(branchFormToWriteRequest(verified).locationVerifiedAt).toBe('2026-11-19T10:00:00.000Z')
    const unverified = branchToFormInput(base)
    expect(unverified.locationVerifiedAt).toBeNull()
    expect(branchFormToWriteRequest(unverified).locationVerifiedAt).toBeNull()
  })
})
