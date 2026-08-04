/**
 * Counts tenant/branch loads and selector UI states during /console boot.
 * Usage: AUDIT_BASE_URL=http://localhost:3001 node scripts/console-bootstrap-instrument.mjs
 */
import { chromium } from '@playwright/test'

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3001'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()

await page.goto(`${BASE}/`)
await page.evaluate(({ TOKEN }) => {
  localStorage.setItem('access_token', TOKEN)
  localStorage.setItem('refresh_token', TOKEN)
  localStorage.setItem('mock_session_email', 'owner@samoon.com')
  document.cookie = `access_token=${encodeURIComponent(TOKEN)}; path=/; max-age=604800; SameSite=Strict`
}, { TOKEN })

await page.addInitScript(() => {
  window.__metrics = {
    calls: [],
    snapshots: [],
    start: performance.now(),
  }
  const log = (type, detail = {}) => {
    window.__metrics.calls.push({ t: Math.round(performance.now() - window.__metrics.start), type, ...detail })
  }

  const wrap = (obj, key, label) => {
    if (!obj || typeof obj[key] !== 'function') return
    const orig = obj[key].bind(obj)
    obj[key] = (...args) => {
      log(label, { args: args.map(String).join(',') })
      return orig(...args)
    }
  }

  const poll = setInterval(() => {
    const tenantBtn = document.querySelector('button[aria-label*="switch tenant" i], button[aria-label*="Switch tenant" i]')
    const branchBtn = document.querySelector('button[aria-label*="switch branch" i], button[aria-label*="Switch branch" i]')
    window.__metrics.snapshots.push({
      t: Math.round(performance.now() - window.__metrics.start),
      tenantText: tenantBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      tenantSpin: !!tenantBtn?.querySelector('.animate-spin'),
      branchText: branchBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      branchSpin: !!branchBtn?.querySelector('.animate-spin'),
    })
    if (window.__metrics.snapshots.length > 60) clearInterval(poll)
  }, 150)

  // Patch after zustand modules load — hook fetch for real backend mode
  const origFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const url = String(args[0])
    if (/\/auth\/me|\/tenants\/|\/branches/i.test(url)) log('fetch', { url })
    return origFetch(...args)
  }
  window.__wrapStores = () => {
    const stores = window.__ZUSTAND_STORES__
    if (!stores) return false
    wrap(stores.tenant, 'loadTenant', 'loadTenant')
    wrap(stores.tenant, 'loadTenantById', 'loadTenantById')
    wrap(stores.branch, 'loadBranchesForTenant', 'loadBranchesForTenant')
    wrap(stores.branch, 'loadBranchesFromMembership', 'loadBranchesFromMembership')
    wrap(stores.workspace, 'initializeFromSession', 'initializeFromSession')
    wrap(stores.workspace, 'switchTenant', 'switchTenant')
    return true
  }
})

await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)

const result = await page.evaluate(async () => {
  // Try to expose stores via React dev hook if available
  for (let i = 0; i < 20; i++) {
    if (window.__wrapStores?.()) break
    await new Promise((r) => setTimeout(r, 200))
  }
  const tenantBtn = document.querySelector('button[aria-label*="switch tenant" i], button[aria-label*="Switch tenant" i]')
  let dropdownOptions = []
  if (tenantBtn) {
    tenantBtn.click()
    await new Promise((r) => setTimeout(r, 300))
    dropdownOptions = [...document.querySelectorAll('[role="option"]')].map((el) => el.textContent?.replace(/\s+/g, ' ').trim())
  }
  return { metrics: window.__metrics, dropdownOptions }
})

const counts = result.metrics.calls.reduce((acc, c) => {
  acc[c.type] = (acc[c.type] ?? 0) + 1
  return acc
}, {})

console.log(JSON.stringify({ counts, calls: result.metrics.calls, snapshots: result.metrics.snapshots, dropdownOptions: result.dropdownOptions }, null, 2))
await browser.close()
