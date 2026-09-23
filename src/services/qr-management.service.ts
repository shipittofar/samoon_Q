import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import { branchManagementService, resolveMockBranchTenantId } from './branch.service'
import type { ManagedQr, QrDestination, QrDestinationPayload, QrEntityType } from '@/types/qr'
import { qrDestinationsForEntity } from '@/types/qr'
import { isQrDestination, normalizeManagedQr } from '@/lib/qr-management'
import type { ApiErrorBody } from '@/api/errors'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

type Owner = { kind: QrEntityType; id: string }

function mockKey(owner: Owner): string {
  return `${owner.kind}:${owner.id}`
}

function randomCode(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function mockUrl(code: string): string {
  return `https://api.example.com/qr/${code}`
}

function httpError(status: number, body: ApiErrorBody): Error {
  const err = new Error(body.message || body.detail || 'Request failed') as Error & {
    response: { status: number; data: ApiErrorBody }
  }
  err.response = { status, data: body }
  return err
}

const MOCK_QR: Record<string, ManagedQr> = {}

function allowedDestinations(kind: Owner['kind']): readonly QrDestination[] {
  return qrDestinationsForEntity(kind)
}

function defaultDestination(kind: Owner['kind']): QrDestination {
  return kind
}

function qrPaths(owner: Owner) {
  const { kind, id } = owner
  if (kind === 'tenant') {
    return {
      get: ENDPOINTS.TENANTS.QR(id),
      enable: ENDPOINTS.TENANTS.QR_ENABLE(id),
      disable: ENDPOINTS.TENANTS.QR_DISABLE(id),
      regenerate: ENDPOINTS.TENANTS.QR_REGENERATE(id),
      destination: ENDPOINTS.TENANTS.QR_DESTINATION(id),
    }
  }
  if (kind === 'branch') {
    return {
      get: ENDPOINTS.BRANCHES.QR(id),
      enable: ENDPOINTS.BRANCHES.QR_ENABLE(id),
      disable: ENDPOINTS.BRANCHES.QR_DISABLE(id),
      regenerate: ENDPOINTS.BRANCHES.QR_REGENERATE(id),
      destination: ENDPOINTS.BRANCHES.QR_DESTINATION(id),
    }
  }
  if (kind === 'menu') {
    return {
      get: ENDPOINTS.MENU.QR(id),
      enable: ENDPOINTS.MENU.QR_ENABLE(id),
      disable: ENDPOINTS.MENU.QR_DISABLE(id),
      regenerate: ENDPOINTS.MENU.QR_REGENERATE(id),
      destination: ENDPOINTS.MENU.QR_DESTINATION(id),
    }
  }
  return {
    get: ENDPOINTS.RESERVATIONS.QR(id),
    enable: ENDPOINTS.RESERVATIONS.QR_ENABLE(id),
    disable: ENDPOINTS.RESERVATIONS.QR_DISABLE(id),
    regenerate: ENDPOINTS.RESERVATIONS.QR_REGENERATE(id),
    destination: ENDPOINTS.RESERVATIONS.QR_DESTINATION(id),
  }
}

async function seedFromEntity(owner: Owner): Promise<ManagedQr | null> {
  const existing = MOCK_QR[mockKey(owner)]
  if (existing) return { ...existing }
  try {
    if (owner.kind === 'tenant') {
      const tenant = await tenantService.getTenantById(owner.id)
      const qr = tenant.qr
      if (!qr?.code || !qr.url) return null
      const managed = normalizeManagedQr(
        { ...qr, is_active: qr.is_active ?? true, destination: qr.destination ?? 'tenant' },
        'tenant',
      )
      if (!managed) return null
      MOCK_QR[mockKey(owner)] = managed
      return { ...managed }
    }
    if (owner.kind === 'branch') {
      const tenantId = resolveMockBranchTenantId(owner.id)
      if (!tenantId) return null
      const branch = await branchManagementService.getBranch(owner.id, tenantId)
      const qr = branch.qr
      if (!qr?.code || !qr.url) return null
      const managed = normalizeManagedQr(
        { ...qr, is_active: qr.is_active ?? true, destination: qr.destination ?? 'branch' },
        'branch',
      )
      if (!managed) return null
      MOCK_QR[mockKey(owner)] = managed
      return { ...managed }
    }
    const code = randomCode()
    const created: ManagedQr = {
      code,
      url: mockUrl(code),
      is_active: true,
      destination: defaultDestination(owner.kind),
    }
    MOCK_QR[mockKey(owner)] = created
    return { ...created }
  } catch {
    return null
  }
}

async function requireMock(owner: Owner): Promise<ManagedQr> {
  const found = await seedFromEntity(owner)
  if (!found) {
    throw httpError(404, { code: 'qr_not_found', message: 'QR code is not available yet.' })
  }
  return found
}

function parseDestinationPayload(body: QrDestinationPayload, kind: Owner['kind']): QrDestination {
  const raw = body?.destination_type
  if (typeof raw !== 'string' || !raw.trim()) {
    throw httpError(400, { destination_type: ['This field is required.'] })
  }
  if (!isQrDestination(raw)) {
    throw httpError(400, {
      code: 'qr_invalid_destination',
      error: { code: 'qr_invalid_destination', message: 'Invalid QR destination type.' },
      message: 'Invalid QR destination type.',
    })
  }
  if (kind === 'tenant') return 'tenant'
  if (!allowedDestinations(kind).includes(raw)) {
    throw httpError(400, {
      code: 'qr_invalid_destination',
      error: { code: 'qr_invalid_destination', message: 'Invalid QR destination type.' },
      message: 'Invalid QR destination type.',
    })
  }
  return raw
}

function parseResponse(data: unknown, fallback: QrDestination): ManagedQr {
  const qr = normalizeManagedQr(data, fallback)
  if (!qr) {
    throw httpError(404, { code: 'qr_not_found', message: 'QR code is not available yet.' })
  }
  return qr
}

async function getQr(owner: Owner): Promise<ManagedQr | null> {
  if (USE_MOCK) {
    await delay()
    return seedFromEntity(owner)
  }
  try {
    const { data } = await api.get(qrPaths(owner).get)
    return parseResponse(data, defaultDestination(owner.kind))
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw err
  }
}

async function postQr(owner: Owner, action: 'enable' | 'disable' | 'regenerate'): Promise<ManagedQr> {
  if (USE_MOCK) {
    await delay()
    if (action === 'enable') {
      const existing = await seedFromEntity(owner)
      if (!existing) {
        const code = randomCode()
        const created: ManagedQr = {
          code,
          url: mockUrl(code),
          is_active: true,
          destination: defaultDestination(owner.kind),
        }
        MOCK_QR[mockKey(owner)] = created
        return { ...created }
      }
      const enabled = { ...existing, is_active: true }
      MOCK_QR[mockKey(owner)] = enabled
      return { ...enabled }
    }
    const current = await requireMock(owner)
    if (action === 'disable') {
      const disabled = { ...current, is_active: false }
      MOCK_QR[mockKey(owner)] = disabled
      return { ...disabled }
    }
    const code = randomCode()
    const regenerated: ManagedQr = {
      ...current,
      code,
      url: mockUrl(code),
      is_active: true,
    }
    MOCK_QR[mockKey(owner)] = regenerated
    return { ...regenerated }
  }

  const paths = qrPaths(owner)
  // Default axios Content-Type is application/json. An omitted body is an empty
  // stream, which DRF's JSON parser rejects before the enable/disable action runs.
  const { data } = await api.post(paths[action], {})
  return parseResponse(data, defaultDestination(owner.kind))
}

async function patchDestination(owner: Owner, payload: QrDestinationPayload): Promise<ManagedQr> {
  if (USE_MOCK) {
    await delay()
    const current = await requireMock(owner)
    const destination = parseDestinationPayload(payload, owner.kind)
    const updated = { ...current, destination }
    MOCK_QR[mockKey(owner)] = updated
    return { ...updated }
  }
  const { data } = await api.patch(qrPaths(owner).destination, {
    destination_type: payload.destination_type,
  })
  return parseResponse(data, defaultDestination(owner.kind))
}

export const qrManagementService = {
  getTenantQr: (tenantId: string) => getQr({ kind: 'tenant', id: tenantId }),
  enableTenantQr: (tenantId: string) => postQr({ kind: 'tenant', id: tenantId }, 'enable'),
  disableTenantQr: (tenantId: string) => postQr({ kind: 'tenant', id: tenantId }, 'disable'),
  regenerateTenantQr: (tenantId: string) => postQr({ kind: 'tenant', id: tenantId }, 'regenerate'),
  setTenantQrDestination: (tenantId: string, payload: QrDestinationPayload) =>
    patchDestination({ kind: 'tenant', id: tenantId }, payload),

  getBranchQr: (branchId: string) => getQr({ kind: 'branch', id: branchId }),
  enableBranchQr: (branchId: string) => postQr({ kind: 'branch', id: branchId }, 'enable'),
  disableBranchQr: (branchId: string) => postQr({ kind: 'branch', id: branchId }, 'disable'),
  regenerateBranchQr: (branchId: string) => postQr({ kind: 'branch', id: branchId }, 'regenerate'),
  setBranchQrDestination: (branchId: string, payload: QrDestinationPayload) =>
    patchDestination({ kind: 'branch', id: branchId }, payload),

  getMenuQr: (entityId: string) => getQr({ kind: 'menu', id: entityId }),
  enableMenuQr: (entityId: string) => postQr({ kind: 'menu', id: entityId }, 'enable'),
  disableMenuQr: (entityId: string) => postQr({ kind: 'menu', id: entityId }, 'disable'),
  regenerateMenuQr: (entityId: string) => postQr({ kind: 'menu', id: entityId }, 'regenerate'),
  setMenuQrDestination: (entityId: string, payload: QrDestinationPayload) =>
    patchDestination({ kind: 'menu', id: entityId }, payload),

  getReservationQr: (entityId: string) => getQr({ kind: 'reservation', id: entityId }),
  enableReservationQr: (entityId: string) => postQr({ kind: 'reservation', id: entityId }, 'enable'),
  disableReservationQr: (entityId: string) => postQr({ kind: 'reservation', id: entityId }, 'disable'),
  regenerateReservationQr: (entityId: string) =>
    postQr({ kind: 'reservation', id: entityId }, 'regenerate'),
  setReservationQrDestination: (entityId: string, payload: QrDestinationPayload) =>
    patchDestination({ kind: 'reservation', id: entityId }, payload),

  _resetMock(): void {
    for (const key of Object.keys(MOCK_QR)) delete MOCK_QR[key]
  },
}
