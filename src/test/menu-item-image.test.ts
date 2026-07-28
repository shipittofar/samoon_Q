/**
 * Menu item image picker and multipart request tests.
 */

import { describe, it, expect } from 'vitest'
import {
  validateMenuImageFile,
  MENU_IMAGE_ALLOWED_MIME_TYPES,
  MENU_IMAGE_ALLOWED_EXTENSIONS,
} from '@/components/ImageUploader'
import { buildMenuItemFormData, menuItemFormToWriteRequest } from '@/types/menu-item'

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateMenuImageFile', () => {
  it('accepts JPEG by MIME and extension', () => {
    const file = makeFile('photo.jpg', 'image/jpeg')
    expect(validateMenuImageFile(file)).toEqual({ valid: true })
  })

  it('accepts PNG by MIME and extension', () => {
    const file = makeFile('photo.png', 'image/png')
    expect(validateMenuImageFile(file)).toEqual({ valid: true })
  })

  it('rejects WebP MIME type', () => {
    const file = makeFile('photo.webp', 'image/webp')
    expect(validateMenuImageFile(file).valid).toBe(false)
    expect(validateMenuImageFile(file).errorKey).toBe('unsupportedFileType')
  })

  it('rejects files over 5 MB', () => {
    const file = makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)
    expect(validateMenuImageFile(file).valid).toBe(false)
    expect(validateMenuImageFile(file).errorKey).toBe('fileTooLarge')
  })
})

describe('menu item image constants', () => {
  it('allows only jpeg and png MIME types', () => {
    expect(MENU_IMAGE_ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png'])
  })

  it('allows jpg, jpeg, png extensions', () => {
    expect(MENU_IMAGE_ALLOWED_EXTENSIONS).toEqual(['.jpg', '.jpeg', '.png'])
  })
})

describe('menu-item form mappers', () => {
  it('maps form with file to write request with File image', () => {
    const file = makeFile('burger.png', 'image/png')
    const request = menuItemFormToWriteRequest({
      name: 'Burger',
      description: 'Tasty',
      price: '12',
      discount: '',
      calories: '',
      preparation_time: '15',
      image: { file, existingUrl: '', cleared: false },
      category_id: 'cat-1',
      available: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
    })
    expect(request.image).toBe(file)
    expect(request.name).toBe('Burger')
  })

  it('maps cleared image to removeImage flag', () => {
    const request = menuItemFormToWriteRequest({
      name: 'Burger',
      description: '',
      price: '10',
      discount: '',
      calories: '',
      preparation_time: '10',
      image: { file: null, existingUrl: 'https://cdn.example.com/old.jpg', cleared: true },
      category_id: 'cat-1',
      available: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
    })
    expect(request.removeImage).toBe(true)
    expect(request.image).toBeUndefined()
  })

  it('omits image when unchanged on edit', () => {
    const request = menuItemFormToWriteRequest({
      name: 'Burger',
      description: '',
      price: '10',
      discount: '',
      calories: '',
      preparation_time: '10',
      image: { file: null, existingUrl: 'https://cdn.example.com/old.jpg', cleared: false },
      category_id: 'cat-1',
      available: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
    })
    expect(request.image).toBeUndefined()
    expect(request.removeImage).toBeUndefined()
  })
})

describe('buildMenuItemFormData', () => {
  it('appends scalar fields and image File for create', () => {
    const file = makeFile('item.jpg', 'image/jpeg')
    const form = buildMenuItemFormData(
      {
        name: 'Burger',
        price: 12,
        category_id: 'cat-1',
        image: file,
      },
      { branchId: 'branch-1' },
    )

    expect(form.get('branch_id')).toBe('branch-1')
    expect(form.get('name')).toBe('Burger')
    expect(form.get('price')).toBe('12')
    expect(form.get('category_id')).toBe('cat-1')
    expect(form.get('image')).toBe(file)
  })

  it('appends empty image when removeImage is set', () => {
    const form = buildMenuItemFormData({ removeImage: true })
    expect(form.get('image')).toBe('')
  })
})

describe('console menu page — ImageUploader integration', () => {
  it('uses ImageUploader and multipart write request mapper', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src/app/console/menu/page.tsx'),
      'utf8',
    )
    expect(page).toContain('ImageUploader')
    expect(page).not.toMatch(/imageUrlLabel.*form\.image/)
    expect(page).toContain('menuItemFormToWriteRequest')
    expect(page).toContain('menuItemToFormInput')
  })
})

describe('menu.service — multipart create/update', () => {
  it('builds FormData and does not set multipart Content-Type header', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/services/menu.service.ts'),
      'utf8',
    )
    expect(src).toContain('buildMenuItemFormData')
    expect(src).toContain("formData = buildMenuItemFormData")
    expect(src).toContain('multipartRequestConfig')
    expect(src).not.toContain('multipart/form-data')
    expect(src).not.toContain('fileToImageDataUrl')
    expect(src).not.toContain('menu-image.service')
  })
})
