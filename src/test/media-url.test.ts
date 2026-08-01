/**
 * Canonical media URL resolution for backend storage keys.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { resolveMediaUrl, getMediaBaseUrl } from '@/utils/media-url'
import { normalizeMenuItem } from '@/lib/menu-normalizers'
import { normalizeCartItem } from '@/lib/cart-normalizers'
import { normalizeOrderItem } from '@/lib/order-normalizers'

const STORAGE_KEY = 'menu_items/24c9616ad92e4efdaf83d59ca1f3f30d.webp'

describe('resolveMediaUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves storage keys against NEXT_PUBLIC_MEDIA_BASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://media.example.com')
    expect(resolveMediaUrl(STORAGE_KEY)).toBe(
      `https://media.example.com/${STORAGE_KEY}`,
    )
  })

  it('resolves storage keys against platform config when env is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', '')
    expect(resolveMediaUrl('menu_items/test.webp')).toBe(
      'https://cdn.samoon.app/menu_items/test.webp',
    )
  })

  it('preserves absolute URLs', () => {
    const url = 'https://images.unsplash.com/photo-123?w=600'
    expect(resolveMediaUrl(url)).toBe(url)
    expect(resolveMediaUrl('http://localhost:8000/media/foo.jpg')).toBe(
      'http://localhost:8000/media/foo.jpg',
    )
  })

  it('preserves root-relative URLs', () => {
    expect(resolveMediaUrl('/media/menu_items/foo.webp')).toBe('/media/menu_items/foo.webp')
    expect(resolveMediaUrl('/placeholder-food.png')).toBe('/placeholder-food.png')
  })

  it('preserves blob and data URLs', () => {
    expect(resolveMediaUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc')
    expect(resolveMediaUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('returns empty string for null, undefined, and blank values', () => {
    expect(resolveMediaUrl('')).toBe('')
    expect(resolveMediaUrl('   ')).toBe('')
    expect(resolveMediaUrl(null)).toBe('')
    expect(resolveMediaUrl(undefined)).toBe('')
  })

  it('getMediaBaseUrl prefers env over platform config', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://env-media.example.com')
    expect(getMediaBaseUrl()).toBe('https://env-media.example.com')
  })
})

describe('normalization integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizeMenuItem resolves storage keys', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://cdn.test.app')
    const item = normalizeMenuItem({
      id: '1',
      branch_id: 'b1',
      category_id: 'c1',
      name: 'Burger',
      slug: 'burger',
      description: '',
      price: '10',
      image: STORAGE_KEY,
      preparation_time: 10,
      rating: 4,
      rating_count: 1,
      available: true,
    })
    expect(item.image).toBe(`https://cdn.test.app/${STORAGE_KEY}`)
  })

  it('normalizeCartItem resolves flat legacy storage keys', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://cdn.test.app')
    const item = normalizeCartItem({
      id: '1-1',
      menu_item_id: '6',
      branch_id: 'branch-rest-01',
      name: 'Chicken',
      image: STORAGE_KEY,
      quantity: 1,
      unit_price: 19.99,
      total_price: 19.99,
      extras: [],
    })
    expect(item!.menu_item.image).toBe(`https://cdn.test.app/${STORAGE_KEY}`)
  })

  it('normalizeOrderItem resolves flat order line storage keys', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://cdn.test.app')
    const item = normalizeOrderItem({
      id: 'ol-1',
      menu_item_id: '8',
      name: 'Carbonara',
      image: STORAGE_KEY,
      quantity: 2,
      unit_price: 21.99,
      total_price: 43.98,
      extras: [],
    })
    expect(item!.menu_item.image).toBe(`https://cdn.test.app/${STORAGE_KEY}`)
    expect(item!.image).toBe(`https://cdn.test.app/${STORAGE_KEY}`)
  })
})
