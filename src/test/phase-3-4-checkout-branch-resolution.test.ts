// ============================================================
// Phase 3.4 — Checkout Branch Resolution (release blocker fix)
//
// checkout/page.tsx previously fell back to a hardcoded branch id ('1')
// for both order creation and payment-intent creation whenever
// `activeBranch` was unset — a real order/payment could be silently
// attributed to the wrong branch. This file proves that fallback is gone
// and that a blocking UI state exists instead.
// ============================================================
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

describe('Phase 3.4 — checkout/page.tsx has no hardcoded/default branch fallback', () => {
  const src = () => readSrc('app/checkout/page.tsx')

  it('does not contain the literal fallback branch id pattern', () => {
    expect(src()).not.toContain("|| '1'")
    expect(src()).not.toContain('?? \'1\'')
  })

  it('does not contain any "activeBranch?.id ||" pattern', () => {
    expect(src()).not.toContain('activeBranch?.id ||')
    expect(src()).not.toContain('activeBranch?.id ??')
  })

  it('order creation reads branch_id from the guard-checked cart branch', () => {
    const content = src()
    // Orders are created for the cart's own branch (cartBranchId, resolved
    // from the cart items) — never the route's activeBranch — and every
    // branch_id assignment uses that guard-checked value.
    const occurrences = content.match(/branch_id:\s*cartBranchId/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(2)
  })

  it('blocks rendering entirely when the cart has no resolvable branch, before the order form exists', () => {
    const content = src()
    expect(content).toContain('if (!cartBranchId)')
    expect(content).toContain('noBranchSelectedTitle')
    expect(content).toContain('noBranchSelectedDesc')
  })

  it('finaliseOrder() and onSubmit() each independently refuse to run without a cart branch (defense in depth)', () => {
    const content = src()
    const finaliseOrderBlock = content.slice(
      content.indexOf('const finaliseOrder ='),
      content.indexOf('const onSubmit ='),
    )
    expect(finaliseOrderBlock).toContain('if (!cartBranchId)')

    const onSubmitBlock = content.slice(
      content.indexOf('const onSubmit ='),
      content.indexOf('const handlePaymentSuccess ='),
    )
    expect(onSubmitBlock).toContain('if (!cartBranchId)')
  })
})

describe('Phase 3.4 — repository-wide: no remaining hardcoded branch fallback of this class', () => {
  function collectTsxFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        collectTsxFiles(full, out)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full)
      }
    }
    return out
  }

  it('no file under src/app or src/components contains `|| \'1\'` or `?? \'1\'` as a branch fallback', () => {
    const offenders: string[] = []
    for (const root of ['app', 'components']) {
      const dir = path.join(ROOT, 'src', root)
      if (!fs.existsSync(dir)) continue
      for (const file of collectTsxFiles(dir)) {
        const content = fs.readFileSync(file, 'utf-8')
        if (content.includes("|| '1'") || content.includes("?? '1'")) {
          offenders.push(path.relative(ROOT, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no file under src/app or src/components contains a live `branches[0]` selection', () => {
    const offenders: string[] = []
    for (const root of ['app', 'components']) {
      const dir = path.join(ROOT, 'src', root)
      if (!fs.existsSync(dir)) continue
      for (const file of collectTsxFiles(dir)) {
        const content = fs.readFileSync(file, 'utf-8')
        // Strip line and block comments before searching, so explanatory
        // comments like "no branches[0] fallback" don't false-positive.
        const codeOnly = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n')
          .map((line) => line.replace(/\/\/.*/, ''))
          .join('\n')
        if (codeOnly.includes('branches[0]')) {
          offenders.push(path.relative(ROOT, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
