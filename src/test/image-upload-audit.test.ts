/**
 * Repository-wide image upload architecture tests after direct-storage migration.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')
function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

describe('category image upload', () => {
  it('category form uses ImageUploader not image URL input', () => {
    const formFields = read('src/components/console/CategoryFormFields.tsx')
    expect(formFields).toContain('ImageUploader')
    expect(formFields).not.toMatch(/imageUrlLabel.*form\.image/)
    const page = read('src/app/console/categories/page.tsx')
    expect(page).toContain('categoryFormToWriteRequest')
    expect(page).toContain('CategoryCreateModal')
    expect(page).toContain('withUploadedImage')
  })

  it('menu service createCategory uses JSON', () => {
    const src = read('src/services/menu.service.ts')
    expect(src).not.toContain('buildCategoryFormData')
    expect(src).toContain('createCategory(branchId: string, payload: CategoryWriteRequest)')
  })
})

describe('extra image upload', () => {
  it('extras page uses ImageUploader not image URL input', () => {
    const page = read('src/app/console/extras/page.tsx')
    expect(page).toContain('ImageUploader')
    expect(page).not.toMatch(/imageUrlLabel.*form\.image/)
    expect(page).toContain('extraFormToWriteRequest')
    expect(page).toContain('withUploadedImage')
  })
})

describe('avatar image upload', () => {
  it('settings page uses ImageUploader', () => {
    const page = read('src/app/dashboard/settings/page.tsx')
    expect(page).toContain('ImageUploader')
    expect(page).not.toContain('image/webp')
  })

  it('uploadAvatar uses the shared upload service', () => {
    const src = read('src/services/combined.service.ts')
    expect(src).toContain("purpose: 'user_avatar'")
    expect(src).toContain('avatar_asset_id')
    expect(src).not.toContain("form.append('avatar', file)")
  })
})

describe('branch image upload', () => {
  it('branch forms use ImageUploader not image URL input', () => {
    const src = read('src/app/console/branches/BranchFormFields.tsx')
    expect(src).toContain('ImageUploader')
    expect(src).not.toMatch(/imageUrlLabel.*form\.image/)
    expect(src).toContain('branchFormToWriteRequest')
    expect(src).toContain('form.image')
    expect(src).toContain('form.coverImage')
    expect(src).toContain('form.heroImage')
    expect(src).not.toContain('form.avatar')
    expect(src).not.toContain('branch.avatar')
    expect(src).not.toContain('showSlug')
    expect(src).not.toContain('branch-slug')
    expect(src).not.toContain('form.slug')
  })

  it('edit form state omits slug; Branch display still reads slug', () => {
    expect(read('src/types/branch-form.ts')).not.toMatch(/export interface BranchWriteRequest \{[\s\S]{0,80}slug\?:/)
    expect(read('src/app/console/branches/[id]/edit/page.tsx')).not.toContain('showSlug')
    expect(read('src/app/console/branches/[id]/page.tsx')).toContain('branch.slug')
    expect(read('src/types/branch.ts')).toContain('slug: string')
    expect(read('src/types/branch-form.ts')).toContain('EMPTY_BRANCH_FORM')
    expect(read('src/types/branch-form.ts')).not.toMatch(/EMPTY_BRANCH_FORM[\s\S]{0,80}slug/)
  })

  it('branch service create uses JSON asset IDs', () => {
    const src = read('src/services/branch.service.ts')
    expect(src).not.toContain('buildBranchFormData')
    expect(src).not.toContain('multipartRequestConfig()')
    expect(src).toContain('image_asset_id')
  })
})

describe('remaining URL-based image inputs', () => {
  it('console tenant listing does not use ImageUploader or branch cover for public profile media', () => {
    const src = read('src/app/console/settings/page.tsx')
    expect(src).not.toContain('coverImageUrlLabel')
    expect(src).not.toContain('ImageUploader')
    expect(src).not.toContain('heroImage: heroImage')
  })
})

describe('removed incorrect flows', () => {
  it('does not contain fileToImageDataUrl or pre-upload services', () => {
    expect(read('src/services/menu.service.ts')).not.toContain('fileToImageDataUrl')
    expect(read('src/services/combined.service.ts')).not.toContain('menu-image.service')
    expect(read('src/services/endpoints.ts')).not.toContain('ITEM_IMAGE_UPLOAD')
  })
})
