import { describe, it, expect, vi } from 'vitest'
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

vi.mock('next/image', () => ({
  default: function MockImage({ alt }: { alt?: string }) {
    return <img alt={alt ?? ''} />
  },
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
    },
  },
}

function renderMap(props: { latitude?: unknown; longitude?: unknown }) {
  return render(
    <NextIntlClientProvider locale="en" messages={mapMessages}>
      <MapSelector
        latitude={props.latitude}
        longitude={props.longitude}
        onChange={() => {}}
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
    expect(payload.slug).toBeUndefined()
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
