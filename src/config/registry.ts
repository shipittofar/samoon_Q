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
   * registered, or if any field id collides with a field already registered
   * by another module (Rule 3 — Single Source of Truth: no duplicated ids).
   */
  register(module: ConfigModuleDefinition): void {
    if (this._sealed) {
      throw new Error(
        `[PlatformConfigurationRegistry] register("${module.id}") called after the registry was sealed. ` +
          'Register configuration modules at application startup (module body), not from request handlers or component renders.',
      )
    }
    if (this._modules.has(module.id)) {
      throw new Error(`[PlatformConfigurationRegistry] duplicate module id "${module.id}"`)
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

export const platformConfigurationRegistry = new PlatformConfigurationRegistryClass()
