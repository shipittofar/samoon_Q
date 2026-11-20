import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { parseMapCoordinates, toCoordinateNumber } from '@/lib/coordinates'
import { MapSelector } from '@/components/address/MapSelector'
import {
  branchFormToCreateRequest,
  branchFormToWriteRequest,
  branchToFormInput,
  EMPTY_BRANCH_FORM,
} from '@/types/branch-form'

// The shared map (Leaflet) needs a real browser; the stub exposes what MapSelector passes it.
vi.mock('@/components/maps', () => ({
  MapViewLazy: (props: { markers?: { id: string }[]; onMapClick?: (p: { lat: number; lng: number }) => void; ariaLabel?: string }) => (
    <button
      type="button"
      data-testid="shared-map"
      data-markers={(props.markers ?? []).map((m) => m.id).join(',')}
      aria-label={props.ariaLabel}
      onClick={() => props.onMapClick?.({ lat: 35.7, lng: 51.4 })}
    />
  ),
}))

const mapMessages = {
  address: {
    map: {
      locationLabel: 'Location',
      useCurrentLocation: 'Use current location',
      geolocationUnsupported: 'unsupported',
      geolocationDenied: 'denied',
      mapPreview: 'Map preview',
      noCoordinatesTitle: 'No coordinates',
      noCoordinatesHint: 'Pick a location',
      approximate: 'approximate',
    },
  },
  location: {
    accuracy_m: '±{value} m',
    accuracy_km: '±{value} km',
    locateError_denied: 'blocked',
    locateError_timeout: 'timeout',
    locateError_unavailable: 'unavailable',
    locateError_unsupported: 'unsupported',
    locateError_disabled: 'disabled',
  },
}

function renderMap(props: { latitude?: unknown; longitude?: unknown; onChange?: (c: { latitude: number; longitude: number }) => void }) {
  return render(
    <NextIntlClientProvider locale="en" messages={mapMessages}>
      <MapSelector
        latitude={props.latitude}
        longitude={props.longitude}
        onChange={props.onChange ?? (() => {})}
      />
    </NextIntlClientProvider>,
  )
}

describe('toCoordinateNumber', () => {
  it('keeps finite numbers', () => {
    expect(toCoordinateNumber(35.7219)).toBe(35.7219)
  })

  it('parses numeric strings', () => {
    expect(toCoordinateNumber('43')).toBe(43)
    expect(toCoordinateNumber('43.1234')).toBe(43.1234)
    expect(toCoordinateNumber('35.7219')).toBe(35.7219)
    expect(toCoordinateNumber(' 51.3347 ')).toBe(51.3347)
  })

  it('returns null for empty, missing, and invalid values — never 0', () => {
    expect(toCoordinateNumber('')).toBeNull()
    expect(toCoordinateNumber('   ')).toBeNull()
    expect(toCoordinateNumber(null)).toBeNull()
    expect(toCoordinateNumber(undefined)).toBeNull()
    expect(toCoordinateNumber('invalid')).toBeNull()
    expect(toCoordinateNumber(Number.NaN)).toBeNull()
    expect(toCoordinateNumber(Number.POSITIVE_INFINITY)).toBeNull()
    expect(toCoordinateNumber(Number.NEGATIVE_INFINITY)).toBeNull()
    expect(toCoordinateNumber(0)).toBe(0)
  })
})

