/**
 * Runtime behavioural audit for Console Tenant/Branch selectors.
 * Run: node scripts/console-selector-runtime-audit.mjs
 * Requires dev server at http://localhost:3000 with NEXT_PUBLIC_USE_MOCK=true
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3001'
const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'
const OUT_DIR = join(process.cwd(), 'tmp', 'console-selector-audit')
const PASSWORD = 'password'

const MULTI_MEMBERSHIPS = [
  {
    tenantId: 'tenant-samoon-01',
    tenantSlug: 'samoon',
    tenantName: 'Samoon Restaurant',
    roles: ['owner'],
    branchAccess: { scope: 'all' },
  },
  {
    tenantId: 'tenant-brew-cafe-01',
    tenantSlug: 'brew-cafe',
    tenantName: 'Brew Cafe',
    roles: ['cashier'],
    branchAccess: { scope: 'selected', branchIds: ['branch-brewcafe-01'] },
  },
]

const INIT_SCRIPT = () => {
  window.__auditEvents = window.__auditEvents || []
  window.__auditNetwork = window.__auditNetwork || []
  if (!window.__auditHooksInstalled) {
    window.__auditHooksInstalled = true
    window.addEventListener('console:tenant-changed', (e) => {
      window.__auditEvents.push({ type: 'console:tenant-changed', detail: e.detail, ts: Date.now() })
    })
    window.addEventListener('console:branch-changed', (e) => {
      window.__auditEvents.push({ type: 'console:branch-changed', detail: e.detail, ts: Date.now() })
    })
    const origFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
      window.__auditNetwork.push({ ts: Date.now(), url: String(url), method: (args[1]?.method) || 'GET' })
      return origFetch(...args)
    }
  }
}

async function captureState(page, label) {
  const state = await page.evaluate(() => {
    const safeParse = (k) => {
      const raw = localStorage.getItem(k)
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    }
    const buttons = Array.from(document.querySelectorAll('button[aria-haspopup="listbox"]'))
    const tenantBtn = buttons.find((b) => /switch tenant/i.test(b.getAttribute('aria-label') || ''))
    const branchBtn = buttons.find((b) => /switch branch/i.test(b.getAttribute('aria-label') || ''))
    const branchHint = document.querySelector('main')?.innerText?.slice(0, 500) || ''
    const menuRows = document.querySelectorAll('main table tbody tr, main [data-testid="menu-item"], main .menu-item-row')
    return {
      url: location.href,
      mockSessionEmail: localStorage.getItem('mock_session_email'),
      mockActiveTenantId: localStorage.getItem('mock_active_tenant_id'),
      mockActiveBranchId: localStorage.getItem('mock_active_branch_id'),
      mockSessionMemberships: safeParse('mock_session_memberships'),
      rbacPersist: safeParse('samoon-rbac'),
      branchPersist: safeParse('samoon-branch'),
      tenantPersist: safeParse('samoon-tenant'),
      consoleWorkspacePersist: safeParse('samoon-console-workspace'),
      tenantSwitcherLabel: tenantBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      branchSwitcherLabel: branchBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      pageHeading: document.querySelector('main h1')?.textContent?.trim() ?? null,
      branchContextOnPage:
        document.body.innerText.match(/Main Branch|Downtown Branch|Airport Branch|Midtown Cafe|Brooklyn Cafe|branch-rest-\d+/gi)?.slice(0, 5) ?? [],
      selectBranchPrompt: /select a branch|select branch/i.test(document.body.innerText),
      menuRowCount: menuRows.length,
      mainTextSample: document.querySelector('main')?.innerText?.slice(0, 800) ?? '',
      auditEvents: [...(window.__auditEvents || [])],
      auditNetwork: [...(window.__auditNetwork || [])].slice(-30),
    }
  })
  return { label, ...state, ts: new Date().toISOString() }
}

async function seedMockSession(page, email = 'owner@samoon.com') {
  await page.goto(`${BASE}/`)
  await page.evaluate(
    ({ email, access }) => {
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', access)
      localStorage.setItem('mock_session_email', email)
      document.cookie = `access_token=${encodeURIComponent(access)}; path=/; max-age=604800; SameSite=Strict`
    },
    { email, access: MOCK_ACCESS_TOKEN },
  )
}

async function loginAsOwner(page) {
  await seedMockSession(page, 'owner@samoon.com')
  await page.goto(`${BASE}/console`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  const onConsole = /\/console/.test(page.url())
  if (!onConsole) {
    await page.goto(`${BASE}/login?redirect=/console`)
    await page.getByRole('button', { name: /sign in with email instead/i }).click()
    await page.getByRole('textbox', { name: /email/i }).fill('owner@samoon.com')
    await page.locator('#password').fill(PASSWORD)
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(/\/console/, { timeout: 30000 })
    await page.waitForTimeout(1500)
  }
}

async function loginAsStaff(page) {
  await seedMockSession(page, 'staff@samoon.com')
  await page.goto(`${BASE}/console`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
}

async function openTenantSwitcher(page) {
  const btn = page.getByRole('button', { name: /switch tenant/i })
  await btn.waitFor({ state: 'visible', timeout: 15000 })
  await btn.click()
}

async function openBranchSwitcher(page) {
  const btn = page.getByRole('button', { name: /switch branch/i })
  await btn.waitFor({ state: 'visible', timeout: 15000 })
  await btn.click()
}

async function selectTenantOption(page, name) {
  await openTenantSwitcher(page)
  await page.getByRole('option', { name: new RegExp(name, 'i') }).click()
  await page.waitForTimeout(1200)
}

async function selectBranchOption(page, name) {
  await openBranchSwitcher(page)
  await page.getByRole('option', { name: new RegExp(name, 'i') }).click()
  await page.waitForTimeout(1200)
}

async function screenshot(page, name) {
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: false })
  return path
}

function diffStates(before, after) {
  const mismatches = []
  if (before.url !== after.url) mismatches.push({ kind: 'url', before: before.url, after: after.url })
  if (before.mockActiveTenantId !== after.mockActiveTenantId) {
    mismatches.push({ kind: 'mockActiveTenantId', before: before.mockActiveTenantId, after: after.mockActiveTenantId })
  }
  if (before.mockActiveBranchId !== after.mockActiveBranchId) {
    mismatches.push({ kind: 'mockActiveBranchId', before: before.mockActiveBranchId, after: after.mockActiveBranchId })
  }
  return mismatches
}

const report = { scenarios: [], inconsistencies: [], meta: { base: BASE, ranAt: new Date().toISOString() } }

async function recordScenario(id, title, fn) {
  const entry = { id, title, steps: [], screenshots: [], inconsistencies: [] }
  try {
    await fn(entry)
    entry.status = 'completed'
  } catch (err) {
    entry.status = 'failed'
    entry.error = err instanceof Error ? err.message : String(err)
  }
  report.scenarios.push(entry)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.addInitScript(INIT_SCRIPT)

  const networkLog = []
  page.on('request', (req) => {
    const url = req.url()
    if (/\/api\/|\/auth\/|\/tenants\/|\/authorization\//.test(url)) {
      networkLog.push({ ts: Date.now(), method: req.method(), url })
    }
  })

  // ── 1. Initial login ─────────────────────────────────────────────────────
  await recordScenario('1', 'Initial login', async (entry) => {
    await loginAsOwner(page)
    const state = await captureState(page, 'after-login')
    entry.steps.push(state)
    entry.screenshots.push(await screenshot(page, '01-initial-login'))
    entry.networkSample = networkLog.slice(-20)
    if (!state.tenantSwitcherLabel) entry.inconsistencies.push('Tenant switcher label empty after login')
    if (state.selectBranchPrompt && !state.mockActiveBranchId) {
      entry.inconsistencies.push('Branch selector shows "select branch" but mock_active_branch_id unset')
    }
  })

  // ── 2. Browser refresh ───────────────────────────────────────────────────
  await recordScenario('2', 'Browser refresh', async (entry) => {
    const before = await captureState(page, 'pre-refresh')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const after = await captureState(page, 'post-refresh')
    entry.steps.push({ before, after, diff: diffStates(before, after) })
    entry.screenshots.push(await screenshot(page, '02-after-refresh'))
    if (before.mockActiveTenantId && before.mockActiveTenantId !== after.mockActiveTenantId) {
      entry.inconsistencies.push('Active tenant mock key changed after refresh')
    }
    if (before.tenantSwitcherLabel && after.tenantSwitcherLabel && before.tenantSwitcherLabel !== after.tenantSwitcherLabel) {
      entry.inconsistencies.push({ kind: 'selector-label-drift-refresh', before: before.tenantSwitcherLabel, after: after.tenantSwitcherLabel })
    }
  })

  // ── 3. Tenant switch (inject multi-tenant mock) ──────────────────────────
  await recordScenario('3', 'Tenant switch (multi-tenant)', async (entry) => {
    await page.evaluate((memberships) => {
      localStorage.setItem('mock_session_memberships', JSON.stringify(memberships))
    }, MULTI_MEMBERSHIPS)
    const before = await captureState(page, 'before-tenant-switch')
    await selectTenantOption(page, 'Brew Cafe')
    const after = await captureState(page, 'after-tenant-switch')
    entry.steps.push({ before, after })
    entry.screenshots.push(await screenshot(page, '03-after-tenant-switch'))
    if (after.mockActiveTenantId !== 'tenant-brew-cafe-01') {
      entry.inconsistencies.push({ kind: 'store-api-tenant-mismatch', expected: 'tenant-brew-cafe-01', actual: after.mockActiveTenantId })
    }
    if (after.tenantSwitcherLabel && !/brew cafe/i.test(after.tenantSwitcherLabel)) {
      entry.inconsistencies.push({ kind: 'selector-tenant-mismatch', label: after.tenantSwitcherLabel })
    }
  })

  // ── 4. Branch switch ─────────────────────────────────────────────────────
  await recordScenario('4', 'Branch switch', async (entry) => {
    await selectTenantOption(page, 'Samoon')
    await page.waitForTimeout(1000)
    const before = await captureState(page, 'before-branch-switch')
    await selectBranchOption(page, 'Downtown Branch')
    const after = await captureState(page, 'after-branch-switch')
    entry.steps.push({ before, after })
    entry.screenshots.push(await screenshot(page, '04-after-branch-switch'))
    if (after.mockActiveBranchId !== 'branch-rest-02') {
      entry.inconsistencies.push({ kind: 'store-api-branch-mismatch', expected: 'branch-rest-02', actual: after.mockActiveBranchId })
    }
    if (after.branchSwitcherLabel && !/downtown/i.test(after.branchSwitcherLabel)) {
      entry.inconsistencies.push({ kind: 'selector-branch-mismatch', label: after.branchSwitcherLabel })
    }
  })

  // ── 5. Rapid tenant switching ────────────────────────────────────────────
  await recordScenario('5', 'Rapid tenant switching', async (entry) => {
    const clicks = []
    for (let i = 0; i < 4; i++) {
      const target = i % 2 === 0 ? 'Brew Cafe' : 'Samoon'
      const t0 = Date.now()
      await selectTenantOption(page, target)
      clicks.push({ target, ms: Date.now() - t0 })
    }
    const final = await captureState(page, 'after-rapid-tenant')
    entry.steps.push({ clicks, final })
    entry.screenshots.push(await screenshot(page, '05-rapid-tenant-switch'))
    const tenantEvents = final.auditEvents.filter((e) => e.type === 'console:tenant-changed')
    entry.tenantChangeEvents = tenantEvents.length
    if (tenantEvents.length < 2) entry.inconsistencies.push('Fewer tenant-changed events than expected during rapid switch')
  })

  // ── 6. Rapid branch switching ────────────────────────────────────────────
  await recordScenario('6', 'Rapid branch switching', async (entry) => {
    await selectTenantOption(page, 'Samoon')
    await page.waitForTimeout(800)
    const branches = ['Main Branch', 'Downtown Branch', 'Airport Branch', 'Main Branch']
    for (const b of branches) await selectBranchOption(page, b)
    const final = await captureState(page, 'after-rapid-branch')
    entry.steps.push({ final, branchEvents: final.auditEvents.filter((e) => e.type === 'console:branch-changed').length })
    entry.screenshots.push(await screenshot(page, '06-rapid-branch-switch'))
    if (final.mockActiveBranchId !== 'branch-rest-01') {
      entry.inconsistencies.push({ kind: 'rapid-branch-final-id', expected: 'branch-rest-01', actual: final.mockActiveBranchId })
    }
  })

  // ── 7. Navigate console pages after switching ────────────────────────────
  await recordScenario('7', 'Navigate between console pages', async (entry) => {
    await selectBranchOption(page, 'Downtown Branch')
    const routes = ['/console', '/console/orders', '/console/analytics', '/console/staff']
    for (const route of routes) {
      await page.goto(`${BASE}${route}`)
      await page.waitForTimeout(1200)
      const state = await captureState(page, route)
      entry.steps.push(state)
      if (state.branchSwitcherLabel && !/downtown/i.test(state.branchSwitcherLabel)) {
        entry.inconsistencies.push({ route, kind: 'branch-selector-drift', label: state.branchSwitcherLabel })
      }
    }
    entry.screenshots.push(await screenshot(page, '07-console-navigation'))
  })

  // ── 8. console/menu after switching ──────────────────────────────────────
  await recordScenario('8', 'Open /console/menu after switching', async (entry) => {
    await selectBranchOption(page, 'Main Branch')
    await page.goto(`${BASE}/console/menu`)
    await page.waitForTimeout(2000)
    const mainState = await captureState(page, 'menu-main-branch')
    entry.steps.push(mainState)
    entry.screenshots.push(await screenshot(page, '08-menu-main-branch'))

    await selectBranchOption(page, 'Downtown Branch')
    await page.waitForTimeout(2000)
    const downtownState = await captureState(page, 'menu-downtown-branch')
    entry.steps.push(downtownState)
    entry.screenshots.push(await screenshot(page, '08-menu-downtown-branch'))

    if (mainState.pageHeading === downtownState.pageHeading && mainState.branchContextOnPage.join() === downtownState.branchContextOnPage.join()) {
      entry.inconsistencies.push({ kind: 'menu-page-unchanged-after-branch-switch', mainState, downtownState })
    }
    if (downtownState.branchSwitcherLabel && !/downtown/i.test(downtownState.branchSwitcherLabel)) {
      entry.inconsistencies.push({ kind: 'menu-selector-branch-mismatch', label: downtownState.branchSwitcherLabel })
    }
  })

  // ── 9. console/orders after switching ──────────────────────────────────────
  await recordScenario('9', 'Open /console/orders after switching', async (entry) => {
    await selectBranchOption(page, 'Downtown Branch')
    await page.goto(`${BASE}/console/orders`)
    await page.waitForTimeout(2000)
    const state = await captureState(page, 'orders-downtown')
    entry.steps.push(state)
    entry.screenshots.push(await screenshot(page, '09-orders-downtown'))
    const body = await page.locator('main').innerText()
    if (/select a branch|awaiting/i.test(body) && state.mockActiveBranchId === 'branch-rest-02') {
      entry.inconsistencies.push({ kind: 'orders-blocked-despite-active-branch', body: body.slice(0, 300) })
    }
    if (state.branchSwitcherLabel && !/downtown/i.test(state.branchSwitcherLabel)) {
      entry.inconsistencies.push({ kind: 'orders-selector-mismatch', label: state.branchSwitcherLabel })
    }
  })

  // ── 10. console/branches/[id] after switching ───────────────────────────
  await recordScenario('10', 'Open /console/branches/[id] after switching', async (entry) => {
    await selectBranchOption(page, 'Main Branch')
    await page.goto(`${BASE}/console/branches/branch-rest-02`)
    await page.waitForTimeout(2000)
    const state = await captureState(page, 'branch-detail-rest-02')
    entry.steps.push(state)
    entry.screenshots.push(await screenshot(page, '10-branch-detail-mismatch'))
    const h1 = await page.locator('main h1').first().innerText().catch(() => '')
    if (/downtown/i.test(h1) && state.branchSwitcherLabel && /main branch/i.test(state.branchSwitcherLabel)) {
      entry.inconsistencies.push({
        kind: 'url-vs-selector-mismatch',
        urlBranch: 'branch-rest-02',
        pageTitle: h1,
        selectorBranch: state.branchSwitcherLabel,
      })
    } else if (/downtown/i.test(h1) && state.mockActiveBranchId === 'branch-rest-01') {
      entry.inconsistencies.push({
        kind: 'url-vs-store-mismatch',
        urlShows: 'Downtown Branch (branch-rest-02)',
        mockActiveBranchId: state.mockActiveBranchId,
        selectorBranch: state.branchSwitcherLabel,
      })
    }
  })

  // ── 11–14 persona variants ─────────────────────────────────────────────
  await recordScenario('11', 'Multi-tenant user session', async (entry) => {
    entry.steps.push(await captureState(page, 'multi-tenant-final'))
    const memberships = (await page.evaluate(() => localStorage.getItem('mock_session_memberships'))) 
    entry.membershipCount = memberships ? JSON.parse(memberships).length : 0
    if (entry.membershipCount < 2) entry.inconsistencies.push('Expected 2+ memberships in mock session')
  })

  await recordScenario('12', 'Multi-branch user (owner on Samoon)', async (entry) => {
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await loginAsOwner(page)
    await page.goto(`${BASE}/console`)
    await page.waitForTimeout(1500)
    await openBranchSwitcher(page)
    const options = await page.getByRole('option').allTextContents()
    entry.branchOptionCount = options.length
    entry.branchOptions = options.map((t) => t.split('\n')[0].trim())
    entry.screenshots.push(await screenshot(page, '12-multi-branch-options'))
    if (options.length < 2) entry.inconsistencies.push({ kind: 'expected-multiple-branches', count: options.length })
  })

  await recordScenario('13', 'Single tenant user (staff)', async (entry) => {
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await loginAsStaff(page)
    const state = await captureState(page, 'single-tenant-staff')
    entry.steps.push(state)
    entry.screenshots.push(await screenshot(page, '13-single-tenant-staff'))
    await openTenantSwitcher(page)
    const tenantOptions = await page.getByRole('option').count()
    entry.tenantOptionCount = tenantOptions
    if (tenantOptions !== 1) entry.inconsistencies.push({ kind: 'single-tenant-option-count', count: tenantOptions })
  })

  await recordScenario('14', 'Single branch user (brew cafe cashier after switch)', async (entry) => {
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await loginAsOwner(page)
    await page.evaluate((memberships) => {
      localStorage.setItem('mock_session_memberships', JSON.stringify(memberships))
    }, MULTI_MEMBERSHIPS)
    await page.reload()
    await page.waitForTimeout(1500)
    await selectTenantOption(page, 'Brew Cafe')
    await page.waitForTimeout(1000)
    const state = await captureState(page, 'single-branch-brew')
    entry.steps.push(state)
    await openBranchSwitcher(page)
    const branchOptions = await page.getByRole('option').allTextContents()
    entry.branchOptions = branchOptions.map((t) => t.split('\n')[0].trim())
    entry.screenshots.push(await screenshot(page, '14-single-branch-brew'))
    if (branchOptions.length > 2) {
      entry.note = `Brew cafe has ${branchOptions.length} branches in mock — scoped user may see filtered list`
    }
  })

  // Aggregate inconsistencies
  for (const s of report.scenarios) {
    for (const inc of s.inconsistencies || []) {
      report.inconsistencies.push({ scenario: s.id, title: s.title, ...(typeof inc === 'string' ? { message: inc } : inc) })
    }
  }

  report.networkLog = networkLog
  await writeFile(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outDir: OUT_DIR, scenarios: report.scenarios.length, inconsistencies: report.inconsistencies.length }, null, 2))
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
