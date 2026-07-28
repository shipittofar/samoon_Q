/**
 * P4.7 — Avatar Upload tests
 *
 * Covers: service validation, mock upload, store propagation, UI source
 * structure, and regression checks for existing flows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Source-structure audits ───────────────────────────────────────────────────

describe('endpoints.ts — AVATAR_UPLOAD endpoint', () => {
  const src = () => readSrc('services/endpoints.ts')

  it('defines USERS.AVATAR_UPLOAD', () => {
    expect(src()).toContain('AVATAR_UPLOAD')
  })

  it('AVATAR_UPLOAD points to /users/avatar/', () => {
    expect(src()).toContain("'/users/avatar/'")
  })
})

describe('combined.service.ts — uploadAvatar method', () => {
  const src = () => readSrc('services/combined.service.ts')

  it('exports uploadAvatar on userService', () => {
    expect(src()).toContain('uploadAvatar')
  })

  it('uses multipartRequestConfig for FormData uploads', () => {
    expect(src()).toContain('multipartRequestConfig()')
  })

  it('uses FormData', () => {
    expect(src()).toContain('FormData')
  })

  it('appends file as "avatar" field', () => {
    expect(src()).toContain("form.append('avatar', file)")
  })

  it('validates allowed file types via validateMenuImageFile', () => {
    expect(src()).toContain('validateMenuImageFile')
  })

  it('validates server response has avatar_url', () => {
    expect(src()).toContain('avatar_url')
  })

  it('throws on missing avatar_url in response', () => {
    expect(src()).toContain('Server did not return an avatar URL')
  })

  it('uses ENDPOINTS.USERS.AVATAR_UPLOAD', () => {
    expect(src()).toContain('ENDPOINTS.USERS.AVATAR_UPLOAD')
  })

  it('follows USE_MOCK pattern', () => {
    expect(src()).toContain('if (USE_MOCK)')
  })
})

describe('settings/page.tsx — avatar upload UI', () => {
  const src = () => readSrc('app/dashboard/settings/page.tsx')

  it('uses ImageUploader component', () => {
    expect(src()).toContain('ImageUploader')
  })

  it('has upload button', () => {
    expect(src()).toContain('Upload')
    expect(src()).toContain('handleUploadAvatar')
  })

  it('shows loading state during upload', () => {
    expect(src()).toContain("uploading'")
    expect(src()).toContain("'uploading'")
  })

  it('shows success message after upload', () => {
    expect(src()).toContain("t('avatarUpdatedSuccessfully')")
  })

  it('shows error message on failure', () => {
    expect(src()).toContain('uploadError')
  })

  it('calls userService.uploadAvatar', () => {
    expect(src()).toContain('userService.uploadAvatar')
  })

  it('calls setUser after successful upload to update store', () => {
    expect(src()).toContain('setUser')
    expect(src()).toContain('avatar: avatar_url')
  })

  it('has accessible label on image uploader', () => {
    expect(src()).toContain("t('changeProfilePhotoAria')")
  })

  it('preserves existing profile form', () => {
    expect(src()).toContain('onSaveProfile')
    expect(src()).toContain('first_name')
    expect(src()).toContain('last_name')
  })
})

// ── uploadAvatar unit tests ───────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

describe('userService.uploadAvatar — mock mode', () => {
  let userService: typeof import('@/services/combined.service').userService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/combined.service')
    userService = mod.userService
    // Stub URL.createObjectURL for jsdom
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-avatar-url'),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('returns avatar_url on valid JPEG upload', async () => {
    const file = makeFile('avatar.jpg', 'image/jpeg', 1024)
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.avatar_url).toBeTruthy()
  })

  it('returns avatar_url on valid PNG upload', async () => {
    const file = makeFile('photo.png', 'image/png', 512)
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.avatar_url).toBeTruthy()
  })

  it('rejects WebP upload', async () => {
    const file = makeFile('photo.webp', 'image/webp', 2048)
    await expect(userService.uploadAvatar(file)).rejects.toThrow('Unsupported file type')
  })

  it('rejects GIF upload', async () => {
    const file = makeFile('anim.gif', 'image/gif', 100)
    await expect(userService.uploadAvatar(file)).rejects.toThrow('Unsupported file type')
  })

  it('throws on unsupported file type (PDF)', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1024)
    await expect(userService.uploadAvatar(file)).rejects.toThrow('Unsupported file type')
  })

  it('throws on unsupported file type (text)', async () => {
    const file = makeFile('note.txt', 'text/plain', 100)
    await expect(userService.uploadAvatar(file)).rejects.toThrow('Unsupported file type')
  })

  it('throws when file exceeds 5 MB', async () => {
    const file = makeFile('huge.jpg', 'image/jpeg', 6 * 1024 * 1024)
    await expect(userService.uploadAvatar(file)).rejects.toThrow('too large')
  })

  it('accepts file exactly at 5 MB boundary', async () => {
    const file = makeFile('exact.jpg', 'image/jpeg', 5 * 1024 * 1024)
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.avatar_url).toBeTruthy()
  })

  it('returns avatar_url in mock mode', async () => {
    const file = makeFile('pic.jpg', 'image/jpeg', 200)
    const p = userService.uploadAvatar(file)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.avatar_url).toBe('blob:mock-avatar-url')
  })
})

// ── auth store propagation ────────────────────────────────────────────────────

describe('useAuthStore — avatar propagation after upload', () => {
  it('setUser merges avatar_url into user state', async () => {
    const { useAuthStore } = await import('@/stores')
    const store = useAuthStore.getState()
    const mockUser = {
      id: 'u1', first_name: 'Test', last_name: 'User', email: 'test@test.com',
      accountType: 'customer' as const, is_verified: true, created_at: '',
    }
    store.setUser(mockUser)
    expect(useAuthStore.getState().user?.avatar).toBeUndefined()

    store.setUser({ ...mockUser, avatar: 'https://cdn.example.com/avatar.jpg' })
    expect(useAuthStore.getState().user?.avatar).toBe('https://cdn.example.com/avatar.jpg')
  })

  it('setUser can replace an existing avatar URL', async () => {
    const { useAuthStore } = await import('@/stores')
    const store = useAuthStore.getState()
    const mockUser = {
      id: 'u1', first_name: 'A', last_name: 'B', email: 'a@b.com',
      accountType: 'customer' as const, is_verified: true, created_at: '',
      avatar: 'https://old.url/avatar.jpg',
    }
    store.setUser(mockUser)
    store.setUser({ ...mockUser, avatar: 'https://new.url/avatar.jpg' })
    expect(useAuthStore.getState().user?.avatar).toBe('https://new.url/avatar.jpg')
  })
})

// ── Regression tests ─────────────────────────────────────────────────────────

describe('Regression: existing service flows unaffected by P4.7', () => {
  let userService: typeof import('@/services/combined.service').userService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/combined.service')
    userService = mod.userService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('updateProfile still works', async () => {
    const p = userService.updateProfile({ first_name: 'Jane' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.first_name).toBe('Jane')
  })

  it('getFavorites still returns array', async () => {
    const p = userService.getFavorites()
    await vi.runAllTimersAsync()
    const result = await p
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('Regression: payment service unaffected (P4.1)', () => {
  let paymentService: typeof import('@/services/payment.service').paymentService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/payment.service')
    paymentService = mod.paymentService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('createPaymentIntent still returns client_secret', async () => {
    const p = paymentService.createPaymentIntent({ amount: 50, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.client_secret).toBeTruthy()
  })
})

describe('Regression: review service unaffected (P4.3)', () => {
  let reviewService: typeof import('@/services/review.service').reviewService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/review.service')
    reviewService = mod.reviewService
    mod.reviewService._resetMockStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('getItemReviews still returns results', async () => {
    const p = reviewService.getItemReviews('item-1')
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.results.length).toBeGreaterThan(0)
  })
})

describe('settings/page.tsx — regression: profile form intact', () => {
  const src = () => readSrc('app/dashboard/settings/page.tsx')

  it('still has profileSchema with first_name and last_name', () => {
    expect(src()).toContain('profileSchema')
    expect(src()).toContain('first_name')
    expect(src()).toContain('last_name')
  })

  it('still calls userService.updateProfile', () => {
    expect(src()).toContain('userService.updateProfile')
  })

  it('still has theme selector', () => {
    expect(src()).toContain('THEMES')
    expect(src()).toContain('setTheme')
  })

  it('still has notification preferences', () => {
    expect(src()).toContain('NOTIFICATION_PREFS')
    expect(src()).toContain('notifPrefs')
  })
})
