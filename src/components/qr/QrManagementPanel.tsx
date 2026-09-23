'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Check, Copy, Loader2 } from 'lucide-react'
import { QrCodeDisplay } from '@/components/qr/QrCodeDisplay'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getApiErrorCode, getApiErrorMessage, getApiStatus } from '@/api/errors'
import {
  useBranchQr,
  useDisableBranchQr,
  useEnableBranchQr,
  useRegenerateBranchQr,
  useSetBranchQrDestination,
  useDisableTenantQr,
  useEnableTenantQr,
  useRegenerateTenantQr,
  useSetTenantQrDestination,
  useTenantQr,
  useMenuQr,
  useDisableMenuQr,
  useEnableMenuQr,
  useRegenerateMenuQr,
  useSetMenuQrDestination,
  useReservationQr,
  useDisableReservationQr,
  useEnableReservationQr,
  useRegenerateReservationQr,
  useSetReservationQrDestination,
} from '@/hooks/qr-management'
import { qrDestinationsForEntity } from '@/types/qr'
import type { QrDestination, QrEntityType } from '@/types/qr'

type Scope = QrEntityType

function destinationLabelKey(destination: QrDestination): string {
  if (destination === 'tenant') return 'qrDestinationTenant'
  if (destination === 'branch') return 'qrDestinationBranch'
  if (destination === 'menu') return 'qrDestinationMenu'
  return 'qrDestinationReservation'
}

function toastQrError(err: unknown, t: (key: string) => string, fallbackKey: string) {
  const backendMessage = getApiErrorMessage(err, '')
  if (backendMessage) {
    toast.error(backendMessage)
    return
  }
  const status = getApiStatus(err)
  if (status === 401) {
    toast.error(t('qrUnauthorized'))
    return
  }
  if (status === 403) {
    toast.error(t('qrForbidden'))
    return
  }
  if (status === 404) {
    toast.error(t('qrNotFound'))
    return
  }
  if (getApiErrorCode(err) === 'qr_invalid_destination') {
    toast.error(t('qrInvalidDestination'))
    return
  }
  toast.error(t(fallbackKey))
}

