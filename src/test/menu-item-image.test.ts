/**
 * Menu item image picker and JSON asset-id request tests.
 */

import { describe, it, expect } from 'vitest'
import {
  validateMenuImageFile,
  MENU_IMAGE_ALLOWED_MIME_TYPES,
  MENU_IMAGE_ALLOWED_EXTENSIONS,
} from '@/components/ImageUploader'
import { menuItemFormToWriteRequest } from '@/types/menu-item'
import * as fs from 'fs'
import * as path from 'path'

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
    expect([...MENU_IMAGE_ALLOWED_MIME_TYPES]).toEqual(['image/jpeg', 'image/png'])
  })

  it('allows jpg, jpeg, png extensions', () => {
    expect([...MENU_IMAGE_ALLOWED_EXTENSIONS]).toEqual(['.jpg', '.jpeg', '.png'])
  })
})

describe('menu-item form mappers', () => {
  it('does not put File on the JSON write request', () => {
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
      is_active: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
      tag_ids: [],
    })
    expect(request.image_asset_id).toBeUndefined()
    expect(request.name).toBe('Burger')
  })

  it('maps cleared image to image_asset_id null', () => {
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
      is_active: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
      tag_ids: [],
    })
    expect(request.image_asset_id).toBeNull()
  })

  it('omits image_asset_id when unchanged on edit', () => {
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
      is_active: true,
      is_featured: false,
      is_popular: false,
      extra_group_ids: [],
      tag_ids: [],
    })
    expect(request.image_asset_id).toBeUndefined()
  })
})

describe('menu item console wiring', () => {
  it('page uses ImageUploader and JSON mapper', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../app/console/menu/page.tsx'), 'utf8')
    expect(src).toContain('ImageUploader')
    expect(src).toContain('menuItemFormToWriteRequest')
    expect(src).toContain('withUploadedImage')
  })

  it('menu service create uses JSON not FormData', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../services/menu.service.ts'), 'utf8')
    expect(src).toContain('createItem(branchId: string, payload: MenuItemWriteRequest)')
    expect(src).not.toContain('buildMenuItemFormData')
    expect(src).not.toContain('multipartRequestConfig')
  })
})
