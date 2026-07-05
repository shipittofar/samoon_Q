/**
 * Platform Search Provider Registry — P9.4 Phase F
 *
 * Generic, pluggable cross-entity search — extends the P9.3 command
 * palette (which already searches every registered module and field)
 * with a second axis: searching the *entities inside* a collection field
 * (P9.2) rather than only the field itself. A provider never touches
 * React/router — it returns which module a hit belongs to, and the
 * palette (which already knows how to navigate to a module) decides what
 * "select this hit" means. This keeps the registry framework-pure, the
 * same way `PlatformConfigurationRegistry`/`platformDashboardRegistry`
 * never import a component.
 */
export interface PlatformSearchHit {
  id: string
  label: string
  hint?: string
  /** Which registered module to open when this hit is selected. */
  moduleId: string
}

export interface PlatformSearchProvider {
  id: string
  label: string
  search: (query: string) => PlatformSearchHit[]
}

class PlatformSearchRegistry {
  private providers = new Map<string, PlatformSearchProvider>()

  register(provider: PlatformSearchProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`[PlatformSearchRegistry] duplicate search provider id "${provider.id}"`)
    }
    this.providers.set(provider.id, provider)
  }

  getProviders(): PlatformSearchProvider[] {
    return Array.from(this.providers.values())
  }

  /** Runs every registered provider and merges results — the palette's single search entry point for cross-entity results. */
  searchAll(query: string): PlatformSearchHit[] {
    if (!query.trim()) return []
    return this.getProviders().flatMap((p) => p.search(query))
  }

  __resetForTests(): void {
    this.providers.clear()
  }
}

export const platformSearchRegistry = new PlatformSearchRegistry()
