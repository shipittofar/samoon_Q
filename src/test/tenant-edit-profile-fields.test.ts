import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  SOCIAL_PREFIX,
  WEBSITE_PREFIX,
  applyPrefixInput,
  galleryUrlsFromImageFields,
  initPrefixedField,
  valueForPrefixedSave,
} from '@/lib/prefixed-input'
import { EMPTY_IMAGE_FIELD, type ImageFieldValue } from '@/components/ImageUploader'

const ROOT = join(__dirname, '..')
const FORM = readFileSync(join(ROOT, 'components', 'admin', 'TenantCanonicalSettingsForm.tsx'), 'utf8')

describe('Edit Tenant — description', () => {
  it('loads and saves Tenant.description (not a duplicate field)', () => {
    expect(FORM).toContain('id="tenant-edit-description"')
    expect(FORM).toContain('useState(tenant.description ?? \'\')')
    expect(FORM).toContain('setDescription(tenant.description ?? \'\')')
    expect(FORM).toContain('description: description.trim() || undefined')
    expect(FORM).toContain("t('tenantDescriptionLabel')")
    expect(FORM).not.toMatch(/marketplace\.description/)
  })
})

describe('Edit Tenant — website prefix', () => {
  it('empty website starts with www. without stacking', () => {
    expect(initPrefixedField('', WEBSITE_PREFIX)).toBe('www.')
    expect(initPrefixedField('www.example.com', WEBSITE_PREFIX)).toBe('www.example.com')
    expect(initPrefixedField('https://samoon.com', WEBSITE_PREFIX)).toBe('https://samoon.com')
    expect(applyPrefixInput('', WEBSITE_PREFIX)).toBe('www.')
    expect(applyPrefixInput('www.www.example.com', WEBSITE_PREFIX)).toBe('www.example.com')
    expect(applyPrefixInput('www.example.com', WEBSITE_PREFIX)).toBe('www.example.com')
    expect(valueForPrefixedSave('www.', WEBSITE_PREFIX)).toBeUndefined()
    expect(FORM).toContain('id="tenant-website"')
    expect(FORM).toContain('applyPrefixInput(e.target.value, WEBSITE_PREFIX)')
  })
})

describe('Edit Tenant — social @ prefix', () => {
  const fields = ['instagram', 'twitter', 'facebook', 'youtube'] as const

  it.each(fields)('empty %s starts with @ and does not duplicate', (field) => {
    expect(initPrefixedField('', SOCIAL_PREFIX)).toBe('@')
    expect(initPrefixedField('@username', SOCIAL_PREFIX)).toBe('@username')
    expect(applyPrefixInput('', SOCIAL_PREFIX)).toBe('@')
    expect(applyPrefixInput('@@username', SOCIAL_PREFIX)).toBe('@username')
    expect(applyPrefixInput('@username', SOCIAL_PREFIX)).toBe('@username')
    expect(valueForPrefixedSave('@', SOCIAL_PREFIX)).toBeUndefined()
    expect(FORM).toContain(`id="tenant-${field}"`)
    expect(FORM).toContain(`applyPrefixInput(e.target.value, SOCIAL_PREFIX)`)
  })
})

describe('Edit Tenant — gallery ImageUploader', () => {
  it('reuses ImageUploader for marketplace.gallery URLs', () => {
    expect(FORM).toContain('id={`tenant-gallery-${index}`}')
    expect(FORM).toContain('<ImageUploader')
    expect(FORM).toContain('persistableMediaUrl')
    expect(FORM).toContain('setGalleryFields((prev) => [...prev, { ...EMPTY_IMAGE_FIELD }])')
    expect(FORM).not.toMatch(/textarea value=\{gallery\}/)
  })

  it('keeps existing URLs when adding another slot and drops cleared images', () => {
    const existing: ImageFieldValue = { ...EMPTY_IMAGE_FIELD, existingUrl: 'https://cdn.example/a.jpg' }
    const emptyNew: ImageFieldValue = { ...EMPTY_IMAGE_FIELD }
    const added = [existing, emptyNew]
    expect(galleryUrlsFromImageFields(added, () => 'https://cdn.example/new.jpg')).toEqual(['https://cdn.example/a.jpg'])

    const withFile: ImageFieldValue = { file: new File(['x'], 'b.png', { type: 'image/png' }), existingUrl: '', cleared: false }
    expect(
      galleryUrlsFromImageFields([existing, withFile], (file) => `mock://${file.name}`),
    ).toEqual(['https://cdn.example/a.jpg', 'mock://b.png'])

    const removed: ImageFieldValue = { ...existing, cleared: true }
    expect(galleryUrlsFromImageFields([removed, withFile], (file) => `mock://${file.name}`)).toEqual(['mock://b.png'])
  })
})
