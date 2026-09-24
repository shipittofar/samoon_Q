import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, renderHook, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/locales/en.json'
import { middleware } from '@/middleware'
import { NextRequest } from 'next/server'
import { authService } from '@/services/auth.service'
import { orderService } from '@/services/order.service'
import { useAuthStore, useCartStore, useTenantStore, useBranchStore } from '@/stores'
import { AuthModal } from '@/components/auth/AuthModal'
import { CartDrawer } from '@/components/cart/CartDrawer'
import CheckoutPage from '@/app/checkout/page'
import { useCheckoutAuthGate } from '@/hooks/use-checkout-auth-gate'
import type { MenuItem, User } from '@/types'
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from '@/services/auth.service'

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/address', () => ({
  AddressPicker: () => null,
  DeliveryInfoCard: () => null,
}))

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header>Header</header>,
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ''} src={typeof props.src === 'string' ? props.src : ''} />
  ),
}))

vi.mock('@/components/ui/PhoneInput', () => ({
  PhoneInput: ({
    onChange,
    label,
  }: {
    onChange?: (e164: string, meta: { dialCode: string; nationalNumber: string; isValid: boolean }) => void
    label?: string
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange?.('+14155550101', { dialCode: '+1', nationalNumber: '4155550101', isValid: true })
      }
    >
      {label ?? 'phone'}
    </button>
  ),
}))

const mockPush = vi.fn()
const mockReplace = vi.fn()
const navState = vi.hoisted(() => ({ pathname: '/menu' }))
vi.mock('next/navigation', async (importOriginal) => {
  const mod = await importOriginal<typeof import('next/navigation')>()
  return {
    ...mod,
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => navState.pathname,
    useSearchParams: () => new URLSearchParams(),
  }
})

function authedUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'guest@example.com',
    phone_number: '+14155550101',
    first_name: 'Guest',
    last_name: 'User',
    accountType: 'customer',
    is_verified: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockMenuItem(): MenuItem {
  return {
    id: 'item-1',
    branch_id: 'branch-1',
    name: 'Burger',
    slug: 'burger',
    description: '',
    price: 12,
    image: '/img.png',
    category_id: 'cat-1',
    available: true,
    is_active: true,
    preparation_time: 10,
    rating: 0,
    rating_count: 0,
    extras: [],
  }
}

function qcWrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>{children}</NextIntlClientProvider>
    </QueryClientProvider>
  )
}

function req(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  mockPush.mockReset()
  mockReplace.mockReset()
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionCheckFailed: false })
  useCartStore.setState({
    items: [],
    discountCode: '',
    discountAmount: 0,
    isOpen: false,
    ownership: null,
    conflictOpen: false,
    hasHydrated: true,
  })
  useTenantStore.getState().setTenant({
    id: 'tenant-1',
    name: 'Demo',
    slug: 'demo',
    businessTypes: ['restaurant'],
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().setUser(null)
  useCartStore.getState().clearCart()
})

