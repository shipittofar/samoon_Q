/**
 * Playwright configuration — Phase 4.10 (P4.10.1 / P4.10.6)
 *
 * Runs API-level E2E tests (no browser required).
 * Browser-level UI tests are covered by vitest + @testing-library (src/test/).
 *
 * The webServer starts the production build with mock-compatible API routes.
 * NEXT_PUBLIC_* variables are baked at build time; only server-side routes
 * (health, ready) are tested here — they have no dependency on mock mode.
 *
 * Usage:
 *   npm run test:e2e           — CI headless mode
 *   npm run test:e2e -- --debug — headed debug mode
 */

import { defineConfig } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  // API-only project: no browser name → no browser launched.
  // All tests use the `request` fixture for HTTP assertions.
  projects: [
    {
      name: 'api-e2e',
      // Intentionally omits `use.browserName` so no browser is launched.
    },
  ],

  webServer: {
    // Use standalone build output for clean startup (no "output: standalone" warning).
    command: 'HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
