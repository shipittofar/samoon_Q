/**
 * ConfigurationVersionManager — P9.0 / Phase E
 *
 * Tracks the schema version of each registered module and records a change
 * note per bump. Field-level `version` (see ConfigFieldDefinition.version)
 * is set by the module author when the field is introduced or changed;
 * this manager tracks module-level version history over time.
 */
import { platformConfigurationRegistry } from './registry'
import type { ConfigVersionEntry } from './types'

let history: ConfigVersionEntry[] = []

function recordVersion(moduleId: string, changeNote: string): ConfigVersionEntry {
  const mod = platformConfigurationRegistry.getModule(moduleId)
  if (!mod) throw new Error(`[ConfigurationVersionManager] unknown module "${moduleId}"`)
  const entry: ConfigVersionEntry = {
    moduleId,
    version: mod.version,
    changedAt: new Date().toISOString(),
    changeNote,
  }
  history = [entry, ...history]
  return entry
}

function historyFor(moduleId: string): ConfigVersionEntry[] {
  return history.filter((h) => h.moduleId === moduleId)
}

function currentVersion(moduleId: string): string | undefined {
  return platformConfigurationRegistry.getModule(moduleId)?.version
}

function __resetForTests(): void {
  history = []
}

export const configurationVersionManager = {
  recordVersion,
  historyFor,
  currentVersion,
  __resetForTests,
}
