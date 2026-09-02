/**
 * Tenant Branding contract — shared helpers, types, and write sanitization.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveTenantBranding,
  resolveTenantImage,
  resolveFontCssFamily,
  sanitizeBrandingForWrite,
} from '@/lib/tenant-branding'
import type { TenantBranding } from '@/types'
import type { HomepageLayout } from '@/types/website-builder'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('TenantBranding type shape', () => {
  it('allows optional/null fields and dynamic locale keys', () => {
    const branding: TenantBranding = {
      primaryColor: null,
      accentHoverColor: undefined,
      fontBody: 'inter',
      fontsByLocale: { en: 'inter', fa: 'vazir', 'zh-CN': 'noto-sans-sc' },
    }
    expect(branding.fontsByLocale?.fa).toBe('vazir')
    expect(branding.primaryColor).toBeNull()
  })
})

describe('resolveTenantBranding', () => {
  it('prefers branding over legacy theme and settings.theme', () => {
    const resolved = resolveTenantBranding({
      branding: { primaryColor: '#111111' },
      theme: { primaryColor: '#222222' },
      settings: { theme: { primaryColor: '#333333' } },
    })
    expect(resolved?.primaryColor).toBe('#111111')
  })

  it('uses settings.theme for Tenant CRUD shape', () => {
    const resolved = resolveTenantBranding({
      settings: { theme: { primaryColor: '#e85d04', fontBody: 'inter' } },
    })
    expect(resolved?.primaryColor).toBe('#e85d04')
    expect(resolved?.fontBody).toBe('inter')
  })

  it('falls back to Discover legacy theme when branding empty', () => {
    const resolved = resolveTenantBranding({
      branding: {},
      theme: { primaryColor: '#abcdef' },
    })
    expect(resolved?.primaryColor).toBe('#abcdef')
  })
})

describe('resolveTenantImage', () => {
  it('reads top-level image only', () => {
    expect(resolveTenantImage({ image: 'https://cdn/logo.png' })).toBe('https://cdn/logo.png')
    expect(resolveTenantImage({ image: 'https://cdn/logo.png', discoverAvatar: 'https://cdn/av.png' } as { image: string })).toBe('https://cdn/logo.png')
    expect(resolveTenantImage({})).toBeUndefined()
    expect(resolveTenantImage(null)).toBeUndefined()
  })
})

describe('resolveFontCssFamily', () => {
  it('maps catalog font ids to CSS stacks', () => {
    expect(resolveFontCssFamily('inter')).toContain('Inter')
    expect(resolveFontCssFamily('vazir')).toContain('Vazirmatn')
  })

  it('prefers fontsByLocale for the active locale', () => {
    const css = resolveFontCssFamily('inter', {
      locale: 'fa',
      fontsByLocale: { fa: 'vazirmatn' },
    })
    expect(css).toContain('Vazirmatn')
  })

  it('passes through legacy CSS stacks', () => {
    expect(resolveFontCssFamily('"Inter", sans-serif')).toBe('"Inter", sans-serif')
  })
})

describe('sanitizeBrandingForWrite', () => {
  it('keeps branding fields and strips logo keys', () => {
    const cleaned = sanitizeBrandingForWrite({
      primaryColor: '#1a1a2e',
      accentHoverColor: '#e85d04',
      fontBody: 'inter',
      fontsByLocale: { en: 'inter' },
      logoUrl: 'https://evil/logo.png',
      logo: 'x',
    } as TenantBranding & Record<string, unknown>)
    expect(cleaned).toEqual({
      primaryColor: '#1a1a2e',
      accentHoverColor: '#e85d04',
      fontBody: 'inter',
      fontsByLocale: { en: 'inter' },
    })
    expect('logoUrl' in cleaned).toBe(false)
    expect('logo' in cleaned).toBe(false)
  })
})

describe('Public Website layout keeps branding separate from theme', () => {
  it('HomepageLayout types branding and theme separately', () => {
    const layout: HomepageLayout = {
      sections: [],
      hero: {},
      about: {},
      contact: {},
      faq: [],
      theme: { borderRadius: 'xl', cardStyle: 'elevated', darkModePreference: 'system' },
      branding: { primaryColor: '#1a1a2e', fontBody: 'inter' },
      image: 'https://cdn/logo.png',
      status: 'draft',
    }
    expect(layout.theme.borderRadius).toBe('xl')
    expect(layout.theme).not.toHaveProperty('fontBody')
    expect(layout.branding?.primaryColor).toBe('#1a1a2e')
    expect(layout.image).toBeTruthy()
  })

  it('website-builder extractLayout preserves branding and image', () => {
    const src = readFileSync(
      join(__dirname, '..', 'services', 'website-builder.service.ts'),
      'utf8',
    )
    expect(src).toContain('branding: wb.branding')
    expect(src).toContain('image: wb.image')
    expect(src).toContain('never merge into layout theme')
  })
})

describe('legacy logo paths are not canonical', () => {
  it('TenantHeader does not read theme.logoUrl', () => {
    const src = readFileSync(
      join(__dirname, '..', 'components', 'layout', 'TenantHeader.tsx'),
      'utf8',
    )
    expect(src).toContain('resolveTenantImage')
    expect(src).toContain('tenantImage')
    expect(src).not.toContain('theme?.logoUrl')
    expect(src).not.toContain('settings?.theme?.logoUrl')
  })

  it('settings BrandingTab does not write logoUrl into theme', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'console', 'settings', 'page.tsx'), 'utf8')
    expect(src).toContain('sanitizeBrandingForWrite')
    expect(src).toContain('resolveTenantImage')
    expect(src).not.toMatch(/logoUrl:\s*logoUrl/)
  })

  it('Create Tenant wizard wires logoFile through ImageUploader to provision image', () => {
    const wizard = readFileSync(join(__dirname, '..', 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
    const step = readFileSync(
      join(__dirname, '..', 'components', 'admin', 'tenant-provisioning', 'BrandingDefaultsStep.tsx'),
      'utf8',
    )
    expect(step).toContain('ImageUploader')
    expect(step).toContain('logoFile')
    expect(step).toContain('onLogoFileChange')
    expect(step).not.toContain('logoUrl')
    expect(wizard).toContain('logoFile')
    expect(wizard).toContain('image: logoFile')
    expect(wizard).not.toContain('logoUrl')
  })
})

describe('buildTenantProvisionFormData', () => {
  it('puts File on image and branding under settings; omits logoUrl', async () => {
    const { buildTenantProvisionFormData } = await import('@/services/tenant-provisioning.service')
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    const form = buildTenantProvisionFormData({
      name: 'Cafe',
      businessType: 'cafe',
      settings: {
        featureFlags: { 'menu.enabled': true },
        theme: {
          primaryColor: '#1a1a2e',
          accentHoverColor: '#e85d04',
          fontBody: 'inter',
          fontsByLocale: { en: 'inter' },
        },
      },
      image: file,
    })
    expect(form.get('name')).toBe('Cafe')
    expect(form.get('image')).toBeInstanceOf(File)
    expect(form.get('image')).toBe(file)
    expect(form.has('logoUrl')).toBe(false)
    const settingsRaw = form.get('settings')
    expect(typeof settingsRaw).toBe('string')
    const settings = JSON.parse(settingsRaw as string)
    expect(settings.theme.primaryColor).toBe('#1a1a2e')
    expect(settings.theme.fontBody).toBe('inter')
    expect(settings.theme.logoUrl).toBeUndefined()
    expect(settings.theme.logo).toBeUndefined()
  })
})