export function QrManagementPanel({
  scope,
  entityId,
  tenantId,
  canManage,
  publicUrl,
  publicUrlLabel,
  title,
  description,
  sectionAria,
}: {
  scope: Scope
  entityId: string
  tenantId?: string
  canManage: boolean
  publicUrl?: string
  publicUrlLabel?: string
  title: string
  description: string
  sectionAria: string
}) {
  const t = useTranslations('console')
  const tMarket = useTranslations('marketplace')
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [pendingDestination, setPendingDestination] = useState<QrDestination | null>(null)
  const [copied, setCopied] = useState(false)

  const tenantQuery = useTenantQr(scope === 'tenant' ? entityId : undefined)
  const branchQuery = useBranchQr(scope === 'branch' ? entityId : undefined)
  const menuQuery = useMenuQr(scope === 'menu' ? entityId : undefined)
  const reservationQuery = useReservationQr(scope === 'reservation' ? entityId : undefined)
  const query =
    scope === 'tenant'
      ? tenantQuery
      : scope === 'branch'
        ? branchQuery
        : scope === 'menu'
          ? menuQuery
          : reservationQuery
  const qr = query.data ?? null

  const enableTenant = useEnableTenantQr()
  const disableTenant = useDisableTenantQr()
  const regenerateTenant = useRegenerateTenantQr()
  const destinationTenant = useSetTenantQrDestination()
  const enableBranch = useEnableBranchQr(tenantId)
  const disableBranch = useDisableBranchQr(tenantId)
  const regenerateBranch = useRegenerateBranchQr(tenantId)
  const destinationBranch = useSetBranchQrDestination(tenantId)
  const enableMenu = useEnableMenuQr()
  const disableMenu = useDisableMenuQr()
  const regenerateMenu = useRegenerateMenuQr()
  const destinationMenu = useSetMenuQrDestination()
  const enableReservation = useEnableReservationQr()
  const disableReservation = useDisableReservationQr()
  const regenerateReservation = useRegenerateReservationQr()
  const destinationReservation = useSetReservationQrDestination()

  const allowed = qrDestinationsForEntity(scope)
  const showDestinationSelect = canManage && allowed.length > 1

  const enablePending =
    enableTenant.isPending || enableBranch.isPending || enableMenu.isPending || enableReservation.isPending
  const disablePending =
    disableTenant.isPending || disableBranch.isPending || disableMenu.isPending || disableReservation.isPending
  const regeneratePending =
    regenerateTenant.isPending ||
    regenerateBranch.isPending ||
    regenerateMenu.isPending ||
    regenerateReservation.isPending
  const destinationPending =
    destinationTenant.isPending ||
    destinationBranch.isPending ||
    destinationMenu.isPending ||
    destinationReservation.isPending

  const busy = enablePending || disablePending || regeneratePending || destinationPending

  function runEnable() {
    const onError = (err: unknown) => toastQrError(err, t, 'qrEnableFailed')
    const onSuccess = () => toast.success(t('qrEnableSuccess'))
    if (scope === 'tenant') enableTenant.mutate(entityId, { onSuccess, onError })
    else if (scope === 'branch') enableBranch.mutate(entityId, { onSuccess, onError })
    else if (scope === 'menu') enableMenu.mutate(entityId, { onSuccess, onError })
    else enableReservation.mutate(entityId, { onSuccess, onError })
  }

  function runDisable() {
    const onError = (err: unknown) => toastQrError(err, t, 'qrDisableFailed')
    const onSuccess = () => {
      setDisableOpen(false)
      toast.success(t('qrDisableSuccess'))
    }
    if (scope === 'tenant') disableTenant.mutate(entityId, { onSuccess, onError })
    else if (scope === 'branch') disableBranch.mutate(entityId, { onSuccess, onError })
    else if (scope === 'menu') disableMenu.mutate(entityId, { onSuccess, onError })
    else disableReservation.mutate(entityId, { onSuccess, onError })
  }

  function runRegenerate() {
    const onError = (err: unknown) => toastQrError(err, t, 'qrRegenerateFailed')
    const onSuccess = () => {
      setRegenerateOpen(false)
      toast.success(t('qrRegenerateSuccess'))
    }
    if (scope === 'tenant') regenerateTenant.mutate(entityId, { onSuccess, onError })
    else if (scope === 'branch') regenerateBranch.mutate(entityId, { onSuccess, onError })
    else if (scope === 'menu') regenerateMenu.mutate(entityId, { onSuccess, onError })
    else regenerateReservation.mutate(entityId, { onSuccess, onError })
  }

  function requestDestinationChange(destination: QrDestination) {
    if (!qr || destination === qr.destination) return
    setPendingDestination(destination)
  }

  function cancelDestinationChange() {
    setPendingDestination(null)
  }

  function confirmDestinationChange() {
    if (!pendingDestination) return
    const destination = pendingDestination
    const onError = (err: unknown) => toastQrError(err, t, 'qrDestinationFailed')
    const onSuccess = () => {
      setPendingDestination(null)
      toast.success(t('qrDestinationUpdated'))
    }
    const payload = { destination_type: destination } as const
    if (scope === 'tenant') {
      destinationTenant.mutate({ tenantId: entityId, payload }, { onSuccess, onError })
    } else if (scope === 'branch') {
      destinationBranch.mutate({ branchId: entityId, payload }, { onSuccess, onError })
    } else if (scope === 'menu') {
      destinationMenu.mutate({ entityId, payload }, { onSuccess, onError })
    } else {
      destinationReservation.mutate({ entityId, payload }, { onSuccess, onError })
    }
  }

  return (
    <section aria-label={sectionAria} className="rounded-lg border border-[var(--border)] p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-[var(--fg-muted)] mb-4">{description}</p>

      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('qrLoading')}
        </p>
      ) : query.isError ? (
        <p className="text-sm text-[var(--danger-text)]" role="alert">
          {getApiErrorMessage(query.error, t('qrNotFound'))}
        </p>
      ) : !qr ? (
        <div>
          <p className="text-sm text-[var(--fg-subtle)] mb-3">{tMarket('qrNotAvailable')}</p>
          {canManage ? (
            <Button type="button" size="sm" loading={enablePending} onClick={runEnable}>
              {t('qrEnableAction')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr] items-start">
          <QrCodeDisplay
            url={qr.url}
            title=""
            inactive={!qr.is_active}
            className="mt-0"
          />

          <div className="space-y-4 min-w-0">
            <div>
              <p className="text-xs font-medium text-[var(--fg-muted)] mb-1">{t('qrStatusLabel')}</p>
              <p
                className="text-sm font-medium"
                data-testid="qr-status"
                data-qr-active={qr.is_active ? 'true' : 'false'}
              >
                {qr.is_active ? t('qrActive') : t('qrDisabled')}
              </p>
              {!qr.is_active ? (
                <p className="text-sm text-[var(--warning-text)] mt-1">{t('qrDisabledHint')}</p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--fg-muted)] mb-1">{t('qrDestinationLabel')}</p>
              {showDestinationSelect ? (
                <label className="block text-sm">
                  <span className="sr-only">{t('qrChangeDestination')}</span>
                  <select
                    className="mt-1 w-full max-w-xs border rounded-md px-3 py-2 text-sm bg-[var(--card)]"
                    value={pendingDestination ?? qr.destination}
                    disabled={busy}
                    aria-label={t('qrDestinationLabel')}
                    data-testid="qr-destination-select"
                    onChange={(e) => requestDestinationChange(e.target.value as QrDestination)}
                  >
                    {allowed.map((value) => (
                      <option key={value} value={value}>
                        {t(destinationLabelKey(value))}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm" data-testid="qr-destination">
                  {t(destinationLabelKey(qr.destination))}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--fg-muted)] mb-1">{t('qrResolverUrlLabel')}</p>
              <div className="flex items-start gap-2">
                <code
                  className="flex-1 text-xs bg-[var(--card-hover)] border rounded px-2.5 py-1.5 font-mono break-all"
                  data-testid="qr-resolver-url"
                >
                  {qr.url}
                </code>
                <button
                  type="button"
                  aria-label={tMarket('copyUrlAria')}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-[var(--card-hover)] shrink-0"
                  onClick={async () => {
                    await navigator.clipboard.writeText(qr.url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--success-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? tMarket('copied') : tMarket('copy')}
                </button>
              </div>
              <p className="sr-only" data-testid="qr-code-value">
                {qr.code}
              </p>
            </div>

            {publicUrl ? (
              <div>
                <p className="text-xs font-medium text-[var(--fg-muted)] mb-1">
                  {publicUrlLabel ?? t('currentPublicPageLabel')}
                </p>
                <code className="block text-xs bg-[var(--card-hover)] border rounded px-2.5 py-1.5 font-mono break-all">
                  {publicUrl}
                </code>
              </div>
            ) : null}

            {canManage ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {qr.is_active ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDisableOpen(true)}
                  >
                    {t('qrDisableAction')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    loading={enablePending}
                    disabled={busy}
                    onClick={runEnable}
                  >
                    {t('qrEnableAction')}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRegenerateOpen(true)}
                >
                  {t('qrRegenerateAction')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title={t('qrDisableConfirmTitle')}
        size="sm"
      >
        <p className="text-sm text-[var(--fg-muted)] mb-4">{t('qrDisableConfirmBody')}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setDisableOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            loading={disablePending}
            onClick={runDisable}
          >
            {t('qrConfirmDisable')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        title={t('qrRegenerateConfirmTitle')}
        size="sm"
      >
        <p className="text-sm text-[var(--fg-muted)] mb-4">{t('qrRegenerateConfirmBody')}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setRegenerateOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            loading={regeneratePending}
            onClick={runRegenerate}
          >
            {t('qrConfirmRegenerate')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={pendingDestination !== null}
        onClose={cancelDestinationChange}
        title={t('qrDestinationConfirmTitle')}
        size="sm"
      >
        <p className="text-sm text-[var(--fg-muted)] mb-4">{t('qrDestinationConfirmBody')}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={cancelDestinationChange}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            loading={destinationPending}
            onClick={confirmDestinationChange}
          >
            {t('qrConfirmChangeDestination')}
          </Button>
        </div>
      </Modal>
    </section>
  )
}
