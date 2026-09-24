import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/locales/en.json'
import { AddressPicker, type AddressPickerValue } from '@/components/address/AddressPicker'
import { AddressProfileIncompleteError } from '@/lib/address-profile'
import type { UserAddressInput } from '@/types/address'

const addressState = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks/address', () => ({
  useAddressList: () => ({ data: { results: [] }, isLoading: false }),
  useCreateAddress: () => ({
    mutateAsync: addressState.mutateAsync,
    isPending: addressState.isPending,
  }),
}))

vi.mock('@/components/address/AddressForm', () => ({
  AddressForm: ({
    onSubmit,
    loading,
  }: {
    onSubmit: (data: UserAddressInput) => void | Promise<void>
    loading?: boolean
  }) => (
    <button
      type="button"
      disabled={loading}
      onClick={() =>
        onSubmit({
          address_type: 'home',
          country: 'US',
          city: 'New York',
          street: '1 Main St',
          postal_code: '10001',
        })
      }
    >
      save-address
    </button>
  ),
}))

import toast from 'react-hot-toast'

function renderPicker(onChange = vi.fn()) {
  const value: AddressPickerValue = { mode: 'saved' }
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AddressPicker value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  )
  return onChange
}

describe('Checkout add new address', () => {
  beforeEach(() => {
    addressState.mutateAsync.mockReset()
    addressState.isPending = false
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('creates the address and selects it as a saved address', async () => {
    addressState.mutateAsync.mockResolvedValue({ id: 'addr-new' })
    const onChange = renderPicker()

    await userEvent.click(screen.getByRole('button', { name: /add address/i }))
    await userEvent.click(screen.getByRole('button', { name: 'save-address' }))

    expect(addressState.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'New York', street: '1 Main St' }),
    )
    expect(onChange).toHaveBeenCalledWith({ mode: 'saved', addressId: 'addr-new' })
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps the modal open and shows an error when create fails', async () => {
    addressState.mutateAsync.mockRejectedValue(new Error('network'))
    const onChange = renderPicker()

    await userEvent.click(screen.getByRole('button', { name: /add address/i }))
    await userEvent.click(screen.getByRole('button', { name: 'save-address' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'save-address' })).toBeInTheDocument()
  })

  it('surfaces an incomplete profile without a generic failure toast', async () => {
    addressState.mutateAsync.mockRejectedValue(new AddressProfileIncompleteError(['phone']))
    renderPicker()

    await userEvent.click(screen.getByRole('button', { name: /add address/i }))
    await userEvent.click(screen.getByRole('button', { name: 'save-address' }))

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).not.toBe(en.address.failedToAdd)
  })
})