describe('parseMapCoordinates', () => {
  it('returns numeric pair when both values are valid', () => {
    expect(parseMapCoordinates('35.7219', '51.3347')).toEqual({ lat: 35.7219, lng: 51.3347 })
    expect(parseMapCoordinates(35.7219, 51.3347)).toEqual({ lat: 35.7219, lng: 51.3347 })
  })

  it('returns null when either value is invalid', () => {
    expect(parseMapCoordinates('invalid', '35.7219')).toBeNull()
    expect(parseMapCoordinates(35.7219, 'invalid')).toBeNull()
    expect(parseMapCoordinates(null, null)).toBeNull()
    expect(parseMapCoordinates(undefined, 23.4567)).toBeNull()
    expect(parseMapCoordinates(43.1234, undefined)).toBeNull()
    expect(parseMapCoordinates(Number.NaN, 23)).toBeNull()
    expect(parseMapCoordinates(43, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('branchToFormInput coordinates', () => {
  it('normalizes string coordinates from the API into numbers', () => {
    const form = branchToFormInput({
      id: 'b1',
      tenantId: 't1',
      name: 'Downtown',
      slug: 'downtown',
      status: 'active',
      type: 'physical',
      location: {
        address: '1 Main',
        city: 'Tehran',
        country: 'IR',
        latitude: '35.7219' as unknown as number,
        longitude: '51.3347' as unknown as number,
      },
      contact: {},
      businessHours: [],
      checkout: EMPTY_BRANCH_FORM.checkout,
      marketplaceVisible: true,
      reservationsEnabled: false,
      created_at: '',
      updated_at: '',
    })
    expect(form.latitude).toBe(35.7219)
    expect(form.longitude).toBe(51.3347)
  })

  it('does not invent 0 for invalid API coordinates', () => {
    const form = branchToFormInput({
      id: 'b1',
      tenantId: 't1',
      name: 'Downtown',
      slug: 'downtown',
      status: 'active',
      type: 'physical',
      location: {
        address: '1 Main',
        city: 'Tehran',
        country: 'IR',
        latitude: 'invalid' as unknown as number,
        longitude: '51.3347' as unknown as number,
      },
      contact: {},
      businessHours: [],
      checkout: EMPTY_BRANCH_FORM.checkout,
      marketplaceVisible: true,
      reservationsEnabled: false,
      created_at: '',
      updated_at: '',
    })
    expect(form.latitude).toBeNull()
    expect(form.longitude).toBeNull()
  })
})

describe('branch form coordinate serialization', () => {
  it('create sends numeric latitude/longitude when valid', () => {
    const payload = branchFormToCreateRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'Sofia',
      country: 'BG',
      latitude: 43.1234,
      longitude: 23.4567,
    })
    expect(payload.location.latitude).toBe(43.1234)
    expect(payload.location.longitude).toBe(23.4567)
    expect(payload).not.toHaveProperty('checkout')
    expect(payload).not.toHaveProperty('slug')
  })

  it('create omits coordinates when missing or invalid — never 0', () => {
    const missing = branchFormToCreateRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'Sofia',
      country: 'BG',
    })
    expect(missing.location.latitude).toBeUndefined()
    expect(missing.location.longitude).toBeUndefined()

    const invalid = branchFormToCreateRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'Sofia',
      country: 'BG',
      latitude: Number.NaN,
      longitude: 23.4567,
    })
    expect(invalid.location.latitude).toBeUndefined()
    expect(invalid.location.longitude).toBeUndefined()
    expect(invalid.location.latitude).not.toBe(0)
  })

  it('edit sends numeric coordinates and keeps nested checkout', () => {
    const payload = branchFormToWriteRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'Sofia',
      country: 'BG',
      latitude: 43.1234,
      longitude: 23.4567,
    })
    expect(payload.location?.latitude).toBe(43.1234)
    expect(payload.location?.longitude).toBe(23.4567)
    expect('slug' in payload).toBe(false)
    expect(payload.checkout).toBeTruthy()
    expect(payload).not.toHaveProperty('tableOrderingEnabled')
  })

  it('edit emits null coordinates when missing/invalid — never 0', () => {
    const payload = branchFormToWriteRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'Sofia',
      country: 'BG',
      latitude: 'invalid' as unknown as number,
      longitude: Number.POSITIVE_INFINITY,
    })
    expect(payload.location?.latitude).toBeNull()
    expect(payload.location?.longitude).toBeNull()
  })

  it('hydrates string API coords then submits numbers', () => {
    const form = branchToFormInput({
      id: 'b1',
      tenantId: 't1',
      name: 'Downtown',
      slug: 'downtown',
      status: 'active',
      type: 'physical',
      location: {
        address: '1 Main',
        city: 'Sofia',
        country: 'BG',
        latitude: '43.1234' as unknown as number,
        longitude: '23.4567' as unknown as number,
      },
      contact: {},
      businessHours: [],
      checkout: EMPTY_BRANCH_FORM.checkout,
      marketplaceVisible: true,
      reservationsEnabled: false,
      created_at: '',
      updated_at: '',
    })
    expect(form.latitude).toBe(43.1234)
    expect(form.longitude).toBe(23.4567)
    expect(form).not.toHaveProperty('slug')
    const write = branchFormToWriteRequest(form)
    expect(write.location?.latitude).toBe(43.1234)
    expect(write.location?.longitude).toBe(23.4567)
    expect(typeof write.location?.latitude).toBe('number')
    expect(typeof write.location?.longitude).toBe('number')
  })
})

