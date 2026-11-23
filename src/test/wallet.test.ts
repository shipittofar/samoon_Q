import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { balanceIn } from '@/services/wallet.service'
import { getDashboardNav } from '@/modules/registry'

const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

describe('wallet', () => {
  it('balance in a currency (0 when there is no account)', () => {
    const accounts = [
      { currency: 'IRT', balance: '250000', frozen: false },
      { currency: 'USDT', balance: '12.5', frozen: false },
    ]
    expect(balanceIn(accounts, 'IRT')).toBe(250000)
    expect(balanceIn(accounts, 'usdt')).toBe(12.5)
    expect(balanceIn(accounts, 'EUR')).toBe(0)
    expect(balanceIn(undefined, 'IRT')).toBe(0)
  })

  it('customer dashboard links to the wallet', () => {
    expect(getDashboardNav().some((i) => i.href === '/dashboard/wallet')).toBe(true)
  })

  it('checkout disables the wallet option when the balance does not cover the order', () => {
    const page = src('app/checkout/page.tsx')
    expect(page).toContain("disabled={method.wireMethod === 'wallet' && walletInsufficient}")
    expect(page).toContain('const walletInsufficient = walletBalance < total')
  })

  it('superuser adjustments send a fresh idempotency key per submission', () => {
    const page = src('app/console/platform/wallets/page.tsx')
    expect(page).toContain('idempotencyKey: key')
    expect(page).toContain('setKey(newKey())')
  })
})
