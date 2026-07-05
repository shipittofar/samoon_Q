/**
 * PlatformConfigurationRegistry — P9.0 / Phase C
 *
 * Single source of truth for every configuration module in the platform.
 * Modules register themselves (Rule 2 — Registry First); nothing may read or
 * write configuration without first being declared here.
 *
 * Mirrors the sealed-after-first-read safety pattern used by the business-type
 * module registry (src/modules/registry.ts) — Next.js shares module-level state
 * across concurrent requests, so registration must happen at import time, not
 * inside a request handler or component render.
 */
import type { ConfigFieldDefinition, ConfigLifecycleState, ConfigModuleDefinition } from './types'

class PlatformConfigurationRegistryClass {
  private _modules = new Map<string, ConfigModuleDefinition>()
  private _fieldIndex = new Map<string, ConfigFieldDefinition>()
  private _sealed = false

  /**
   * Registers a module. MUST be called synchronously at import time.
   * Throws if the registry is already sealed, if the module id is already
   * registered by a genuinely different module, or if any field id collides
   * with a field already registered by another module (Rule 3 — Single
   * Source of Truth: no duplicated ids).
   *
   * P9.5.5.2 — a module whose id is already registered is treated as a
   * no-op re-registration (below), even if the registry is sealed. This
   * module-body-import file can legitimately be evaluated more than once in
   * the same process: Next.js App Router SSR resolves `import
   * './modules/<name>'` from separate webpack bundle graphs (the
   * `instrumentation.ts` startup bundle, a layout's render-time bundle, a
   * page's own lazily-loaded bundle), each of which re-runs this same
   * source file's top-level `registerAdminModule()`/`register()` call
   * against the one shared `platformConfigurationRegistry` singleton (see
   * the `globalThis` fix below this class). Without this idempotency check,
   * the second evaluation of an already-registered module would throw
   * "duplicate module id" (or "sealed", if a read happened in between) even
   * though nothing is actually wrong — it's the same module, re-describing
   * itself identically. See docs/P9.5.5.2_STARTUP_REGISTRATION.md.
   */
  register(module: ConfigModuleDefinition): void {
    if (this._modules.has(module.id)) {
      return
    }
    if (this._sealed) {
      throw new Error(
        `[PlatformConfigurationRegistry] register("${module.id}") called after the registry was sealed. ` +
          'Register configuration modules at application startup (module body), not from request handlers or component renders.',
      )
    }
    if (module.dependencies) {
      for (const dep of module.dependencies) {
        if (!this._modules.has(dep.moduleId)) {
          throw new Error(
            `[PlatformConfigurationRegistry] module "${module.id}" depends on unregistered module "${dep.moduleId}". ` +
              'Register dependencies before dependents.',
          )
        }
      }
    }
    for (const section of module.sections) {
      for (const field of section.fields) {
        if (this._fieldIndex.has(field.id)) {
          throw new Error(
            `[PlatformConfigurationRegistry] duplicate field id "${field.id}" (module "${module.id}"). ` +
              'Every configuration field must exist only once (Rule 3).',
          )
        }
        this._fieldIndex.set(field.id, field)
      }
    }
    this._modules.set(module.id, module)
  }

  private seal(): void {
    this._sealed = true
  }

  getModules(): ConfigModuleDefinition[] {
    this.seal()
    return Array.from(this._modules.values())
  }

  getModule(id: string): ConfigModuleDefinition | undefined {
    this.seal()
    return this._modules.get(id)
  }

  getField(fieldId: string): ConfigFieldDefinition | undefined {
    this.seal()
    return this._fieldIndex.get(fieldId)
  }

  getAllFields(): ConfigFieldDefinition[] {
    this.seal()
    return Array.from(this._fieldIndex.values())
  }

  /** Merged default value map keyed by dotted field id — the platform-level layer 0. */
  getDefaults(): Record<string, unknown> {
    this.seal()
    const defaults: Record<string, unknown> = {}
    for (const field of this._fieldIndex.values()) {
      defaults[field.id] = field.default
    }
    return defaults
  }

  /**
   * A module's lifecycle defaults to 'published' when omitted (P9.0.1 / Phase D).
   * Always read lifecycle through this method rather than `module.lifecycle`
   * directly, so callers never have to repeat the default-fallback logic.
   */
  getModuleLifecycle(id: string): ConfigLifecycleState {
    return this.getModule(id)?.lifecycle ?? 'published'
  }

  /** All fields across the registry matching the given lifecycle state. */
  getFieldsByLifecycle(state: ConfigLifecycleState): ConfigFieldDefinition[] {
    return this.getAllFields().filter((f) => f.lifecycle === state)
  }

  /**
   * Modules that declare a dependency on `moduleId` (P9.0.1 / Phase G).
   * The registry only stores "depends on"; this is the inverse query so a
   * future Console can warn "changing X affects: [...]" before a breaking edit.
   */
  getDependents(moduleId: string): ConfigModuleDefinition[] {
    this.seal()
    return Array.from(this._modules.values()).filter((m) =>
      m.dependencies?.some((d) => d.moduleId === moduleId),
    )
  }

  /** Test-only escape hatch — never call outside vitest. */
  __resetForTests(): void {
    this._modules = new Map()
    this._fieldIndex = new Map()
    this._sealed = false
  }
}

// P9.5.5.2 — `new PlatformConfigurationRegistryClass()` at module scope
// assumes this module's top-level code runs exactly once per process, which
// is what `_sealed`'s "first read seals" safety check depends on. That
// assumption breaks under Next.js App Router production SSR: this module
// gets evaluated multiple times in the SAME process — once per separate
// webpack chunk graph that resolves it (the `instrumentation.ts` startup
// bundle, the root layout's render-time bundle, and a page's own
// lazily-loaded bundle each got their own independent instance in
// reproduction), so "the" registry was never actually a single shared
// object. Caching the instance on `globalThis` (the same fix Next.js's own
// docs recommend for Prisma Client) makes it a true process-wide singleton
// regardless of how many times/bundles re-evaluate this module. See
// docs/P9.5.5.2_STARTUP_REGISTRATION.md.
const GLOBAL_REGISTRY_KEY = Symbol.for('samoon.platformConfigurationRegistry')
const globalStore = globalThis as unknown as Record<symbol, PlatformConfigurationRegistryClass | undefined>

export const platformConfigurationRegistry =
  globalStore[GLOBAL_REGISTRY_KEY] ?? (globalStore[GLOBAL_REGISTRY_KEY] = new PlatformConfigurationRegistryClass())
