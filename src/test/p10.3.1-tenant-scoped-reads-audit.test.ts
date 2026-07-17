// ============================================================
// P10.3.1 audit — Phase 2 (RBAC unification) rewrite.
//
// useAdminOrders()/useAdminReservations() no longer call
// assertOwnershipTenantAccess() (removed — the frontend must not decide
// tenant access via client-side ownership data). Tenant scoping now
// happens the same way for every admin data hook: the query key includes
// `tenantId`, and access to the console tree itself is gated upstream by
// AuthGuard/currentTenantSession, not by a per-hook ownership assertion.
// ============================================================
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('P10.3.1 — useAdminOrders()/useAdminReservations() no longer call ownership-resolution', () => {
  it('hooks/index.ts does not wire assertOwnershipTenantAccess into useAdminOrders', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useAdminOrders')
    const block = src.slice(start, start + 500)
    expect(block).not.toContain('assertOwnershipTenantAccess')
  })

  it('hooks/index.ts does not wire assertOwnershipTenantAccess into useAdminReservations', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useAdminReservations')
    const block = src.slice(start, start + 500)
    expect(block).not.toContain('assertOwnershipTenantAccess')
  })

  it('hooks/index.ts has zero runtime imports of ownership-resolution.service', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    expect(src).not.toContain("from '@/services/ownership-resolution.service'")
  })
})
