// ============================================================
// P10.4.10 — Remove Legacy Dashboard Access Fallback (superseded)
//
// Phase 2 (RBAC unification) removed the ownership/StaffAssignment engine
// this file exercised. useHasDashboardAccess() is now a thin wrapper over
// usePermission('dashboard:access'), reading exclusively from
// useRbacStore.currentTenantSession — see
// src/test/p10.3.1-dashboard-access-audit.test.ts for current coverage.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('P10.4.10 (superseded) — useHasDashboardAccess has no ownership fallback of any kind', () => {
  it('hooks/index.ts defines useHasDashboardAccess purely via usePermission', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useHasDashboardAccess')
    const block = src.slice(start, start + 600)
    expect(block).toContain("usePermission('dashboard:access')")
    expect(block).not.toContain('resolveOwnershipIdentity')
    expect(block).not.toContain('resolveOwnerPermissions')
    expect(block).not.toContain('ownerOwnsTenant')
  })
})
