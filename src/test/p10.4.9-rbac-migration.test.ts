// ============================================================
// P10.4.9 — Legacy RBAC Migration Preparation (superseded)
//
// Phase 2 (RBAC unification) removed the ownership/StaffAssignment engine
// this file exercised (resolveOwnershipIdentity, resolveOwnershipDrivenPermissions,
// StaffAssignment-driven console access). useHasDashboardAccess() is now a
// thin wrapper over usePermission('dashboard:access'), reading exclusively
// from useRbacStore.currentTenantSession — see
// src/test/p10.3.1-dashboard-access-audit.test.ts for current coverage of
// that single-source behavior. This file's original fixture-consistency
// and ownership-resolution assertions no longer apply to any live code
// path and are intentionally not carried forward.
// ============================================================
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('P10.4.9 (superseded) — no runtime code depends on the ownership engine for console access', () => {
  it('hooks/index.ts has zero runtime imports of ownership-resolution.service', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    expect(src).not.toContain("from '@/services/ownership-resolution.service'")
  })
})
