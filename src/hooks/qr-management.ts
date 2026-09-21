import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qrManagementService } from '@/services/qr-management.service'
import { STALE_TIME } from '@/constants'
import {
  branchQrQueryKey,
  menuQrQueryKey,
  reservationQrQueryKey,
  tenantQrQueryKey,
  toQrSummary,
} from '@/lib/qr-management'
import { invalidateBranchQueryConsumers } from '@/lib/entity-sync'
import { useTenantStore } from '@/stores'
import type { ManagedQr, QrDestinationPayload } from '@/types/qr'
import type { Tenant } from '@/types'
import type { Branch as AdminBranch } from '@/types/branch'

function patchTenantQr(tenant: Tenant | undefined, qr: ManagedQr): Tenant | undefined {
  if (!tenant) return tenant
  return { ...tenant, qr: toQrSummary(qr) }
}

function patchBranchQr(branch: AdminBranch | undefined, qr: ManagedQr): AdminBranch | undefined {
  if (!branch) return branch
  return { ...branch, qr: toQrSummary(qr) }
}

function syncTenantCaches(qc: ReturnType<typeof useQueryClient>, tenantId: string, qr: ManagedQr) {
  qc.setQueryData(tenantQrQueryKey(tenantId), qr)
  const tenant = qc.getQueryData<Tenant>(['tenant', tenantId])
  const next = patchTenantQr(tenant, qr)
  if (next) qc.setQueryData(['tenant', tenantId], next)

  const store = useTenantStore.getState()
  if (store.tenant?.id === tenantId) {
    store.applyResolvedTenant({ ...store.tenant, qr: toQrSummary(qr) })
  }
}

function syncBranchCaches(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
  tenantId: string | undefined,
  qr: ManagedQr,
) {
  qc.setQueryData(branchQrQueryKey(branchId), qr)
  if (!tenantId) return
  const branch = qc.getQueryData<AdminBranch>(['admin-branch', tenantId, branchId])
  const next = patchBranchQr(branch, qr)
  if (next) qc.setQueryData(['admin-branch', tenantId, branchId], next)
  invalidateBranchQueryConsumers(qc, tenantId, branchId)
}

async function afterTenantQr(qc: ReturnType<typeof useQueryClient>, tenantId: string, qr: ManagedQr) {
  syncTenantCaches(qc, tenantId, qr)
  await qc.invalidateQueries({ queryKey: tenantQrQueryKey(tenantId) })
  await qc.invalidateQueries({ queryKey: ['tenant', tenantId] })
}

async function afterBranchQr(
  qc: ReturnType<typeof useQueryClient>,
  branchId: string,
  tenantId: string | undefined,
  qr: ManagedQr,
) {
  syncBranchCaches(qc, branchId, tenantId, qr)
  await qc.invalidateQueries({ queryKey: branchQrQueryKey(branchId) })
  if (tenantId) {
    await qc.invalidateQueries({ queryKey: ['admin-branch', tenantId, branchId] })
  }
}

async function afterMenuQr(qc: ReturnType<typeof useQueryClient>, entityId: string, qr: ManagedQr) {
  qc.setQueryData(menuQrQueryKey(entityId), qr)
  await qc.invalidateQueries({ queryKey: menuQrQueryKey(entityId) })
}

async function afterReservationQr(
  qc: ReturnType<typeof useQueryClient>,
  entityId: string,
  qr: ManagedQr,
) {
  qc.setQueryData(reservationQrQueryKey(entityId), qr)
  await qc.invalidateQueries({ queryKey: reservationQrQueryKey(entityId) })
}

export function useTenantQr(tenantId: string | undefined) {
  return useQuery({
    queryKey: tenantQrQueryKey(tenantId ?? ''),
    queryFn: () => qrManagementService.getTenantQr(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
  })
}

export function useBranchQr(branchId: string | undefined) {
  return useQuery({
    queryKey: branchQrQueryKey(branchId ?? ''),
    queryFn: () => qrManagementService.getBranchQr(branchId!),
    enabled: Boolean(branchId),
    staleTime: STALE_TIME,
  })
}

export function useEnableTenantQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tenantId: string) => qrManagementService.enableTenantQr(tenantId),
    onSuccess: (qr, tenantId) => afterTenantQr(qc, tenantId, qr),
  })
}

