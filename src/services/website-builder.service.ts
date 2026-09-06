import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import { fileToDataUrl } from '@/lib/hero-background'
import { multipartRequestConfig } from '@/lib/multipart'
import type {
  HomepageLayout,
  HomepageVersion,
  BranchContentOverrides,
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
    // Preserve tenant branding / image when present — never merge into layout theme
    branding: wb.branding,
    image: wb.image,
  }
}

export const websiteBuilderService = {
  async getLayout(tenantId: string): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = await tenantService.getTenantById(tenantId)
      return extractLayout((tenant.settings ?? {}) as Record<string, unknown>)
    }
    const { data } = await api.get<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.LAYOUT(tenantId))
    return data
  },

  async saveLayout(tenantId: string, layout: HomepageLayout): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(250)
      const savedAt = new Date().toISOString()
      const saved: HomepageLayout = { ...layout, lastSavedAt: savedAt }
      await tenantService.updateTenantSettings(tenantId, { websiteBuilder: saved })
      return saved
    }
    const { data } = await api.put<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.LAYOUT(tenantId), layout)
    return data
  },

  async publishLayout(tenantId: string, layout: HomepageLayout): Promise<HomepageLayout> {
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
      await tenantService.updateTenantSettings(tenantId, { websiteBuilder: published })
      return published
    }
    const { data } = await api.post<HomepageLayout>(ENDPOINTS.WEBSITE_BUILDER.PUBLISH(tenantId), layout)
    return data
  },

  async restoreVersion(tenantId: string, versionId: string): Promise<HomepageLayout> {
    if (USE_MOCK) {
      await delay(250)
      const tenant = await tenantService.getTenantById(tenantId)
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
      await tenantService.updateTenantSettings(tenantId, { websiteBuilder: restored })
      return restored
    }
    const { data } = await api.post<HomepageLayout>(
      ENDPOINTS.WEBSITE_BUILDER.RESTORE(tenantId, versionId),
    )
    return data
  },

  async getBranchOverrides(tenantId: string, branchId: string): Promise<BranchContentOverrides> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = await tenantService.getTenantById(tenantId)
      const overrides = (tenant.settings as Record<string, unknown>)?.branchOverrides as
        | Record<string, BranchContentOverrides>
        | undefined
      return overrides?.[branchId] ?? {}
    }
    const { data } = await api.get<BranchContentOverrides>(
      ENDPOINTS.WEBSITE_BUILDER.BRANCH_OVERRIDES(tenantId, branchId),
    )
    return data
  },

  async saveBranchOverrides(
    tenantId: string,
    branchId: string,
    overrides: BranchContentOverrides,
  ): Promise<BranchContentOverrides> {
    if (USE_MOCK) {
      await delay(250)
      const tenant = await tenantService.getTenantById(tenantId)
      const existing = ((tenant.settings as Record<string, unknown>)?.branchOverrides ?? {}) as Record<
        string,
        BranchContentOverrides
      >
      await tenantService.updateTenantSettings(tenantId, {
        branchOverrides: { ...existing, [branchId]: overrides },
      })
      return overrides
    }
    const { data } = await api.put<BranchContentOverrides>(
      ENDPOINTS.WEBSITE_BUILDER.BRANCH_OVERRIDES(tenantId, branchId),
      overrides,
    )
    return data
  },

  async uploadMedia(tenantId: string, file: File): Promise<{ url: string }> {
    if (!USE_MOCK) {
      try {
        const form = new FormData()
        form.append('image', file)
        const { data } = await api.post<{ url: string }>(
          ENDPOINTS.WEBSITE_BUILDER.MEDIA_UPLOAD(tenantId),
          form,
          multipartRequestConfig(),
        )
        if (data?.url) return data
      } catch {
        // Local data-URL so the gallery still works before the media API exists.
      }
    } else {
      await delay(150)
    }
    const url = await fileToDataUrl(file)
    return { url }
  },
}
