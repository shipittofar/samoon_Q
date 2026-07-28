/**
 * Repository-wide image upload architecture audit tests.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(128)], name, { type })
}

describe('shared multipart utilities', () => {
  it('exports multipartRequestConfig that strips Content-Type for FormData', async () => {
    const { multipartRequestConfig } = await import('@/lib/multipart')
    const config = multipartRequestConfig()
    const headers: Record<string, unknown> = { 'Content-Type': 'application/json' }
    const form = new FormData()
    form.append('image', makeFile('a.jpg', 'image/jpeg'))
    config.transformRequest![0](form, headers)
    expect(headers['Content-Type']).toBeUndefined()
  })
})

describe('category image upload', () => {
  it('buildCategoryFormData appends image File', async () => {
    const { buildCategoryFormData } = await import('@/types/category')
    const file = makeFile('cat.jpg', 'image/jpeg')
    const form = buildCategoryFormData({ name: 'Sides', image: file }, { branchId: 'b1' })
    expect(form.get('name')).toBe('Sides')
    expect(form.get('branch_id')).toBe('b1')
    expect(form.get('image')).toBe(file)
  })

  it('categories page uses ImageUploader not image URL input', () => {
    const page = read('src/app/console/categories/page.tsx')
    expect(page).toContain('ImageUploader')
    expect(page).not.toMatch(/imageUrlLabel.*form\.image/)
    expect(page).toContain('categoryFormToWriteRequest')
  })

  it('menu service createCategory uses FormData', () => {
    const src = read('src/services/menu.service.ts')
    expect(src).toContain('buildCategoryFormData')
    expect(src).toContain('createCategory(branchId: string, payload: CategoryWriteRequest)')
  })
})

describe('extra image upload', () => {
  it('buildExtraFormData appends image File and group_id', async () => {
    const { buildExtraFormData } = await import('@/types/extra')
    const file = makeFile('extra.png', 'image/png')
    const form = buildExtraFormData(
      { name: 'Cheese', price: 1.5, group_id: 'g1', image: file },
      { branchId: 'b1' },
    )
    expect(form.get('image')).toBe(file)
    expect(form.get('group_id')).toBe('g1')
  })

  it('extras page uses ImageUploader not image URL input', () => {
    const page = read('src/app/console/extras/page.tsx')
    expect(page).toContain('ImageUploader')
    expect(page).not.toMatch(/imageUrlLabel.*form\.image/)
    expect(page).toContain('extraFormToWriteRequest')
  })
})

describe('avatar image upload', () => {
  it('settings page uses ImageUploader', () => {
    const page = read('src/app/dashboard/settings/page.tsx')
    expect(page).toContain('ImageUploader')
    expect(page).not.toContain('type="file"')
    expect(page).not.toContain('image/webp')
  })

  it('uploadAvatar uses FormData without manual multipart Content-Type', () => {
    const src = read('src/services/combined.service.ts')
    expect(src).toContain("form.append('avatar', file)")
    expect(src).toContain('multipartRequestConfig()')
    expect(src).not.toContain("'Content-Type': 'multipart/form-data'")
    expect(src).toContain('validateMenuImageFile')
  })
})

describe('remaining URL-based image inputs', () => {
  it('branch forms still use URL text fields (backend URL contract)', () => {
    const src = read('src/app/console/branches/BranchFormFields.tsx')
    expect(src).toContain('imageUrlLabel')
    expect(src).not.toContain('ImageUploader')
  })
})

describe('removed incorrect flows', () => {
  it('does not contain fileToImageDataUrl or pre-upload services', () => {
    expect(read('src/services/menu.service.ts')).not.toContain('fileToImageDataUrl')
    expect(read('src/services/combined.service.ts')).not.toContain('menu-image.service')
    expect(read('src/services/endpoints.ts')).not.toContain('ITEM_IMAGE_UPLOAD')
  })
})