describe('MapSelector coordinate rendering', () => {
  it('renders numeric coordinates without crashing', () => {
    renderMap({ latitude: 35.7219, longitude: 51.3347 })
    expect(screen.getByText(/35\.72190/)).toBeInTheDocument()
  })

  it('renders string coordinates without crashing', () => {
    renderMap({ latitude: '35.7219', longitude: '51.3347' })
    expect(screen.getByText(/35\.72190/)).toBeInTheDocument()
  })

  it('renders missing coordinates without crashing', () => {
    renderMap({ latitude: null, longitude: null })
    expect(screen.getByText('No coordinates')).toBeInTheDocument()
  })

  it('renders invalid coordinates as empty, not 0', () => {
    renderMap({ latitude: 'invalid', longitude: '35.7219' })
    expect(screen.getByText('No coordinates')).toBeInTheDocument()
    expect(screen.queryByText(/0\.00000/)).not.toBeInTheDocument()
  })

  it('does not call toFixed on string or null coordinates', () => {
    const spy = vi.spyOn(Number.prototype, 'toFixed')
    renderMap({ latitude: '43.1234', longitude: '23.4567' })
    expect(spy).toHaveBeenCalled()
    for (const inst of spy.mock.instances) {
      const numeric = typeof inst === 'number' ? inst : Number(inst)
      expect(Number.isFinite(numeric)).toBe(true)
    }
    spy.mockClear()
    renderMap({ latitude: null, longitude: undefined })
    expect(screen.getByText('No coordinates')).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('MapSelector on the shared map', () => {
  it('shows the pin only when coordinates are valid (0,0 counts as unset)', () => {
    renderMap({ latitude: 35.7219, longitude: 51.3347 })
    expect(screen.getByTestId('shared-map').dataset.markers).toBe('pin')
  })

  it('no pin for missing or 0,0 coordinates', () => {
    renderMap({ latitude: 0, longitude: 0 })
    expect(screen.getByTestId('shared-map').dataset.markers).toBe('')
    expect(screen.getByText('No coordinates')).toBeInTheDocument()
  })

  it('tapping the map places the pin (works without GPS)', () => {
    const onChange = vi.fn()
    renderMap({ latitude: null, longitude: null, onChange })
    screen.getByTestId('shared-map').click()
    expect(onChange).toHaveBeenCalledWith({ latitude: 35.7, longitude: 51.4 })
  })

  it('no longer uses the third-party static map image', () => {
    const src = readFileSync(join(__dirname, '..', 'components', 'address', 'MapSelector.tsx'), 'utf8')
    expect(src).not.toContain('staticmap.openstreetmap')
    expect(src).not.toContain('next/image')
    expect(src).toContain('MapViewLazy')
  })
})

describe('no map bypasses the shared map system', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8')
  it.each([
    'app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx',
    'app/restaurant/page.tsx',
    'app/console/website/page.tsx',
    'components/address/MapSelector.tsx',
  ])('%s has no hard-coded Google Maps links or embeds', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/maps\.google\.com|google\.com\/maps|maps\/embed/)
    expect(src).not.toContain('staticmap.')
  })

  it('a business (website builder) has no location inputs', () => {
    const src = read('app/console/website/page.tsx')
    expect(src).not.toContain("setContact('latitude'")
    expect(src).not.toContain("setContact('mapEmbedUrl'")
  })
})
