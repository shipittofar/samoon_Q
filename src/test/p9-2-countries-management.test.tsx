/**
 * P9.2 — Countries Management Center tests
 *
 * Covers the framework additions (never Countries-specific logic): the
 * `configCollection` helpers, the generalized search/filter engine in
 * configUiHelpers, `useConfigurationBulkActions`, and the collection
 * dispatch in `ConfigurationFieldRow`/`ConfigurationModulePage`. The
 * Countries module itself is exercised only as the reference consumer,
 * mirroring how P9.1.3's test file used Authentication as its reference.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import {
  configurationService,
  configurationVersionManager,
  platformConfigurationRegistry,
  configCollection,
} from '@/config'
import type { ConfigFieldDefinition } from '@/config'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { DEFAULT_TENANT } from '@/constants'
import { useConfigurationBulkActions } from '@/hooks/use-configuration-bulk-actions'
import { ConfigurationModulePage } from '@/components/admin/configuration/ConfigurationModulePage'
import {
  buildSearchHaystack,
  matchesCollectionEntrySearch,
  deriveCollectionFilterOptions,
  matchesCollectionEntryFilters,
} from '@/components/admin/configuration/configUiHelpers'

function resetConfigState() {
  configurationService.__resetForTests()
  configurationVersionManager.__resetForTests()
}

function loginAsPlatformOwner() {
  useAuthStore.getState().setUser({
    id: 'u-owner', email: 'owner@samoon.com', first_name: 'Pat', last_name: 'Owner',
    role: 'admin', is_verified: true, created_at: '2024-01-01T00:00:00Z',
  })
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
  useRbacStore.getState().setCurrentTenantSession(DEFAULT_TENANT.id, ['owner'], normalizeTenantPermissions(['owner']).permissions)
}

beforeEach(() => {
  resetConfigState()
  loginAsPlatformOwner()
})

function getRegistryField(): ConfigFieldDefinition {
  return platformConfigurationRegistry.getField('countries.registry')!
}

describe('countries.registry field registration', () => {
  it('is registered as a collection field with a fixed 176-country roster', () => {
    const field = getRegistryField()
    expect(field.type).toBe('collection')
    expect(field.collection).toBeDefined()
    expect(field.collection!.entityIds).toHaveLength(176)
    expect(field.collection!.schema.length).toBeGreaterThan(15)
  })

  it('curates 50+ countries with mixed enabled/disabled/draft/testing states', () => {
    const field = getRegistryField()
    const entries = configCollection.getCollectionEntries(field, field.default)
    expect(entries).toHaveLength(176)
    const disabled = entries.filter((e) => e.values.enabled === false)
    const draft = entries.filter((e) => e.values.status === 'draft')
    const testing = entries.filter((e) => e.values.status === 'testing')
    expect(disabled.length).toBeGreaterThan(5)
    expect(draft.length).toBeGreaterThan(2)
    expect(testing.length).toBeGreaterThan(2)
    const currencies = new Set(entries.map((e) => e.values.currency))
    expect(currencies.size).toBeGreaterThan(10)
  })

  it('every entity has a region drawn from the 7 canonical regions', () => {
    const field = getRegistryField()
    const entries = configCollection.getCollectionEntries(field, field.default)
    const regions = new Set(entries.map((e) => e.values.region))
    for (const r of regions) {
      expect(['North America', 'South America', 'Europe', 'Middle East', 'Asia', 'Africa', 'Oceania']).toContain(r)
    }
    expect(regions.size).toBeGreaterThanOrEqual(6)
  })
})

describe('configCollection (framework, generic)', () => {
  const field = () => getRegistryField()

  it('getEntityValues merges schema defaults under a stored override', () => {
    const values = configCollection.getEntityValues(field(), field().default, 'US')
    expect(values.enabled).toBe(true)
    expect(values.currency).toBe('USD')
    expect(values.region).toBe('North America')
  })

  it('getEntityValues falls back to pure schema defaults for an entity id absent from the stored blob', () => {
    // Every code in ALL_COUNTRY_CODES has at least a region seeded, so use a
    // synthetic id absent from storage entirely to prove the merge is safe.
    const values = configCollection.getEntityValues(field(), field().default, 'ZZ')
    expect(values.enabled).toBe(true) // schema default, not a thrown error
  })

  it('buildMergedCollectionValue patches one entity without mutating the input', () => {
    const before = field().default
    const after = configCollection.buildMergedCollectionValue(before, 'US', { enabled: false })
    expect((before as Record<string, Record<string, unknown>>).US.enabled).not.toBe(false)
    expect((after as Record<string, Record<string, unknown>>).US.enabled).toBe(false)
  })

  it('resetEntityToDefault(field, current, entityId) clears just that entity', () => {
    const patched = configCollection.buildMergedCollectionValue(field().default, 'CA', { enabled: false, notes: 'x' })
    const reset = configCollection.resetEntityToDefault(field(), patched, 'CA')
    const values = configCollection.getEntityValues(field(), reset, 'CA')
    expect(values.enabled).toBe(true)
    expect(values.notes).toBe('')
  })

  it('resetEntityToDefault(field, current) with no entityId clears the whole collection', () => {
    const reset = configCollection.resetEntityToDefault(field(), field().default)
    expect(reset).toEqual({})
    const entries = configCollection.getCollectionEntries(field(), reset)
    // Roster still renders all 176 via entityIds, now all at pure schema defaults.
    expect(entries).toHaveLength(176)
    expect(entries.every((e) => e.values.enabled === true)).toBe(true)
  })

  it('getEntityLabel resolves a human-readable country name', () => {
    expect(configCollection.getEntityLabel(field(), 'US')).toBe('United States')
    expect(configCollection.getEntityLabel(field(), 'DE')).toBe('Germany')
  })

  it('matchesFilters is a pure property-equality predicate, ignoring undefined constraints', () => {
    const values = { enabled: true, region: 'Europe' }
    expect(configCollection.matchesFilters(values, { enabled: true })).toBe(true)
    expect(configCollection.matchesFilters(values, { enabled: false })).toBe(false)
    expect(configCollection.matchesFilters(values, { enabled: true, region: undefined })).toBe(true)
  })
})

describe('generalized search + filter engine (framework, generic)', () => {
  it('buildSearchHaystack joins and lowercases arbitrary parts, dropping empties', () => {
    expect(buildSearchHaystack(['United States', undefined, 'US', null])).toBe('united states us')
  })

  it('matchesCollectionEntrySearch matches on entity id, resolved label, and property values', () => {
    const field = getRegistryField()
    const entries = configCollection.getCollectionEntries(field, field.default)
    const us = entries.find((e) => e.entityId === 'US')!
    expect(matchesCollectionEntrySearch(field, us, 'united states')).toBe(true)
    expect(matchesCollectionEntrySearch(field, us, 'US')).toBe(true)
    expect(matchesCollectionEntrySearch(field, us, 'usd')).toBe(true) // currency property value
    expect(matchesCollectionEntrySearch(field, us, 'nonexistent-query')).toBe(false)
  })

  it('deriveCollectionFilterOptions derives options straight from the schema (boolean + select), no per-module code', () => {
    const field = getRegistryField()
    const options = deriveCollectionFilterOptions(field)
    expect(options.some((o) => o.propertyId === 'enabled' && o.value === true)).toBe(true)
    expect(options.some((o) => o.propertyId === 'enabled' && o.value === false)).toBe(true)
    expect(options.some((o) => o.propertyId === 'status' && o.label.includes('Published'))).toBe(true)
    expect(options.some((o) => o.propertyId === 'status' && o.label.includes('Experimental'))).toBe(true)
    expect(options.some((o) => o.propertyId === 'region')).toBe(true)
  })

  it('matchesCollectionEntryFilters is re-exported as the same configCollection.matchesFilters function', () => {
    expect(matchesCollectionEntryFilters).toBe(configCollection.matchesFilters)
  })
})

describe('useConfigurationBulkActions (framework, generic)', () => {
  it('enable/disable patch only the selected entities, leaving others untouched', () => {
    const field = getRegistryField()
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let nextValue: unknown
    act(() => {
      const outcome = result.current.computeBulkAction('disable', field.default, ['US', 'CA'])
      nextValue = outcome.nextValue
      expect(outcome.result.ok).toBe(true)
      expect(outcome.result.affectedIds).toEqual(['US', 'CA'])
    })
    const entries = configCollection.getCollectionEntries(field, nextValue)
    const us = entries.find((e) => e.entityId === 'US')!
    const de = entries.find((e) => e.entityId === 'DE')!
    expect(us.values.enabled).toBe(false)
    expect(de.values.enabled).toBe(true) // untouched
  })

  it('reset clears a selected entity back to schema defaults', () => {
    const field = getRegistryField()
    const patched = configCollection.buildMergedCollectionValue(field.default, 'FR', { enabled: false })
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let nextValue: unknown
    act(() => {
      nextValue = result.current.computeBulkAction('reset', patched, ['FR']).nextValue
    })
    const fr = configCollection.getEntityValues(field, nextValue, 'FR')
    expect(fr.enabled).toBe(true)
  })

  it('export returns a read-only JSON snapshot without mutating the value', () => {
    const field = getRegistryField()
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let outcome: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      outcome = result.current.computeBulkAction('export', field.default, ['US'])
    })
    expect(outcome!.nextValue).toBeUndefined()
    expect(outcome!.result.ok).toBe(true)
    expect(outcome!.result.message).toContain('"entityId": "US"')
  })

  it('import is a documented placeholder that never mutates the value', () => {
    const field = getRegistryField()
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let outcome: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      outcome = result.current.computeBulkAction('import', field.default, ['US'])
    })
    expect(outcome!.nextValue).toBeUndefined()
    expect(outcome!.result.ok).toBe(false)
  })

  it('rejects a bulk action with no selection', () => {
    const field = getRegistryField()
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let outcome: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      outcome = result.current.computeBulkAction('enable', field.default, [])
    })
    expect(outcome!.result.ok).toBe(false)
  })
})

describe('Countries Console page (collection dispatch, end-to-end)', () => {
  it('renders the countries module through the same ConfigurationModulePage as Authentication', () => {
    render(<ConfigurationModulePage moduleId="countries" />)
    expect(screen.getByRole('heading', { name: 'Countries' })).toBeInTheDocument()
    // The collection field renders as a table (entity id column header), not a single control.
    expect(screen.getByText('ISO Code')).toBeInTheDocument()
  })

  it('shows the fixed 176-country roster in the table body, including entities with zero stored overrides', () => {
    render(<ConfigurationModulePage moduleId="countries" />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('United States')).toBeInTheDocument()
    expect(within(table).getByText('Germany')).toBeInTheDocument()
  })
})

describe('Authentication regression (no framework change should affect it)', () => {
  it('authentication module is still registered and resolves its known field', () => {
    const field = platformConfigurationRegistry.getField('authentication.enabled')
    expect(field).toBeDefined()
    expect(field!.type).toBe('boolean')
  })

  it('ConfigurationModulePage still renders Authentication end-to-end', () => {
    render(<ConfigurationModulePage moduleId="authentication" />)
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })
})
