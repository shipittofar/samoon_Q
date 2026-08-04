/**
 * Phase 3 — Real API validation (NEXT_PUBLIC_USE_MOCK=false).
 *
 * Usage:
 *   AUDIT_BASE_URL=http://localhost:3000
 *   AUDIT_API_BASE=http://77.221.156.197:8800/api
 *   AUDIT_EMAIL=owner@example.com
 *   AUDIT_PASSWORD=secret
 *   node scripts/console-phase3-real-api-validate.mjs
 */
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const APP_BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3000'
const API_BASE = process.env.AUDIT_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8800/api'
const EMAIL = process.env.AUDIT_EMAIL
const PASSWORD = process.env.AUDIT_PASSWORD
const OUT = join(process.cwd(), 'tmp', 'console-phase3-real-api-validate')

mkdirSync(OUT, { recursive: true })

if (!EMAIL || !PASSWORD) {
  console.error('AUDIT_EMAIL and AUDIT_PASSWORD are required for real API validation.')
  process.exit(2)
}

async function loginViaApi() {
  const res = await fetch(`${API_BASE}/auth/password-login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  const access = data.access ?? data.tokens?.access
  const refresh = data.refresh ?? data.tokens?.refresh
  if (!access) throw new Error('Login response missing access token')
  return { access, refresh }
}

async function fetchMe(access) {
  const res = await fetch(`${API_BASE}/auth/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  })
  if (!res.ok) throw new Error(`getMe failed: ${res.status}`)
  return res.json()
}

async function run() {
  const tokens = await loginViaApi()
  const meWire = await fetchMe(tokens.access)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const networkLog = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/api/') || url.includes('/auth/')) {
      networkLog.push({ method: req.method(), url })
    }
  })

  await page.goto(`${APP_BASE}/`)
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      document.cookie = `access_token=${encodeURIComponent(access)}; path=/; max-age=604800; SameSite=Strict`
    },
    tokens,
  )

  await page.goto(`${APP_BASE}/console`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(8000)

  const ui = await page.evaluate(() => ({
    loads: window.__consoleBootMetrics ?? null,
    tenant: document.querySelector('button[aria-label*="switch tenant" i]')?.textContent?.trim() ?? null,
    branch: document.querySelector('button[aria-label*="switch branch" i]')?.textContent?.trim() ?? null,
  }))

  const tenantBtn = page.locator('button[aria-label*="switch tenant" i]')
  let dropdownTenants = []
  if (await tenantBtn.count()) {
    await tenantBtn.click()
    await page.waitForTimeout(300)
    dropdownTenants = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="listbox"] [role="option"] p.font-medium')).map(
        (el) => el.textContent?.trim() ?? '',
      ),
    )
  }

  await page.screenshot({ path: join(OUT, '01-console-real-api.png'), fullPage: false })

  const bootFetches = networkLog.filter(
    (r) =>
      /\/tenants\/[^/]+\/?$/.test(r.url) ||
      /\/tenants\/[^/]+\/branches/.test(r.url),
  )

  const membershipSample = Array.isArray(meWire.memberships) ? meWire.memberships[0] : null

  const report = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    meContract: {
      hasMemberships: Array.isArray(meWire.memberships),
      membershipCount: meWire.memberships?.length ?? 0,
      hasTenantName: Boolean(membershipSample?.tenantName ?? membershipSample?.tenant_name),
      hasBranches: Array.isArray(membershipSample?.branches) && membershipSample.branches.length > 0,
      activeMembership: meWire.activeMembership ?? meWire.active_membership ?? null,
    },
    bootMetrics: ui.loads,
    bootTenantBranchFetches: bootFetches,
    labels: {
      selectedTenant: ui.tenant,
      dropdownTenants,
      labelParity:
        dropdownTenants.length > 0 && ui.tenant
          ? dropdownTenants.some((l) => ui.tenant.includes(l))
          : false,
    },
    networkLog,
    pass:
      (ui.loads?.loadTenantById ?? 0) === 0 &&
      (ui.loads?.loadBranchesForTenant ?? 0) === 0 &&
      bootFetches.length === 0 &&
      Boolean(membershipSample?.tenantName ?? membershipSample?.tenant_name),
  }

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.pass ? 0 : 1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
