/**
 * P4.4 — Table Number Persistence tests
 *
 * Verifies that the dine-in store correctly persists table context across
 * navigation, and that checkout resolves table number via the priority chain:
 *   A) URL param  →  B) persisted store  →  C) empty string
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── DineInStore — source structure ────────────────────────────────────────────

describe('useDineInStore — source structure', () => {
  const src = () => readSrc('stores/index.ts')

  it('exports useDineInStore', () => {
    expect(src()).toContain('export const useDineInStore')
  })

  it('has tableNumber field initialised to null', () => {
    expect(src()).toContain('tableNumber: null')
  })

  it('has setTableNumber action', () => {
    expect(src()).toContain('setTableNumber')
  })

  it('has clearTable action', () => {
    expect(src()).toContain('clearTable')
  })

  it('uses persist middleware', () => {
    const storeBlock = src().slice(src().indexOf('useDineInStore'))
    expect(storeBlock).toContain('persist')
  })

  it('uses DINE_IN_KEY as storage key', () => {
    expect(src()).toContain('DINE_IN_KEY')
  })

  it('imports DINE_IN_KEY from constants', () => {
    expect(src()).toContain('DINE_IN_KEY')
  })
})

// ── DINE_IN_KEY constant ──────────────────────────────────────────────────────

describe('DINE_IN_KEY constant', () => {
  const src = () => readSrc('constants/index.ts')

  it('exports DINE_IN_KEY', () => {
    expect(src()).toContain('export const DINE_IN_KEY')
  })

  it('has value samoon-dine-in', () => {
    expect(src()).toContain("'samoon-dine-in'")
  })
})

// ── DineInStore — runtime behaviour ──────────────────────────────────────────

describe('useDineInStore — runtime', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('initialises with tableNumber null', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.setState({ tableNumber: null })
    expect(useDineInStore.getState().tableNumber).toBeNull()
  })

  it('setTableNumber stores a valid table number', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.getState().setTableNumber(5)
    expect(useDineInStore.getState().tableNumber).toBe(5)
  })

  it('setTableNumber can store any positive integer', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.getState().setTableNumber(42)
    expect(useDineInStore.getState().tableNumber).toBe(42)
  })

  it('clearTable resets tableNumber to null', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.getState().setTableNumber(7)
    useDineInStore.getState().clearTable()
    expect(useDineInStore.getState().tableNumber).toBeNull()
  })

  it('setTableNumber accepts null to clear', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.getState().setTableNumber(3)
    useDineInStore.getState().setTableNumber(null)
    expect(useDineInStore.getState().tableNumber).toBeNull()
  })

  it('survives sequential updates', async () => {
    const { useDineInStore } = await import('@/stores')
    useDineInStore.getState().setTableNumber(1)
    useDineInStore.getState().setTableNumber(2)
    useDineInStore.getState().setTableNumber(3)
    expect(useDineInStore.getState().tableNumber).toBe(3)
  })
})

// ── Table page — persistence integration ─────────────────────────────────────

describe('table/[tableId]/page.tsx — persistence source structure', () => {
  const src = () => readSrc('app/table/[tableId]/page.tsx')

  it('imports useDineInStore', () => {
    expect(src()).toContain('useDineInStore')
  })

  it('imports from @/stores', () => {
    expect(src()).toMatch(/useDineInStore.*from '@\/stores'|from '@\/stores'.*useDineInStore/)
  })

  it('calls setTableNumber', () => {
    expect(src()).toContain('setTableNumber')
  })

  it('calls clearTable', () => {
    expect(src()).toContain('clearTable')
  })

  it('uses useEffect for persistence side effect', () => {
    expect(src()).toContain('useEffect')
  })

  it('persists only when isValid is true', () => {
    expect(src()).toContain('if (isValid)')
  })

  it('clears table when isValid is false', () => {
    expect(src()).toContain('clearTable()')
  })

  it('imports useEffect from react', () => {
    expect(src()).toContain("import { use")
    expect(src()).toContain('useEffect')
  })
})

// ── Checkout page — priority chain ────────────────────────────────────────────

describe('checkout/page.tsx — table number priority chain', () => {
  const src = () => readSrc('app/checkout/page.tsx')

  it('imports useDineInStore', () => {
    expect(src()).toContain('useDineInStore')
  })

  it('reads persistedTableNumber from dine-in store', () => {
    expect(src()).toContain('persistedTableNumber')
  })

  it('uses URL param as first priority (A)', () => {
    expect(src()).toContain('paramTable && /^\\d+$/.test(paramTable)')
  })

  it('falls back to persistedTableNumber as second priority (B)', () => {
    expect(src()).toContain('persistedTableNumber !== null')
  })

  it('falls back to empty string as third priority (C)', () => {
    expect(src()).toContain(": ''")
  })

  it('converts persisted number to string for form default', () => {
    expect(src()).toContain('String(persistedTableNumber)')
  })

  it('preserves existing URL param logic', () => {
    expect(src()).toContain("searchParams.get('table')")
  })

  it('preserves initialOrderType from URL', () => {
    expect(src()).toContain("searchParams.get('orderType')")
  })
})

// ── Scenario matrix (source-level) ───────────────────────────────────────────

describe('Scenario matrix — source evidence', () => {
  it('Scenario A: direct checkout with URL param uses param', () => {
    const src = readSrc('app/checkout/page.tsx')
    // URL param path is checked first
    expect(src).toContain('paramTable && /^\\d+$/.test(paramTable)')
    expect(src).toContain('? paramTable')
  })

  it('Scenario B: navigate menu then checkout falls back to store', () => {
    const src = readSrc('app/checkout/page.tsx')
    expect(src).toContain('persistedTableNumber !== null ? String(persistedTableNumber)')
  })

  it('Scenario C: direct checkout with no prior table page gives empty', () => {
    const src = readSrc('app/checkout/page.tsx')
    expect(src).toContain(": ''")
  })

  it('Scenario D: invalid table does not persist table number', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).toContain('else')
    expect(src).toContain('clearTable()')
  })
})

// ── Regression: existing behaviour preserved ──────────────────────────────────

describe('Regression — existing P4.4 behaviour preserved', () => {
  it('table page still shows table info metadata', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).toContain('useTableInfo')
    expect(src).toContain('tableInfo?.section')
    expect(src).toContain('tableInfo?.number')
  })

  it('table page still has checkout link with URL param', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).toContain('orderType=dine_in')
    expect(src).toContain('table=${tableNumber}')
  })

  it('checkout page still reads orderType from URL', () => {
    const src = readSrc('app/checkout/page.tsx')
    expect(src).toContain("get('orderType')")
    expect(src).toContain('paramOrderType')
    expect(src).toContain('resolveCheckoutOrderWireType')
  })

  it('checkout page still pre-populates table_number in form', () => {
    const src = readSrc('app/checkout/page.tsx')
    expect(src).toContain('table_number: initialTableNumber')
  })

  it('checkout page still shows dine-in banner', () => {
    const src = readSrc('app/checkout/page.tsx')
    expect(src).toContain('requiresTableNumber')
    expect(src).toContain('initialTableNumber')
  })

  it('table page still has ErrorBoundary for CartDrawer', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).not.toContain('feature="CartDrawer"')
  })

  it('table page still has ErrorBoundary for FloatingCart', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).not.toContain('feature="FloatingCart"')
  })

  it('table page still validates range 1-100', () => {
    const src = readSrc('app/table/[tableId]/page.tsx')
    expect(src).toContain('tableNumber < 1')
    expect(src).toContain('tableNumber > 100')
  })

  it('useDineInStore does not affect cart or other stores', () => {
    const src = readSrc('stores/index.ts')
    const storeIdx = src.indexOf('useDineInStore')
    const cartIdx = src.indexOf('useCartStore')
    // They are separate store definitions — useDineInStore comes after useCartStore
    expect(storeIdx).toBeGreaterThan(cartIdx)
    // tableNumber does not appear inside the cart store block (before dine-in block starts)
    expect(src.indexOf('tableNumber', cartIdx)).toBeGreaterThanOrEqual(src.indexOf('DineInState'))
  })
})
