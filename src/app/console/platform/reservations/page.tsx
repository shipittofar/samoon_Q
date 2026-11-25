'use client'

/** Platform superuser: default reservation times, for everybody and per business type. */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { ReservationRulesForm, rulesValid } from '@/components/admin/ReservationRulesForm'
import { PageHeader } from '@/components/superadmin/shared'
import { apiErrorMessage, BUSINESS_TYPE_VALUES } from '@/services/superadmin.service'
import { reservationRulesService, type PlatformRules, type RuleValues } from '@/services/reservation-rules.service'

export default function PlatformReservationRulesPage() {
  const t = useTranslations('console.reservationRules')
  const ts = useTranslations('superadmin')
  const [data, setData] = useState<PlatformRules | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setFailed(false)
    reservationRulesService.platform().then(setData).catch(() => setFailed(true))
  }
  useEffect(load, [])

  const save = async () => {
    if (!data) return
    setSaving(true)
    try {
      setData(await reservationRulesService.savePlatform({ default: data.default, by_type: data.by_type }))
      toast.success(t('saved'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('failed')))
    } finally {
      setSaving(false)
    }
  }

  const setType = (type: string, values: RuleValues) =>
    setData((d) => d && { ...d, by_type: { ...d.by_type, [type]: values } })
  const valid =
    !!data && rulesValid(data.default, data.limits) && Object.values(data.by_type).every((v) => rulesValid(v, data.limits))

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title={t('platformTitle')} subtitle={t('platformSubtitle')} />
      {failed ? (
        <Card padding="md" className="flex items-center gap-3">
          <p className="text-sm text-[var(--fg-muted)]">{t('failed')}</p>
          <Button size="sm" variant="secondary" onClick={load}>
            {t('retry')}
          </Button>
        </Card>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-[var(--fg)]">{t('everyone')}</h2>
            <ReservationRulesForm
              values={data.default}
              inherited={data.inherited.default}
              limits={data.limits}
              onChange={(v) => setData({ ...data, default: v })}
            />
          </Card>
          {BUSINESS_TYPE_VALUES.filter((type) => data.inherited.by_type[type]).map((type) => (
            <Card key={type} padding="md">
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-[var(--fg)]">
                  {ts(`businessTypes.${type}`)}
                  {Object.values(data.by_type[type] ?? {}).some((v) => v !== null && v !== undefined) ? ` · ${t('custom')}` : ''}
                </summary>
                <div className="mt-4">
                  <ReservationRulesForm
                    values={data.by_type[type] ?? {}}
                    inherited={data.inherited.by_type[type]}
                    limits={data.limits}
                    onChange={(v) => setType(type, v)}
                  />
                </div>
              </details>
            </Card>
          ))}
          <div className="flex justify-end">
            <Button loading={saving} disabled={!valid} onClick={save}>
              {t('save')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
