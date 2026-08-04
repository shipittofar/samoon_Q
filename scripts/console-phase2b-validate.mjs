/**
 * Phase 2B validation — label parity, zero boot fetches when membership is complete.
 * Usage: AUDIT_BASE_URL=http://localhost:3001 node scripts/console-phase2b-validate.mjs
 */
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3001'
const OUT = join(process.cwd(), 'tmp', 'console-phase2b-validate')
const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'

mkdirSync(OUT, { recursive: true })

async function seedOwnerSession(page) {
  await page.evaluate((token) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('refresh_token', token)
    localStorage.setItem('mock_session_email', 'owner@samoon.com')
    localStorage.removeItem('mock_session_memberships')
    localStorage.removeItem('mock_active_tenant_id')
    localStorage.removeItem('mock_active_branch_id')
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Strict`
  }, MOCK_ACCESS_TOKEN)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto(`${BASE}/`)
  await seedOwnerSession(page)

  await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const result = await page.evaluate(() => {
    const tenantBtn = document.querySelector('button[aria-label*="switch tenant" i]')
    const branchBtn = document.querySelector('button[aria-label*="switch branch" i]')
    const loads = window.__consoleBootMetrics ?? {}
    return {
      loads,
      skeleton: !!document.querySelector('[aria-label="Loading workspace context"]'),
      tenantLabel: tenantBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      branchLabel: branchBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    }
  })

  await tenantBtnOpen(page)
  const dropdownLabels = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('[role="listbox"] [role="option"] p.font-medium'))
    return options.map((el) => el.textContent?.trim() ?? '')
  })

  await page.screenshot({ path: join(OUT, '01-console-selectors.png'), fullPage: false })

  const report = {
    generatedAt: new Date().toISOString(),
    metrics: result.loads,
    labels: {
      selectedTenant: result.tenantLabel,
      dropdownTenants: dropdownLabels,
      selectedBranch: result.branchLabel,
      labelParity:
        dropdownLabels.length > 0 && result.tenantLabel
          ? dropdownLabels.some((l) => result.tenantLabel?.includes(l))
          : false,
    },
    expectations: {
      loadTenantById: 0,
      loadBranchesForTenant: 0,
      tenantLabelIsSamoon: result.tenantLabel?.includes('Samoon Restaurant') ?? false,
      noSlugFallback: !result.tenantLabel?.includes('samoon') || result.tenantLabel?.includes('Samoon Restaurant'),
    },
    pass:
      (result.loads.loadTenantById ?? 0) === 0 &&
      (result.loads.loadBranchesForTenant ?? 0) === 0 &&
      result.tenantLabel?.includes('Samoon Restaurant') &&
      dropdownLabels.some((l) => l.includes('Samoon Restaurant')),
  }

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.pass ? 0 : 1)
}

async function tenantBtnOpen(page) {
  const tenantBtn = page.locator('button[aria-label*="switch tenant" i]')
  if (await tenantBtn.count()) {
    await tenantBtn.click()
    await page.waitForTimeout(300)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
