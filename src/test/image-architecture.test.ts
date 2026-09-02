import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import {
  composeMarketplacePresentation,
  publicBranchFromDetail,
  getMarketplaceMeta,
} from '@/types/marketplace'
import { mapDiscoverTenantToItem } from '@/lib/discover-adapter'
import { resolvePublicBranchList } from '@/lib/public-branches'
import { resolveTenantImage } from '@/lib/tenant-branding'
import { buildTenantMetadata, buildBranchMetadata } from '@/utils/public-context'
import type { Branch } from '@/types/branch'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

const ROOT = join(__dirname, '..')

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('independent tenant image concepts', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('Tenant.image is logo only via resolveTenantImage', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    expect(resolveTenantImage(tenant)).toBe(tenant.image)
    expect(tenant.discoverAvatar).not.toBe(tenant.image)
    expect(tenant.discoverCover).not.toBe(tenant.image)
    expect(tenant.heroImage).not.toBe(tenant.image)
    expect(tenant.heroImage).not.toBe(tenant.discoverCover)
    expect(getMarketplaceMeta(tenant.settings)?.heroImage).toBeUndefined()
  })

  it('Discover adapter maps discoverAvatar and discoverCover from tenant, not branches', () => {
    const wire: DiscoverTenant = {
      id: 't1',
      slug: 'two-branch',
      name: 'Two Branch',
      is_active: true,
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      businessTypes: ['restaurant'],
      image: 'https://cdn/logo.png',
      discoverAvatar: 'https://cdn/avatar.png',
      discoverCover: 'https://cdn/cover.png',
      heroImage: 'https://cdn/hero.png',
      marketplace: { primaryBranchSlug: 'b2', branchCount: 2 },
      branches: [
        {
          id: 'b1',
          slug: 'b1',
          name: 'First',
          openNow: true,
          image: 'https://cdn/b1-logo.png',
          coverImage: 'https://cdn/b1-cover.png',
          heroImage: 'https://cdn/b1-hero.png',
          location: { address: '1 A', city: 'Alpha' },
          marketplaceVisible: true,
        },
        {
          id: 'b2',
          slug: 'b2',
          name: 'Second',
          openNow: true,
          image: 'https://cdn/b2-logo.png',
          coverImage: 'https://cdn/b2-cover.png',
          heroImage: 'https://cdn/b2-hero.png',
          location: { address: '2 B', city: 'Beta' },
          marketplaceVisible: true,
        },
      ],
    }
    const item = mapDiscoverTenantToItem(wire)
    expect(item.tenant.image).toBe('https://cdn/logo.png')
    expect(item.tenant.discoverAvatar).toBe('https://cdn/avatar.png')
    expect(item.tenant.discoverCover).toBe('https://cdn/cover.png')
    expect(item.tenant.heroImage).toBe('https://cdn/hero.png')
    expect(item.tenant.settings?.marketplace?.heroImage).toBeUndefined()
    expect('coverImage' in item.meta).toBe(false)
    expect(item.branches[0].logo).toBe('https://cdn/b1-logo.png')
    expect(item.branches[0].coverImage).toBe('https://cdn/b1-cover.png')
    expect(item.branches[0].heroImage).toBe('https://cdn/b1-hero.png')
    expect(item.branches[1].logo).toBe('https://cdn/b2-logo.png')
  })

  it('composeMarketplacePresentation does not copy branch images onto tenant meta', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const reversed = [...branches].reverse()
    const a = composeMarketplacePresentation({
      listing: getMarketplaceMeta(tenant.settings),
      branches,
    })
    const b = composeMarketplacePresentation({
      listing: getMarketplaceMeta(tenant.settings),
      branches: reversed,
    })
    expect('coverImage' in a).toBe(false)
    expect(a.heroImage).toBe(b.heroImage)
    expect(getMarketplaceMeta(tenant.settings)?.heroImage).toBeUndefined()
    expect(tenant.heroImage).toBeTruthy()
  })

  it('tenant homepage OG uses tenant.heroImage, not a branch image', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const listing = getMarketplaceMeta(tenant.settings)
    const { image } = buildTenantMetadata({
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantHeroImage: tenant.heroImage,
      meta: listing,
    })
    expect(image).toBe(tenant.heroImage)
    expect(image).not.toBe(listing?.heroImage)
    const branches = await resolvePublicBranchList(tenant.id)
    expect(image).not.toBe(branches[0]?.coverImage)
    expect(image).not.toBe(branches[0]?.heroImage)
  })

  it('missing tenant.heroImage uses platform OG image', () => {
    const { image } = buildTenantMetadata({
      tenantName: 'X',
      tenantSlug: 'x',
    })
    expect(image).toContain('og-image.jpg')
  })
})

