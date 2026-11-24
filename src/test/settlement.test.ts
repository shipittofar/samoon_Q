import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { accountLabel, isValidIban } from '@/services/settlement.service'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'

const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

describe('settlement', () => {
  it('checks Sheba numbers (mod 97), with or without IR and spaces', () => {
    expect(isValidIban('IR820540102680020817909002')).toBe(true)
    expect(isValidIban('ir82 0540 1026 8002 0817 9090 02')).toBe(true)
    expect(isValidIban('820540102680020817909002')).toBe(true)
    expect(isValidIban('IR820540102680020817909003')).toBe(false)
    expect(isValidIban('IR8205401026800208179090')).toBe(false)
  })

  it('shortens account labels', () => {
    expect(
      accountLabel({ kind: 'iban', iban: 'IR820540102680020817909002', holderName: 'Sara', asset: '', address: '', label: '' }),
    ).toBe('IR8205…9002 (Sara)')
    expect(
      accountLabel({ kind: 'crypto', iban: '', holderName: '', asset: 'USDT_TRC20', address: 'TJYeasTPa6gpEEfYqfq6PJG6M1rMhEkSvR', label: 'Main' }),
    ).toBe('Main · USDT TRC20 TJYeas…kSvR')
  })

  it('has the same settlement strings in every language', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k]))
    const base = keys(en.settlement).sort()
    expect(keys(fa.settlement).sort()).toEqual(base)
    expect(keys(ar.settlement).sort()).toEqual(base)
    for (const l of [en, fa, ar]) {
      expect(l.console.settlementNav).toBeTruthy()
      expect(l.superadmin.nav.settlement).toBeTruthy()
    }
  })

  it('is in the console nav (owner permission) and the superuser nav', async () => {
    const { RESTAURANT_MODULE, ADMIN_SETTLEMENT_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_SETTLEMENT_ROUTES).toContain('/console/settlement')
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.href === '/console/settlement')
    expect(item?.permissionKey).toBe('tenant.view')
    expect(src('components/superadmin/SuperuserNav.tsx')).toContain("'/console/platform/settlement'")
    expect(src('components/admin/AdminSidebar.tsx')).toContain('Landmark,')
  })
})
