import { describe, it, expect } from 'vitest'
import { createTranslator } from 'use-intl/core'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'
import { ORDER_STATUS_CONFIG } from '@/lib/order-status'
import { getOrderStatusLabelKey, translateOrderStatusLabel } from '@/lib/order-status'
import { loadMessages } from '@/i18n/runtime'

const LOCALES = [
  { name: 'en', messages: en },
  { name: 'fa', messages: fa },
  { name: 'ar', messages: ar },
] as const

const BACKEND_ALIAS_LABEL_KEYS = ['confirmed', 'processing', 'completed', 'rejected'] as const

describe('order.status i18n coverage', () => {
  for (const { name, messages } of LOCALES) {
    it(`${name}: every canonical order status has order.status.* translation`, () => {
      const statusMessages = messages.order?.status as Record<string, string> | undefined
      expect(statusMessages).toBeDefined()

      for (const status of Object.keys(ORDER_STATUS_CONFIG)) {
        const labelKey = getOrderStatusLabelKey(status)
        expect(statusMessages?.[labelKey], `missing order.status.${labelKey} in ${name}`).toBeTruthy()
      }
    })

    it(`${name}: backend alias label keys used in admin UI are translated`, () => {
      const statusMessages = messages.order?.status as Record<string, string> | undefined
      for (const key of BACKEND_ALIAS_LABEL_KEYS) {
        expect(statusMessages?.[key], `missing order.status.${key} in ${name}`).toBeTruthy()
      }
    })
  }

  it('served resolves to itself for i18n lookup', () => {
    expect(getOrderStatusLabelKey('served')).toBe('served')
    expect(en.order.status.served).toBe('Served')
  })

  it('next-intl resolves order.status.served from the en bundle (AdminOrdersPage path)', () => {
    const tOrder = createTranslator({ locale: 'en', messages: en, namespace: 'order' })
    expect(tOrder.has('status.served')).toBe(true)
    expect(tOrder('status.served')).toBe('Served')
    expect(translateOrderStatusLabel(tOrder, 'served')).toBe('Served')
  })

  it('loadMessages(en) includes order.status.served for runtime request config', async () => {
    const { messages } = await loadMessages('en')
    expect(messages.order?.status?.served).toBe('Served')
  })

  it('console.statusServed exists in all locales (ops status map parity)', () => {
    expect(en.console.statusServed).toBe('Served')
    expect(fa.console.statusServed).toBe('سرو شد')
    expect(ar.console.statusServed).toBe('تم التقديم')
  })
})
