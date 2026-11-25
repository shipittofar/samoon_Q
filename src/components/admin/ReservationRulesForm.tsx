'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { RULE_FIELDS, ruleOutOfRange, type RuleLimits, type RuleValues } from '@/services/reservation-rules.service'

/** Rule fields; an empty one shows (and uses) the inherited value. */
export function ReservationRulesForm({
  values,
  inherited,
  limits,
  disabled,
  onChange,
}: {
  values: RuleValues
  inherited: RuleValues
  limits: RuleLimits
  disabled?: boolean
  onChange: (next: RuleValues) => void
}) {
  const t = useTranslations('console.reservationRules')
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RULE_FIELDS.map((field) => {
        const [min, max] = limits[field]
        const base = inherited[field]
        return (
          <div key={field}>
            <Input
              label={t(`fields.${field}`)}
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={min}
              max={max}
              step={1}
              disabled={disabled}
              value={values[field] ?? ''}
              placeholder={base === null || base === undefined ? t('noLimit') : String(base)}
              error={ruleOutOfRange(field, values[field], limits) ? t('range', { min, max }) : undefined}
              onChange={(e) => onChange({ ...values, [field]: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {t(`hints.${field}`)} {t('inherited', { value: base === null || base === undefined ? t('noLimit') : String(base) })}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function rulesValid(values: RuleValues, limits: RuleLimits): boolean {
  return RULE_FIELDS.every((f) => !ruleOutOfRange(f, values[f], limits))
}
