// ============================================================
// P10.3 Phase G — Logout Cleanup — regression tests
// ============================================================
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { useRbacStore } from '@/stores'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('P10.3 Phase G — useLogout clears full RBAC state', () => {
  it('hooks/index.ts calls _resetStore(), not the partial clearRoles()', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useLogout')
    const logoutBody = src.slice(start, start + 800)
    expect(logoutBody).toContain('useRbacStore.getState()._resetStore()')
    expect(logoutBody).not.toContain('useRbacStore.getState().clearRoles()')
  })

  it('_resetStore clears every RBAC field, not just tenantRoles', () => {
    useRbacStore.setState({
      tenantRoles: [{ tenantId: 't1', roles: ['owner'] }],
      userOverrides: [{ userId: 'u1', tenantId: 't1', grant: [], revoke: [] }],
      customRoles: [
        { id: 'r1', tenantId: 't1', name: 'Custom', permissions: [], createdBy: 'u2', createdAt: new Date().toISOString() },
      ],
      rbacAuditLog: [
        { id: 'e1', tenantId: 't1', actorId: 'u2', action: 'role.assigned', timestamp: new Date().toISOString() },
      ],
    } as never)

    useRbacStore.getState()._resetStore()

    const state = useRbacStore.getState()
    expect(state.tenantRoles).toEqual([])
    expect(state.userOverrides).toEqual([])
    expect(state.customRoles).toEqual([])
    expect(state.rbacAuditLog).toEqual([])
  })
})
