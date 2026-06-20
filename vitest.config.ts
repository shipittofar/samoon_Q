import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Exclude Playwright E2E specs from the unit/integration suite.
    // Those run via `npm run test:e2e` (playwright test).
    exclude: ['tests/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