export function useDisableTenantQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tenantId: string) => qrManagementService.disableTenantQr(tenantId),
    onSuccess: (qr, tenantId) => afterTenantQr(qc, tenantId, qr),
  })
}

export function useRegenerateTenantQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tenantId: string) => qrManagementService.regenerateTenantQr(tenantId),
    onSuccess: (qr, tenantId) => afterTenantQr(qc, tenantId, qr),
  })
}

export function useSetTenantQrDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tenantId, payload }: { tenantId: string; payload: QrDestinationPayload }) =>
      qrManagementService.setTenantQrDestination(tenantId, payload),
    onSuccess: (qr, { tenantId }) => afterTenantQr(qc, tenantId, qr),
  })
}

export function useEnableBranchQr(tenantId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) => qrManagementService.enableBranchQr(branchId),
    onSuccess: (qr, branchId) => afterBranchQr(qc, branchId, tenantId, qr),
  })
}

export function useDisableBranchQr(tenantId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) => qrManagementService.disableBranchQr(branchId),
    onSuccess: (qr, branchId) => afterBranchQr(qc, branchId, tenantId, qr),
  })
}

export function useRegenerateBranchQr(tenantId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) => qrManagementService.regenerateBranchQr(branchId),
    onSuccess: (qr, branchId) => afterBranchQr(qc, branchId, tenantId, qr),
  })
}

export function useSetBranchQrDestination(tenantId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, payload }: { branchId: string; payload: QrDestinationPayload }) =>
      qrManagementService.setBranchQrDestination(branchId, payload),
    onSuccess: (qr, { branchId }) => afterBranchQr(qc, branchId, tenantId, qr),
  })
}

export function useMenuQr(entityId: string | undefined) {
  return useQuery({
    queryKey: menuQrQueryKey(entityId ?? ''),
    queryFn: () => qrManagementService.getMenuQr(entityId!),
    enabled: Boolean(entityId),
    staleTime: STALE_TIME,
  })
}

export function useReservationQr(entityId: string | undefined) {
  return useQuery({
    queryKey: reservationQrQueryKey(entityId ?? ''),
    queryFn: () => qrManagementService.getReservationQr(entityId!),
    enabled: Boolean(entityId),
    staleTime: STALE_TIME,
  })
}

export function useEnableMenuQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.enableMenuQr(entityId),
    onSuccess: (qr, entityId) => afterMenuQr(qc, entityId, qr),
  })
}

export function useDisableMenuQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.disableMenuQr(entityId),
    onSuccess: (qr, entityId) => afterMenuQr(qc, entityId, qr),
  })
}

export function useRegenerateMenuQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.regenerateMenuQr(entityId),
    onSuccess: (qr, entityId) => afterMenuQr(qc, entityId, qr),
  })
}

export function useSetMenuQrDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, payload }: { entityId: string; payload: QrDestinationPayload }) =>
      qrManagementService.setMenuQrDestination(entityId, payload),
    onSuccess: (qr, { entityId }) => afterMenuQr(qc, entityId, qr),
  })
}

export function useEnableReservationQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.enableReservationQr(entityId),
    onSuccess: (qr, entityId) => afterReservationQr(qc, entityId, qr),
  })
}

export function useDisableReservationQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.disableReservationQr(entityId),
    onSuccess: (qr, entityId) => afterReservationQr(qc, entityId, qr),
  })
}

export function useRegenerateReservationQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entityId: string) => qrManagementService.regenerateReservationQr(entityId),
    onSuccess: (qr, entityId) => afterReservationQr(qc, entityId, qr),
  })
}

export function useSetReservationQrDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, payload }: { entityId: string; payload: QrDestinationPayload }) =>
      qrManagementService.setReservationQrDestination(entityId, payload),
    onSuccess: (qr, { entityId }) => afterReservationQr(qc, entityId, qr),
  })
}
