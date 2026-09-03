import { describe, it, expect } from 'vitest'
import { checkoutSchema } from '@/lib/checkout-form'

const validBase = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '2125550100',
}

describe('checkoutSchema — email optional', () => {
  it('accepts a missing/empty email', () => {
    expect(checkoutSchema.safeParse({ ...validBase, email: '' }).success).toBe(true)
  })

  it('accepts a valid email when provided', () => {
    const result = checkoutSchema.safeParse({ ...validBase, email: 'ada@example.com' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('ada@example.com')
  })

  it('rejects a malformed email when provided', () => {
    const result = checkoutSchema.safeParse({ ...validBase, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toBe('invalid_email')
  })

  it('still requires first name, last name, and phone', () => {
    expect(checkoutSchema.safeParse({ ...validBase, first_name: 'A', email: '' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...validBase, last_name: 'L', email: '' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...validBase, phone_number: '123', email: '' }).success).toBe(false)
  })
})
