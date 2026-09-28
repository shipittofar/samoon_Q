// ============================================================
// Phase 3.6 — Menu Create Mutation Guard (release blocker fix)
//
// console/menu/page.tsx's "Add Item" button was the one remaining
// mutation trigger without a branch-resolution guard: unlike
// categories/page.tsx and extras/page.tsx, it had no `disabled` prop and
// submitCreate() had no early-return, so createMutation.mutate() could
// fire with an empty branch id while branchState !== 'ready'. This file
// proves both the disabled-trigger guard and the submitCreate()-level
// defense-in-depth guard are present.
// ============================================================
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

describe('Phase 3.6 — console/menu/page.tsx create-item mutation is branch-guarded', () => {
  const src = () => readSrc('app/console/menu/page.tsx')

  it('the "Add Item" trigger button is disabled when no branch is resolved, same as categories/extras', () => {
    const content = src()
    expect(content).toContain("onClick={openCreate} disabled={!adminBranchId}")
  })

  it('openCreate() refuses to open the create modal without adminBranchId', () => {
    const content = src()
    const block = content.slice(content.indexOf('const openCreate ='), content.indexOf('const submitCreate ='))
    expect(block).toContain('if (!adminBranchId) return')
  })

  it('submitCreate() refuses to call createMutation.mutate() unless branchState === "ready" and selectedBranch exists', () => {
    const content = src()
    const block = content.slice(content.indexOf('const submitCreate ='), content.indexOf('const openEdit ='))
    expect(block).toContain("branchState !== 'ready'")
    expect(block).toContain('!selectedBranch')
    expect(block).toContain('!adminBranchId')
    // The guard must appear before the mutate() call, not after.
    const guardIndex = block.indexOf("if (branchState !== 'ready'")
    const mutateIndex = block.indexOf('createMutation.mutateAsync(')
    expect(guardIndex).toBeGreaterThanOrEqual(0)
    expect(mutateIndex).toBeGreaterThan(guardIndex)
  })

  it('has exactly one call site for createMutation.mutate() and one for menuService.createItem() repo-wide', () => {
    const menuPageMatches = src().match(/createMutation\.mutateAsync\(/g) ?? []
    expect(menuPageMatches.length).toBe(1)

    const hooksSrc = readSrc('hooks/index.ts')
    const createItemCallers = hooksSrc.match(/menuService\.createItem\(/g) ?? []
    expect(createItemCallers.length).toBe(1)
  })
})

describe('Phase 3.6 — categories/extras pattern unchanged (not touched by this fix)', () => {
  it('categories/page.tsx still disables its create button the same way', () => {
    const content = readSrc('app/console/categories/page.tsx')
    expect(content).toContain('disabled={!adminBranchId}')
  })

  it('extras/page.tsx still disables its create button the same way', () => {
    const content = readSrc('app/console/extras/page.tsx')
    expect(content).toContain('disabled={!adminBranchId}')
  })
})
