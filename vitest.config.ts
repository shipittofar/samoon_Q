import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // Automatic JSX runtime so .tsx test/component files compile the same way
  // Next.js's SWC compiler already builds them (no `import React` needed) —
  // added for P9.1.3's first component-level test
  // (src/test/p9-1-3-authentication-control-center.test.tsx); every existing
  // .tsx source file already omits the React import, relying on this.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    env: {
      NEXT_PUBLIC_USE_MOCK: 'true',
    },
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
