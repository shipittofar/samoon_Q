'use client'

/** A branch's own reservation times: spacing, length, limits. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ReservationRulesForm, rulesValid } from '@/components/admin/ReservationRulesForm'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { selectClass } from '@/components/superadmin/shared'
import { useAdminBranches, useConsoleBranchId, useConsoleTenantId, usePermission } from '@/hooks'
import { apiErrorMessage } from '@/services/superadmin.service'
import { reservationRulesService, type RuleValues } from '@/services/reservation-rules.service'

function Content() {
  const t = useTranslations('console.reservationRules')
  const queryClient = useQueryClient()
  const tenantId = useConsoleTenantId() ?? ''
  const currentBranch = useConsoleBranchId()
  const { data: branches = [] } = useAdminBranches(tenantId)
  const manageSettings = usePermission('settings.manage')
  const manageBranches = usePermission('branches.manage')
  const canEdit = manageSettings || manageBranches
  const [picked, setPicked] = useState('')
  const branchId = picked || currentBranch || branches[0]?.id || ''
  const queryKey = ['reservation-rules', tenantId, branchId]
  const { data, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => reservationRulesService.branch(tenantId, branchId),
    enabled: !!tenantId && !!branchId,
  })
  const [values, setValues] = useState<RuleValues>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => setValues(data?.own ?? {}), [data])

  const save = async () => {
    setSaving(true)
    try {
      queryClient.setQueryData(queryKey, await reservationRulesService.saveBranch(tenantId, branchId, values))
      void queryClient.invalidateQueries({ queryKey: ['available-slots'] })
      toast.success(t('saved'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pt-20 sm:p-6 sm:pt-20">
      <Link href="/console/reservations" className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('back')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('subtitle')}</p>
      </div>
      <Card padding="md" className="space-y-4">
        {branches.length > 1 && (
          <label className="flex max-w-xs flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--fg)]">{t('branch')}</span>
            <select className={selectClass} value={branchId} onChange={(e) => setPicked(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isError ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--fg-muted)]">{t('failed')}</p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <ReservationRulesForm values={values} inherited={data.inherited} limits={data.limits} disabled={!canEdit} onChange={setValues} />
            <p className="text-xs text-[var(--fg-muted)]">
              {data.max_capacity === null ? t('capacityNone') : t('capacity', { count: data.max_capacity })}
            </p>
            {canEdit && (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setValues({})}>
                  {t('useDefaults')}
                </Button>
                <Button size="sm" loading={saving} disabled={!rulesValid(values, data.limits)} onClick={save}>
                  {t('save')}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

export default function ReservationSettingsPage() {
  return (
    <PermissionGuard permission="reservations.view" fallback={<AccessDenied />}>
      <Content />
    </PermissionGuard>
  )
}
