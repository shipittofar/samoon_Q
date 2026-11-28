import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeReservation } from '@/services/combined.service'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'

const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

describe('customer reservations', () => {
  it('maps the backend shape', () => {
    const r = normalizeReservation({
      id: 'r1', branch_id: 'b1', branch_name: 'Valiasr', business_name: 'Cafe Sara', guest_name: 'Nima',
      guest_phone: '0912', party_size: 4, reserved_at: '2026-11-30T15:35:00Z',
      local_date: '2026-11-30', local_time: '19:05', confirmation_code: 'AB12CD34', notes: '', status: 'confirmed',
      can_cancel: true, created_at: '2026-11-25T00:00:00Z',
    })
    expect(r).toMatchObject({
      date: '2026-11-30', time: '19:05', guests: 4, name: 'Nima', branch_name: 'Valiasr',
      business_name: 'Cafe Sara', status: 'confirmed', can_cancel: true,
    })
    expect(r.notes).toBeUndefined()
  })

  it('names every status in every language and shows real branches', () => {
    for (const l of [en, fa, ar]) {
      expect(Object.keys(l.dashboard.reservationStatus).sort()).toEqual(
        ['cancelled', 'completed', 'confirmed', 'no_show', 'pending', 'seated'],
      )
    }
    const page = src('app/dashboard/reservations/page.tsx')
    expect(page).not.toContain('airportBranch')
    expect(page).toContain('useCancelMyReservation')
  })

  it('cafes have Reservations in the console menu', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.adminNavItems?.some((n) => n.href === '/console/reservations')).toBe(true)
  })
})
