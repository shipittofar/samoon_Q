/**
 * P9.5.5.1 — Localization Runtime Recovery regression test.
 *
 * Reproduces the exact hazard that caused the reported crashes
 * (`unknown field: languages.supported` / `register("countries") called
 * after the registry was sealed`): a config-touching module importing
 * `platformConfigurationRegistry`/`configurationService` from a submodule
 * path (`@/config/registry`, `@/config/service`) instead of the `@/config`
 * barrel never triggers the barrel's `import './modules/<name>'` side
 * effects, so calling a getter (which seals the registry as its first
 * action) before the barrel has run leaves core fields unregistered and
 * permanently locks the registry against them.
 *
 * This test forces the worst-case ordering — resolving a `languages.*`
 * field via `src/i18n/runtime.ts` BEFORE anything has imported `@/config`
 * — and asserts it still works, proving `runtime.ts` (and
 * `platform-admin/register-module.ts` / `platform-admin/widgets.ts`, fixed
 * the same way) no longer depend on import order.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('P9.5.5.1 — registration order independence', () => {
  beforeEach(async () => {
    // Forces every module (including '@/config' and its core module side
    // effects) to re-evaluate from scratch, so each test can control which
    // module touches the registry first, exactly like a fresh server process.
    vi.resetModules()
    // P9.5.5.2 — the registry singleton itself now lives on `globalThis`
    // (see src/config/registry.ts) so it survives `vi.resetModules()` on
    // purpose — that's the whole point of the fix (one true singleton
    // across separately re-evaluated bundles). Test isolation between
    // cases in this file/suite therefore needs an explicit reset too.
    const { platformConfigurationRegistry } = await import('@/config/registry')
    platformConfigurationRegistry.__resetForTests()
  })

  it('resolving a languages.* field via i18n/runtime.ts works even if it is the first thing to touch config', async () => {
    // No prior `import '@/config'` in this test — `runtime.ts` must pull in
    // the whole barrel itself via its own top-level import.
    const { resolveSupportedLocales, resolveDefaultLocale, resolveRTLLocales } = await import('@/i18n/runtime')

    expect(() => resolveSupportedLocales()).not.toThrow()
    expect(resolveSupportedLocales().length).toBeGreaterThan(0)
    expect(resolveDefaultLocale()).toBe('en')
    expect(Array.isArray(resolveRTLLocales())).toBe(true)
  })

  it('the registry is not sealed-without-fields after runtime.ts resolves a field first', async () => {
    const { resolveSupportedLocales } = await import('@/i18n/runtime')
    resolveSupportedLocales()

    // Emulates a later `import '@/config'` (e.g. a route rendering
    // /platform-admin in the same process) — must not throw
    // "register(...) called after the registry was sealed".
    const { platformConfigurationRegistry: registryFromBarrel } = await import('@/config')
    expect(registryFromBarrel.getModule('countries')).toBeDefined()
    expect(registryFromBarrel.getField('languages.supported')).toBeDefined()
    expect(registryFromBarrel.getModule('platform.overview')).toBeDefined()
  })

  it('platform-admin registration (register-module.ts) also forces the barrel first, regardless of import order', async () => {
    // Mirrors the platform-admin half of the fix: importing '@/platform-admin'
    // as the very first config-touching import in the process must not
    // throw "register(...) called after the registry was sealed", and every
    // core module + platform-admin module must resolve afterward.
    const { platformConfigurationRegistry: registry } = await import('@/config/registry')
    await expect(import('@/platform-admin')).resolves.toBeDefined()

    expect(registry.getModule('countries')).toBeDefined()
    expect(registry.getModule('languages')).toBeDefined()
    expect(registry.getField('languages.supported')).toBeDefined()
    expect(registry.getModule('platform.overview')).toBeDefined()
  })
})
