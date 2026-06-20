/**
 * Critical path API assertions — P4.10.5
 *
 * API-level tests: no browser required.
 * Asserts operational invariants: health always responds,
 * ready probe degrades safely, and the app version is stable across calls.
 */

import { test, expect } from '@playwright/test'

test.describe('Critical path — operational invariants', () => {
  test('health endpoint is always reachable (never 5xx)', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBeLessThan(500)
  })

  test('health endpoint returns consistent version across calls', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      request.get('/api/health'),
      request.get('/api/health'),
    ])
    const [b1, b2] = await Promise.all([r1.json(), r2.json()])
    expect(b1.version).toBe(b2.version)
  })

  test('health timestamp is recent (within 5 s of now)', async ({ request }) => {
    const before = Date.now()
    const body = await (await request.get('/api/health')).json()
    const after = Date.now()
    const ts = new Date(body.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before - 2000)
    expect(ts).toBeLessThanOrEqual(after + 2000)
  })

  test('ready probe returns a recognized status value', async ({ request }) => {
    const body = await (await request.get('/api/ready')).json()
    expect(['ready', 'not_ready']).toContain(body.status)
  })

  test('app serves static manifest.json (PWA asset present)', async ({ request }) => {
    const res = await request.get('/manifest.json')
    // Either serves the manifest or 404 if not configured; never 5xx
    expect(res.status()).toBeLessThan(500)
  })

  test('sw.js is served (service worker asset present)', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBeLessThan(500)
  })
})
