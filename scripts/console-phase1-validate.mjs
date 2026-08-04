/**
 * Phase 1 validation — counts tenant/branch loads and selector visibility during /console boot.
 * Usage: AUDIT_BASE_URL=http://localhost:3001 node scripts/console-phase1-validate.mjs
 */
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3001'
const OUT = join(process.cwd(), 'tmp', 'console-phase1-validate')
const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'

mkdirSync(OUT, { recursive: true })

async function runScenario(label, seedFn) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto(`${BASE}/`)
  await seedFn(page)

  await page.addInitScript(() => {
    window.__timeline = []
    const poll = setInterval(() => {
      const skeleton = document.querySelector('[aria-label="Loading workspace context"]')
      const tenantBtn = document.querySelector('button[aria-label*="switch tenant" i]')
      const branchBtn = document.querySelector('button[aria-label*="switch branch" i]')
      window.__timeline.push({
        t: Math.round(performance.now()),
        skeleton: !!skeleton,
        tenant: tenantBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        tenantSpin: !!tenantBtn?.querySelector('.animate-spin'),
        branch: branchBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        branchSpin: !!branchBtn?.querySelector('.animate-spin'),
      })
      if (window.__timeline.length > 80) clearInterval(poll)
    }, 120)
  })

  await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(8000)

  const metrics = await page.evaluate(() => ({
    loads: window.__consoleBootMetrics ?? null,
    timeline: window.__timeline ?? [],
    final: {
      skeleton: !!document.querySelector('[aria-label="Loading workspace context"]'),
      tenant: document.querySelector('button[aria-label*="switch tenant" i]')?.textContent?.trim(),
      branch: document.querySelector('button[aria-label*="switch branch" i]')?.textContent?.trim(),
    },
  }))

  await browser.close()
  return { label, metrics }
}

const refresh = await runScenario('refresh', async (page) => {
  await page.evaluate((token) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('refresh_token', token)
    localStorage.setItem('mock_session_email', 'owner@samoon.com')
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Strict`
  }, MOCK_ACCESS_TOKEN)
})

const firstBranchBeforeTenant = refresh.metrics.timeline.find(
  (row) => row.branch && !row.skeleton && !row.tenant,
)
const firstTenantResolved = refresh.metrics.timeline.find(
  (row) => row.tenant && !row.skeleton && !row.tenantSpin,
)

const report = {
  generatedAt: new Date().toISOString(),
  baseline: {
    loadTenant: 1,
    loadTenantById: 1,
    loadBranchesForTenant: 2,
    note: 'Pre-Phase-1 audit estimate from bootstrap trace',
  },
  after: refresh.metrics.loads,
  ordering: {
    branchBeforeTenant: !!firstBranchBeforeTenant,
    firstBranchBeforeTenant,
    firstTenantResolved,
  },
  refresh,
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
