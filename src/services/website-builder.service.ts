import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import type {
  HomepageLayout,
  HomepageVersion,
  ThemeSettings,
  BranchContentOverrides,
  DEFAULT_LAYOUT,
} from '@/types/website-builder'
import { DEFAULT_SECTIONS, DEFAULT_HERO, DEFAULT_THEME } from '@/types/website-builder'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

function defaultLayout(): HomepageLayout {
  return {
    sections: DEFAULT_SECTIONS.map((s) => ({ ...s })),
    hero: { ...DEFAULT_HERO },
    about: {},
    contact: {},
    faq: [],
    theme: { ...DEFAULT_THEME },
    status: 'draft',
    versions: [],
  }
}

function extractLayout(settings: Record<string, unknown>): HomepageLayout {
  const wb = settings.websiteBuilder as HomepageLayout | undefined
  if (!wb) return defaultLayout()
  return {
    ...defaultLayout(),
    ...wb,
    sections: wb.sections ?? DEFAULT_SECTIONS.map((s) => ({ ...s })),
    hero: { ...DEFAULT_HERO, ...wb.hero },
    theme: { ...DEFAULT_THEME, ...wb.theme },
  }
}

export const websiteBuilderService = {
  async getLayout(tenantSlug: string): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = await tenantService.getTenant(tenantSlug)
      return extractLayout((tenant.settings ?? {}) as Record<string, unknown>)
    }
    const { data } = await api.get<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.LAYOUT(tenantSlug))
    return data
  },

  async saveLayout(tenantSlug: string, layout: HomepageLayout): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(250)
      const savedAt = new Date().toISOString()
      const saved: HomepageLayout = { ...layout, lastSavedAt: savedAt }
      await tenantService.updateTenantSettings(tenantSlug, { websiteBuilder: saved })
      return saved
    }
    const { data } = await api.put<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.LAYOUT(tenantSlug), layout)
    return data
  },

  async publishLayout(tenantSlug: string, layout: HomepageLayout): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(350)
      const now = new Date().toISOString()
      const version: HomepageVersion = {
        id: `v-${Date.now()}`,
        savedAt: now,
        sections: layout.sections,
        hero: layout.hero,
        about: layout.about,
        contact: layout.contact,
        faq: layout.faq,
        theme: layout.theme,
      }
      const published: HomepageLayout = {
        ...layout,
        status: 'published',
        lastPublishedAt: now,
        lastSavedAt: now,
        publishedVersion: version,
        versions: [version, ...(layout.versions ?? [])].slice(0, 10),
      }
      await tenantService.updateTenantSettings(tenantSlug, { websiteBuilder: published })
      return published
    }
    const { data } = await api.post<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.PUBLISH(tenantSlug), layout)
    return data
  },

  async restoreVersion(tenantSlug: string, versionId: string): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(250)
      const tenant = await tenantService.getTenant(tenantSlug)
      const layout = extractLayout((tenant.settings ?? {}) as Record<string, unknown>)
      const version = layout.versions?.find((v) => v.id === versionId)
      if (!version) throw new Error('Version not found')
      const restored: HomepageLayout = {
        ...layout,
        sections: version.sections,
        hero: version.hero,
        about: version.about,
        contact: version.contact,
        faq: version.faq,
        theme: version.theme,
        status: 'draft',
        lastSavedAt: new Date().toISOString(),
      }
      await tenantService.updateTenantSettings(tenantSlug, { websiteBuilder: restored })
      return restored
    }
    const { data } = await api.post<HomepageLayout>(
      ENDPOINTS.WEBSITE_BUILDER.RESTORE(tenantSlug, versionId),
    )
    return data
  },

  async getBranchOverrides(tenantSlug: string, branchSlug: string): Promise<BranchContentOverrides> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = await tenantService.getTenant(tenantSlug)
      const overrides = (tenant.settings as Record<string, unknown>)?.branchOverrides as
        | Record<string, BranchContentOverrides>
        | undefined
      return overrides?.[branchSlug] ?? {}
    }
    const { data } = await api.get<BranchContentOverrides>(
      ENDPOINTS.WEBSITE_BUILDER.BRANCH_OVERRIDES(tenantSlug, branchSlug),
    )
    return data
  },

  async saveBranchOverrides(
    tenantSlug: string,
    branchSlug: string,
    overrides: BranchContentOverrides,
  ): Promise<BranchContentOverrides> {
    if (USE_MOCK) {
      await delay(250)
      const tenant = await tenantService.getTenant(tenantSlug)
      const existing = ((tenant.settings as Record<string, unknown>)?.branchOverrides ?? {}) as Record<
        string,
        BranchContentOverrides
      >
      await tenantService.updateTenantSettings(tenantSlug, {
        branchOverrides: { ...existing, [branchSlug]: overrides },
      })
      return overrides
    }
    const { data } = await api.put<BranchContentOverrides>(
      ENDPOINTS.WEBSITE_BUILDER.BRANCH_OVERRIDES(tenantSlug, branchSlug),
      overrides,
    )
    return data
  },
}