describe('Guest checkout middleware', () => {
  it('does not redirect unauthenticated /checkout to /login', () => {
    const res = middleware(req('/checkout'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.status).not.toBe(307)
  })
})

describe('AuthModal', () => {
  it('existing user email login closes the modal and authenticates without navigating to /login', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: authedUser(),
      tokens: { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN },
    } as never)
    vi.spyOn(authService, 'getMe').mockResolvedValue({ user: authedUser() })

    render(<AuthModal open onClose={onClose} onSuccess={onSuccess} />, { wrapper: qcWrapper })

    await userEvent.click(screen.getByRole('button', { name: /sign in with email instead/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'guest@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password')
    await userEvent.click(screen.getByRole('button', { name: /^sign in with email$/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalledWith('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('guest@example.com')
  })

  it('new-user OTP then complete-profile authenticates in place', async () => {
    const onSuccess = vi.fn()
    vi.spyOn(authService, 'sendOTP').mockResolvedValue({ message: 'sent' })
    vi.spyOn(authService, 'verifyOTP').mockResolvedValue({ is_new_user: true })
    vi.spyOn(authService, 'register').mockResolvedValue({
      user: authedUser({ first_name: 'Ada', last_name: 'Lovelace' }),
      tokens: { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN },
    } as never)
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: authedUser({ first_name: 'Ada', last_name: 'Lovelace' }),
    })

    render(<AuthModal open onClose={vi.fn()} onSuccess={onSuccess} />, { wrapper: qcWrapper })

    await userEvent.click(screen.getByRole('button', { name: /phone/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.getByText(/verify your number/i)).toBeInTheDocument())
    const otpBoxes = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i++) {
      await userEvent.type(otpBoxes[i]!, String(i + 1))
    }

    await waitFor(() => expect(screen.getByLabelText(/first name/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/first name/i), 'Ada')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lovelace')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(mockReplace).not.toHaveBeenCalledWith('/login')
  })

  it('invalid OTP keeps the modal open and shows an error', async () => {
    const onSuccess = vi.fn()
    vi.spyOn(authService, 'sendOTP').mockResolvedValue({ message: 'sent' })
    vi.spyOn(authService, 'verifyOTP').mockRejectedValue({
      response: { data: { message: 'Invalid OTP. Please try again.' } },
    })

    render(<AuthModal open onClose={vi.fn()} onSuccess={onSuccess} />, { wrapper: qcWrapper })
    await userEvent.click(screen.getByRole('button', { name: /phone/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByText(/verify your number/i)).toBeInTheDocument())

    const otpBoxes = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i++) {
      await userEvent.type(otpBoxes[i]!, '0')
    }

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('create account stays inside the modal instead of navigating to /register', async () => {
    render(<AuthModal open onClose={vi.fn()} onSuccess={vi.fn()} />, { wrapper: qcWrapper })
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/register'))
  })

  it('resend OTP is disabled until the countdown expires', async () => {
    vi.spyOn(authService, 'sendOTP').mockResolvedValue({ message: 'sent' })
    render(<AuthModal open onClose={vi.fn()} onSuccess={vi.fn()} />, { wrapper: qcWrapper })
    await userEvent.click(screen.getByRole('button', { name: /phone/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByText(/resend code in/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /resend code in/i })).toBeDisabled()
  })
})

describe('Cart → Checkout authentication gate', () => {
  beforeEach(() => {
    navState.pathname = '/menu'
  })

  function seedCart() {
    useCartStore.getState().addItem(mockMenuItem(), 2, [], undefined, {
      tenantId: 'tenant-1',
      tenantSlug: 'demo',
      tenantName: 'Demo',
      branchId: 'branch-1',
      branchSlug: 'main',
      branchName: 'Main',
    })
    useCartStore.setState({ hasHydrated: true, isOpen: true })
    useBranchStore.setState({
      activeBranch: {
        id: 'branch-1',
        tenant_id: 'tenant-1',
        name: 'Main',
        slug: 'main',
        address: '',
        phone_number: '',
        is_active: true,
      } as never,
    })
  }

  it('opens AuthModal for guests instead of navigating to /checkout or /login', async () => {
    seedCart()
    render(<CartDrawer />, { wrapper: qcWrapper })

    await userEvent.click(screen.getByTestId('cart-checkout-cta'))

    await waitFor(() => expect(screen.getByRole('dialog', { name: /welcome/i })).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
  })

  it('authenticated users go to /checkout without a modal', async () => {
    seedCart()
    useAuthStore.getState().setUser(authedUser())
    render(<CartDrawer />, { wrapper: qcWrapper })

    await userEvent.click(screen.getByTestId('cart-checkout-cta'))

    expect(screen.queryByRole('dialog', { name: /welcome/i })).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/checkout')
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
  })

  it('closes the cart on /checkout without navigating again', async () => {
    navState.pathname = '/checkout'
    seedCart()
    useAuthStore.getState().setUser(authedUser())
    render(<CartDrawer />, { wrapper: qcWrapper })

    await userEvent.click(screen.getByTestId('cart-checkout-cta'))

    expect(useCartStore.getState().isOpen).toBe(false)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: /welcome/i })).not.toBeInTheDocument()
  })

  it('closing the modal stays on cart and preserves items', async () => {
    seedCart()
    const qtyBefore = useCartStore.getState().items[0]?.quantity
    render(<CartDrawer />, { wrapper: qcWrapper })
    await userEvent.click(screen.getByTestId('cart-checkout-cta'))
    await waitFor(() => expect(screen.getByRole('dialog', { name: /welcome/i })).toBeInTheDocument())

    const authDialog = screen.getByRole('dialog', { name: /welcome/i })
    await userEvent.click(within(authDialog).getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /welcome/i })).not.toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
    expect(useCartStore.getState().items[0]?.quantity).toBe(qtyBefore)
    expect(useCartStore.getState().items[0]?.menu_item.branch_id).toBe('branch-1')
    expect(useTenantStore.getState().tenant?.id).toBe('tenant-1')
  })

  it('successful login closes the modal and navigates to /checkout with cart intact', async () => {
    seedCart()
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: authedUser(),
      tokens: { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN },
    } as never)
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: authedUser(),
      memberships: [{
        tenantId: 'other-tenant',
        tenantSlug: 'other',
        tenantName: 'Other',
        roles: [],
        branchAccess: { scope: 'all' },
        status: 'active',
      }],
      activeMembership: {
        tenantId: 'other-tenant',
        tenantSlug: 'other',
        tenantName: 'Other',
        roles: [],
        branchAccess: { scope: 'all' },
        branchId: 'other-branch',
        status: 'active',
      },
    })

    render(<CartDrawer />, { wrapper: qcWrapper })
    await userEvent.click(screen.getByTestId('cart-checkout-cta'))
    await waitFor(() => expect(screen.getByRole('dialog', { name: /welcome/i })).toBeInTheDocument())

    const dialog = screen.getByRole('dialog', { name: /welcome/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /sign in with email instead/i }))
    await userEvent.type(within(dialog).getByLabelText(/email/i), 'guest@example.com')
    await userEvent.type(within(dialog).getByPlaceholderText('••••••••'), 'password')
    await userEvent.click(within(dialog).getByRole('button', { name: /^sign in with email$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockPush).toHaveBeenCalledWith('/checkout')
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]?.quantity).toBe(2)
    expect(useTenantStore.getState().tenant?.id).toBe('tenant-1')
    expect(useBranchStore.getState().activeBranch?.id).toBe('branch-1')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})

