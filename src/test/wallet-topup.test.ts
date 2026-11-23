import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { goToGateway } from '@/services/wallet.service'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'

const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

describe('wallet top-up', () => {
  it('posts a hidden form for POST gateways (Bank Mellat)', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    goToGateway({ url: 'https://bpm.shaparak.ir/pgwchannel/startpay.mellat', method: 'POST', fields: { RefId: 'ABC' } })
    const form = document.body.querySelector('form') as HTMLFormElement
    expect(form.method.toUpperCase()).toBe('POST')
    expect(form.action).toBe('https://bpm.shaparak.ir/pgwchannel/startpay.mellat')
    expect((form.querySelector('input[name="RefId"]') as HTMLInputElement).value).toBe('ABC')
    expect(submit).toHaveBeenCalledOnce()
    form.remove()
    submit.mockRestore()
  })

  it('navigates with fields as query for GET gateways', () => {
    const assign = vi.fn()
    const doc = { location: { href: 'http://localhost:3000/dashboard/wallet', assign } } as unknown as Document
    goToGateway({ url: 'http://localhost:3000/dashboard/wallet/topup-test', method: 'GET', fields: { id: '1', ok: 't' } }, doc)
    expect(assign).toHaveBeenCalledWith('http://localhost:3000/dashboard/wallet/topup-test?id=1&ok=t')
  })

  it('has the same top-up strings in every language', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k]))
    for (const ns of ['topup', 'topupAdmin'] as const) {
      const base = keys(en.wallet[ns]).sort()
      expect(keys(fa.wallet[ns]).sort()).toEqual(base)
      expect(keys(ar.wallet[ns]).sort()).toEqual(base)
    }
    expect(fa.superadmin.nav.topups).toBeTruthy()
  })

  it('test gateway page only follows our own callback', () => {
    const page = src('app/dashboard/wallet/topup-test/page.tsx')
    expect(page).toContain('\\/api\\/wallet\\/topups\\/[0-9a-f-]{36}\\/callback\\/$')
  })

  it('superuser nav links the top-ups page', () => {
    expect(src('components/superadmin/SuperuserNav.tsx')).toContain("'/console/platform/topups'")
  })
})
