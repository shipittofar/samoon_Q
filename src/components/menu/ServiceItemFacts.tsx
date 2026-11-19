'use client'

/**
 * Phase 1 — public facts for service catalog items (salon, clinic):
 * duration and "by appointment", in place of the food menu's prep time and
 * calories. Also exposes the "From {price}" formatting used when a service
 * has a starting price.
 */
import { useTranslations } from 'next-intl'
import { CalendarCheck, Clock } from 'lucide-react'
import { numericAttribute } from '@/verticals'
import type { MenuItem } from '@/types'

export function ServiceItemFacts({ item, className }: { item: MenuItem; className?: string }) {
  const t = useTranslations('verticals')
  const duration = numericAttribute(item.attributes, 'duration_minutes')
  const byAppointment = item.attributes?.requires_appointment === true
  if (duration === undefined && !byAppointment) return null
  return (
    <>
      {duration !== undefined && (
        <span className={className ?? 'flex items-center gap-1'}>
          <Clock className="h-3 w-3" aria-hidden="true" />
          {t('facts.durationMinutes', { minutes: duration })}
        </span>
      )}
      {byAppointment && (
        <span className={className ?? 'flex items-center gap-1'}>
          <CalendarCheck className="h-3 w-3" aria-hidden="true" />
          {t('facts.byAppointment')}
        </span>
      )}
    </>
  )
}

/** True when the item's price is a starting price ("From 450,000"). */
export function hasStartingPrice(item: Pick<MenuItem, 'attributes'>): boolean {
  return item.attributes?.price_is_starting === true
}

/** Formats a price, prefixing "From" for starting prices. */
export function useCatalogPriceLabel() {
  const t = useTranslations('verticals')
  return (item: Pick<MenuItem, 'attributes'>, formatted: string) =>
    hasStartingPrice(item) ? t('facts.priceFrom', { price: formatted }) : formatted
}