describe('Checkout defensive guard', () => {
  function seedCart() {
    useCartStore.getState().addItem(mockMenuItem(), 2, [], undefined, {
      tenantId: 'tenant-1',
      tenantSlug: 'demo',
      tenantName: 'Demo',
      branchId: 'branch-1',
      branchSlug: 'main',
      branchName: 'Main',
    })
    useCartStore.setState({ hasHydrated: true })
    useBranchStore.setState({
      activeBranch: {
        id: 'branch-1',
        tenant_id: 'tenant-1',
        name: 'Main',
        slug: 'main',
        address: '',
        phone_number: '',
        is_active: true,
      } as never,
    })
  }

  it('does not send a guest on /checkout to /login and does not submit an order', async () => {
    seedCart()
    const createSpy = vi.spyOn(orderService, 'createOrder')
    render(<CheckoutPage />, { wrapper: qcWrapper })

    await waitFor(() => expect(screen.getByRole('dialog', { name: /welcome/i })).toBeInTheDocument())
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
    expect(mockPush).not.toHaveBeenCalledWith('/login')
    expect(screen.getByTestId('checkout-page')).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /continue to payment/i })).not.toBeInTheDocument()
  })

  it('authenticated users continue to payment without the auth modal', async () => {
    seedCart()
    useAuthStore.getState().setUser(authedUser())
    render(<CheckoutPage />, { wrapper: qcWrapper })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /continue to payment/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/payment method/i)).toBeInTheDocument())
  })
})

describe('useCheckoutAuthGate', () => {
  it('does not navigate until authentication succeeds', () => {
    const { result } = renderHook(() => useCheckoutAuthGate(), { wrapper: qcWrapper })
    act(() => {
      result.current.requestCheckout('/checkout')
    })
    expect(result.current.authModalOpen).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()

    act(() => {
      result.current.handleAuthClose()
    })
    expect(result.current.authModalOpen).toBe(false)
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('useLogin navigate:false', () => {
  it('does not dispatch a router replace when hydrating in place', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: authedUser(),
      tokens: { access: MOCK_ACCESS_TOKEN, refresh: MOCK_REFRESH_TOKEN },
    } as never)
    vi.spyOn(authService, 'getMe').mockResolvedValue({ user: authedUser() })
    const { useLogin } = await import('@/hooks')
    const { result } = renderHook(() => useLogin({ navigate: false }), { wrapper: qcWrapper })
    await result.current.mutateAsync({ email: 'guest@example.com', password: 'password' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
