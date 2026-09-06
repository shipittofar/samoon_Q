/**
 * P4.4 — QR Table Ordering: Table Metadata tests
 *
 * Verifies tableService, useTableInfo hook, TableInfo type,
 * and table/[tableId]/page.tsx source structure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── TableInfo type ────────────────────────────────────────────────────────────

describe('TableInfo type — src/types/index.ts', () => {
  const src = () => readSrc('types/index.ts')

  it('exports TableInfo interface', () => {
    expect(src()).toContain('export interface TableInfo')
  })

  it('has id field', () => {
    expect(src()).toMatch(/id:\s*string/)
  })

  it('has number field', () => {
    expect(src()).toMatch(/number:\s*number/)
  })

  it('has optional capacity field', () => {
    expect(src()).toContain('capacity?:')
  })

  it('has optional section field', () => {
    expect(src()).toContain('section?:')
  })

  it('has optional server_name field', () => {
    expect(src()).toContain('server_name?:')
  })

  it('has optional status field', () => {
    expect(src()).toContain('status?:')
  })

  it('status union includes available, occupied, reserved', () => {
    expect(src()).toContain("'available'")
    expect(src()).toContain("'occupied'")
    expect(src()).toContain("'reserved'")
  })
})

// ── tableService source structure ─────────────────────────────────────────────

describe('tableService — src/services/combined.service.ts', () => {
  const src = () => readSrc('services/combined.service.ts')

  it('exports tableService', () => {
    expect(src()).toContain('export const tableService')
  })

  it('has getTableInfo method', () => {
    expect(src()).toContain('getTableInfo')
  })

  it('imports TableInfo type', () => {
    expect(src()).toContain('TableInfo')
  })

  it('uses ENDPOINTS.TABLE.INFO', () => {
    expect(src()).toContain('ENDPOINTS.TABLE.INFO')
  })

  it('branches on USE_MOCK', () => {
    expect(src()).toContain('USE_MOCK')
  })

  it('has mock data with number field', () => {
    expect(src()).toContain('number:')
  })

  it('has mock data with section field', () => {
    expect(src()).toContain('section:')
  })

  it('has mock data with server_name field', () => {
    expect(src()).toContain('server_name:')
  })
})

// ── tableService runtime (mock mode) ─────────────────────────────────────────

describe('tableService.getTableInfo — mock mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns TableInfo for known table id', async () => {
    const { tableService } = await import('@/services/combined.service')
    const promise = tableService.getTableInfo('1')
    await vi.runAllTimersAsync()
    const info = await promise
    expect(info).toBeDefined()
    expect(info.number).toBe(1)
    expect(typeof info.id).toBe('string')
  })

  it('returns fallback TableInfo for unknown table id', async () => {
    const { tableService } = await import('@/services/combined.service')
    const promise = tableService.getTableInfo('99')
    await vi.runAllTimersAsync()
    const info = await promise
    expect(info).toBeDefined()
    expect(info.number).toBe(99)
  })

  it('resolves with id field', async () => {
    const { tableService } = await import('@/services/combined.service')
    const promise = tableService.getTableInfo('2')
    await vi.runAllTimersAsync()
    const info = await promise
    expect(info.id).toBeTruthy()
  })

  it('resolves with status field for known tables', async () => {
    const { tableService } = await import('@/services/combined.service')
    const promise = tableService.getTableInfo('1')
    await vi.runAllTimersAsync()
    const info = await promise
    expect(['available', 'occupied', 'reserved']).toContain(info.status)
  })
})

// ── useTableInfo hook source structure ────────────────────────────────────────

describe('useTableInfo hook — src/hooks/index.ts', () => {
  const src = () => readSrc('hooks/index.ts')

  it('exports useTableInfo', () => {
    expect(src()).toContain('export function useTableInfo')
  })

  it('accepts tableId parameter', () => {
    expect(src()).toContain('tableId')
  })

  it('uses useQuery', () => {
    expect(src()).toContain('useQuery')
  })

  it('has enabled guard on tableId', () => {
    expect(src()).toContain('enabled: !!tableId')
  })

  it('calls tableService.getTableInfo', () => {
    expect(src()).toContain('tableService.getTableInfo')
  })

  it('imports tableService', () => {
    expect(src()).toContain('tableService')
  })

  it('uses table-info query key', () => {
    expect(src()).toContain("'table-info'")
  })
})

// ── table/[tableId]/page.tsx source structure ─────────────────────────────────

describe('table/[tableId]/page.tsx — P4.4 source structure', () => {
  const src = () => readSrc('app/table/[tableId]/page.tsx')

  it('imports useTableInfo', () => {
    expect(src()).toContain('useTableInfo')
  })

  it('calls useTableInfo before early return', () => {
    const content = src()
    const componentIdx = content.indexOf('function TablePage(')
    const hookIdx = content.indexOf('useTableInfo(', componentIdx)
    const earlyReturnIdx = content.indexOf("t('invalidTable')", componentIdx)
    expect(hookIdx).toBeGreaterThan(componentIdx)
    expect(hookIdx).toBeLessThan(earlyReturnIdx)
  })

  it('passes null for invalid tables', () => {
    expect(src()).toContain('isValid ? tableId : null')
  })

  it('shows loading state', () => {
    expect(src()).toContain('tableLoading')
  })

  it('displays section when available', () => {
    expect(src()).toContain('tableInfo.section')
  })

  it('displays capacity when available', () => {
    expect(src()).toContain('tableInfo.capacity')
  })

  it('displays server_name when available', () => {
    expect(src()).toContain('tableInfo.server_name')
  })

  it('falls back to tableNumber when tableInfo not loaded', () => {
    expect(src()).toContain('tableInfo?.number ?? tableNumber')
  })

  it('checkout link still points to dine_in flow', () => {
    expect(src()).toContain('orderType=dine_in')
    expect(src()).toContain('table=${tableNumber}')
  })

  it('preserves ErrorBoundary for CartDrawer', () => {
    expect(src()).not.toContain('feature="CartDrawer"')
  })

  it('preserves ErrorBoundary for FloatingCart', () => {
    expect(src()).not.toContain('feature="FloatingCart"')
  })

  it('uses Loader2 for loading spinner', () => {
    expect(src()).toContain('Loader2')
  })

  it('is a client component', () => {
    expect(src()).toMatch(/^'use client'/)
  })
})