describe('independent branch image concepts', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('publicBranchFromDetail keeps logo, cover, and hero separate', () => {
    const branch: Branch = {
      id: 'x',
      tenantId: 't',
      name: 'X',
      slug: 'x',
      status: 'active',
      type: 'physical',
      location: { address: '1', city: 'C', country: 'US' },
      contact: {},
      businessHours: [],
      checkout: DEFAULT_BRANCH_CHECKOUT,
      marketplaceVisible: true,
      reservationsEnabled: false,
      image: 'https://cdn/logo.png',
      coverImage: 'https://cdn/cover.png',
      heroImage: 'https://cdn/hero.png',
      created_at: '',
      updated_at: '',
    }
    const info = publicBranchFromDetail(branch)
    expect(info.logo).toBe('https://cdn/logo.png')
    expect(info.coverImage).toBe('https://cdn/cover.png')
    expect(info.heroImage).toBe('https://cdn/hero.png')
    expect(info).not.toHaveProperty('image')
    expect(info).not.toHaveProperty('avatar')
  })

  it('does not fall back cover to logo when cover is missing', () => {
    const info = publicBranchFromDetail({
      id: 'x',
      tenantId: 't',
      name: 'X',
      slug: 'x',
      status: 'active',
      type: 'physical',
      location: { address: '1', city: 'C', country: 'US' },
      contact: {},
      businessHours: [],
      checkout: DEFAULT_BRANCH_CHECKOUT,
      marketplaceVisible: true,
      reservationsEnabled: false,
      image: 'https://cdn/logo.png',
      created_at: '',
      updated_at: '',
    })
    expect(info.logo).toBe('https://cdn/logo.png')
    expect(info.coverImage).toBeUndefined()
    expect(info.heroImage).toBeUndefined()
    expect(info).not.toHaveProperty('avatar')
  })

  it('samoon main and downtown keep distinct image sets', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const main = branches.find((b) => b.slug === 'main')
    const downtown = branches.find((b) => b.slug === 'downtown')
    expect(main?.logo).toBeTruthy()
    expect(downtown?.logo).toBeTruthy()
    expect(main?.logo).not.toBe(downtown?.logo)
    expect(main?.coverImage).not.toBe(downtown?.coverImage)
    expect(main?.heroImage).not.toBe(downtown?.heroImage)
    expect(main?.logo).not.toBe(main?.coverImage)
    expect(main?.coverImage).not.toBe(main?.heroImage)
  })

  it('branch OG uses heroImage without falling back to cover or logo', () => {
    const { image } = buildBranchMetadata({
      branchName: 'Main',
      tenantName: 'Samoon',
      tenantSlug: 'samoon',
      branchSlug: 'main',
      branchHeroImage: 'https://cdn/hero.png',
    })
    expect(image).toBe('https://cdn/hero.png')
    const missing = buildBranchMetadata({
      branchName: 'Main',
      tenantName: 'Samoon',
      tenantSlug: 'samoon',
      branchSlug: 'main',
    })
    expect(missing.image).toContain('og-image.jpg')
  })
})

describe('render sources do not collapse image concepts', () => {
  it('TenantHeader uses logo branding only, not discoverAvatar or discoverCover', () => {
    const src = readSrc('components/layout/TenantHeader.tsx')
    expect(src).toContain('resolveTenantImage')
    expect(src).not.toContain('discoverAvatar')
    expect(src).not.toContain('discoverCover')
    expect(src).not.toContain('heroImage')
    expect(src).not.toContain('resolveTenantHeaderVisual')
  })

  it('Discover card uses discoverAvatar and discoverCover', () => {
    const src = readSrc('components/marketplace/BusinessCard.tsx')
    expect(src).toContain('tenant.discoverAvatar')
    expect(src).toContain('tenant.discoverCover')
    expect(src).not.toContain('resolveTenantImage')
    expect(src).not.toContain('meta.coverImage')
  })

  it('Tenant homepage avatar uses discoverCover; hero uses tenant.heroImage', () => {
    const src = readSrc('app/[tenantSlug]/TenantHomepageClient.tsx')
    expect(src).toContain('const pageAvatar = tenant.discoverCover')
    expect(src).not.toContain('const pageAvatar = tenant.discoverAvatar')
    expect(src).not.toContain('pageAvatar = tenant.image')
    expect(src).not.toContain('discoverCover ??')
    expect(src).not.toContain('discoverAvatar ??')
    expect(src).toContain('const heroBackground = tenant.heroImage')
    expect(src).not.toContain('meta.heroImage')
    expect(src).not.toContain('marketplace.heroImage')
    expect(src).not.toContain('heroImage ||')
    expect(src).not.toContain('meta.coverImage')
    expect(src).toContain('tenant.name[0]')
  })

  it('Branch homepage uses coverImage for avatar overlay and cover, heroImage for hero', () => {
    const src = readSrc('app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx')
    expect(src).toContain('branch.heroImage')
    expect(src).toContain('branch.coverImage')
    expect(src).not.toContain('branch.avatar')
    expect(src).not.toContain('branch.image')
    expect(src).not.toContain('coverImage ??')
  })

  it('Branch Information does not render coverImage; Gallery does, labeled Gallery', () => {
    const src = readSrc('app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx')
    const infoStart = src.indexOf('function BranchInfo')
    const infoEnd = src.indexOf('function BranchSwitcher')
    const branchInfo = src.slice(infoStart, infoEnd)
    expect(branchInfo).toContain("t('branchInformation')")
    expect(branchInfo).not.toContain('branch.coverImage')
    expect(branchInfo).not.toContain('branch.heroImage')
    expect(branchInfo).not.toContain('branch.image')

    expect(src).toContain('const galleryImages')
    expect(src).toMatch(/branch\.coverImage \? \[branch\.coverImage\]/)
    expect(src).toContain("label={t('businessGallery')}")
    expect(src).not.toContain('branch.avatar')

    const en = JSON.parse(readSrc('i18n/locales/en.json')) as { branch: { businessGallery: string } }
    expect(en.branch.businessGallery).toBe('Gallery')
  })
})
