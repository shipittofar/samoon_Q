import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import { branchManagementService, resolveMockBranchTenantId } from './branch.service'
import type { ManagedQr, QrDestination, QrDestinationPayload } from '@/types/qr'
import { BRANCH_QR_DESTINATIONS, TENANT_QR_DESTINATIONS } from '@/types/qr'
import { normalizeManagedQr } from '@/lib/qr-management'
import type { ApiErrorBody } from '@/api/errors'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

type Owner = { kind: 'tenant'; id: string } | { kind: 'branch'; id: string }

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
  return kind === 'tenant' ? TENANT_QR_DESTINATIONS : BRANCH_QR_DESTINATIONS
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
  const destination = body?.destination
  if (!allowedDestinations(kind).includes(destination)) {
    throw httpError(400, {
      code: 'invalid_destination',
      message: 'Invalid destination.',
      errors: { destination: ['Invalid destination.'] },
    })
  }
  return destination
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
    const path = owner.kind === 'tenant' ? ENDPOINTS.TENANTS.QR(owner.id) : ENDPOINTS.BRANCHES.QR(owner.id)
    const { data } = await api.get(path)
    return parseResponse(data, owner.kind === 'tenant' ? 'tenant' : 'branch')
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
          destination: owner.kind === 'tenant' ? 'tenant' : 'branch',
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

  const paths =
    owner.kind === 'tenant'
      ? {
          enable: ENDPOINTS.TENANTS.QR_ENABLE(owner.id),
          disable: ENDPOINTS.TENANTS.QR_DISABLE(owner.id),
          regenerate: ENDPOINTS.TENANTS.QR_REGENERATE(owner.id),
        }
      : {
          enable: ENDPOINTS.BRANCHES.QR_ENABLE(owner.id),
          disable: ENDPOINTS.BRANCHES.QR_DISABLE(owner.id),
          regenerate: ENDPOINTS.BRANCHES.QR_REGENERATE(owner.id),
        }
  const { data } = await api.post(paths[action])
  return parseResponse(data, owner.kind === 'tenant' ? 'tenant' : 'branch')
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
  const path =
    owner.kind === 'tenant'
      ? ENDPOINTS.TENANTS.QR_DESTINATION(owner.id)
      : ENDPOINTS.BRANCHES.QR_DESTINATION(owner.id)
  const { data } = await api.patch(path, { destination: payload.destination })
  return parseResponse(data, owner.kind === 'tenant' ? 'tenant' : 'branch')
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

  _resetMock(): void {
    for (const key of Object.keys(MOCK_QR)) delete MOCK_QR[key]
  },
}
