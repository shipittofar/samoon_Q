/**
 * Registry lifecycle — Platform Admin modules must register in the `@/config`
 * barrel before the first getField()/getModules() seal (root layout i18n).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLATFORM_MODULE_IDS = [
  'platform.overview',
  'platform.maintenance_mode',
  'platform.system_status',
] as const

describe('Platform configuration registry — startup vs seal', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { platformConfigurationRegistry } = await import('@/config/registry')
    platformConfigurationRegistry.__resetForTests()
  })

  it('importing @/config registers platform.overview before any seal', async () => {
    const { platformConfigurationRegistry } = await import('@/config')
    expect(platformConfigurationRegistry.getModule('platform.overview')).toBeDefined()
    expect(platformConfigurationRegistry.getModule('authentication')).toBeDefined()
    expect(platformConfigurationRegistry.getModule('countries')).toBeDefined()
  })

  it('i18n/runtime getField (root-layout path) does not prevent platform.overview from existing', async () => {
    const { resolveSupportedLocales } = await import('@/i18n/runtime')
    expect(() => resolveSupportedLocales()).not.toThrow()
    const { platformConfigurationRegistry } = await import('@/config/registry')
    expect(platformConfigurationRegistry.getModule('platform.overview')).toBeDefined()
    for (const id of PLATFORM_MODULE_IDS) {
      expect(platformConfigurationRegistry.getModule(id)).toBeDefined()
    }
  })

  it('importing @/platform-admin after a layout-style seal does not throw late registration', async () => {
    const { resolveSupportedLocales } = await import('@/i18n/runtime')
    resolveSupportedLocales()
    await expect(import('@/platform-admin')).resolves.toBeDefined()
    const { platformConfigurationRegistry } = await import('@/config/registry')
    expect(platformConfigurationRegistry.getModule('platform.overview')).toBeDefined()
  })

  it('register() after seal still throws for a new module id', async () => {
    const { platformConfigurationRegistry } = await import('@/config')
    platformConfigurationRegistry.getModules()
    expect(() =>
      platformConfigurationRegistry.register({
        id: 'late.test.module',
        name: 'Late',
        category: 'test',
        version: '1.0.0',
        permissions: { view: 'settings.view', edit: 'settings.manage' },
        sections: [{ id: 'late.test.module.s', title: 'S', fields: [] }],
      }),
    ).toThrow(/called after the registry was sealed/)
  })

  it('re-registering platform.overview after seal is a no-op, not an error', async () => {
    const { platformConfigurationRegistry } = await import('@/config')
    platformConfigurationRegistry.getModules()
    const existing = platformConfigurationRegistry.getModule('platform.overview')
    expect(existing).toBeDefined()
    expect(() => platformConfigurationRegistry.register(existing!)).not.toThrow()
  })

  it('@/config barrel imports platform-admin/modules; pages still import @/platform-admin', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const barrel = readFileSync(join(dir, '..', 'config', 'index.ts'), 'utf-8')
    const paPage = readFileSync(join(dir, '..', 'app', 'platform-admin', 'page.tsx'), 'utf-8')
    const paModule = readFileSync(join(dir, '..', 'app', 'platform-admin', '[moduleId]', 'page.tsx'), 'utf-8')
    const consoleIndex = readFileSync(join(dir, '..', 'app', 'console', 'settings', 'configuration', 'page.tsx'), 'utf-8')
    expect(barrel).toContain("import '@/platform-admin/modules'")
    expect(barrel.indexOf("import './modules/api'")).toBeLessThan(barrel.indexOf("import '@/platform-admin/modules'"))
    expect(paPage).toContain("import '@/platform-admin'")
    expect(paModule).toContain("import '@/platform-admin'")
    expect(consoleIndex).not.toContain('@/platform-admin')
  })
})
