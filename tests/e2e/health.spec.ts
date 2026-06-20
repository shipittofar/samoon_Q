/**
 * Health & Readiness endpoint E2E — P4.10.2 / P4.10.5
 *
 * API-level tests: no browser required.
 * Verifies the operational endpoints return the correct contract
 * (liveness probe, readiness probe, extended payload from P4.9.2).
 */

import { test, expect } from '@playwright/test'

// ── /api/health ───────────────────────────────────────────────────────────────

test.describe('GET /api/health — liveness probe', () => {
  test('returns 200 OK', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
  })

  test('returns status: ok', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(body.status).toBe('ok')
  })

  test('returns version field', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(typeof body.version).toBe('string')
    expect(body.version.length).toBeGreaterThan(0)
  })

  test('returns environment field (P4.9.2)', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(['development', 'test', 'production']).toContain(body.environment)
  })

  test('returns ISO timestamp (P4.9.2)', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('returns uptime as a non-negative number (P4.9.2)', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    if (body.uptime !== undefined) {
      expect(typeof body.uptime).toBe('number')
      expect(body.uptime).toBeGreaterThanOrEqual(0)
    }
    // uptime may be absent on Edge runtime — that is acceptable
  })

  test('returns memory object when available (P4.9.2)', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    if (body.memory !== undefined) {
      expect(typeof body.memory.rss).toBe('number')
      expect(typeof body.memory.heapUsed).toBe('number')
      expect(typeof body.memory.heapTotal).toBe('number')
    }
  })

  test('Content-Type is application/json', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.headers()['content-type']).toContain('application/json')
  })
})

// ── /api/ready ────────────────────────────────────────────────────────────────

test.describe('GET /api/ready — readiness probe', () => {
  test('returns 200 or 503 (never throws 5xx unhandled)', async ({ request }) => {
    const res = await request.get('/api/ready')
    expect([200, 503]).toContain(res.status())
  })

  test('returns JSON body with a status field', async ({ request }) => {
    const body = await (await request.get('/api/ready')).json()
    expect(typeof body.status).toBe('string')
  })

  test('Content-Type is application/json', async ({ request }) => {
    const res = await request.get('/api/ready')
    expect(res.headers()['content-type']).toContain('application/json')
  })
})
