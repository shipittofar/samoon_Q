/**
 * Settlement API (backend settlement app): a business's balances, commission
 * terms, payout accounts and payout requests; and the platform superuser's
 * settings, per-business terms, payout queue and account approvals.
 * Payouts are paid by hand: a superuser sends the money and records the reference.
 */
import api from './axios.instance'
import type { CoinKey, Paged } from './wallet.service'

export interface SettlementTerms {
  commissionPercent: string
  holdDays: number
  commissionIsCustom: boolean
  holdIsCustom: boolean
  note: string
  platformCommissionPercent: string
  platformHoldDays: number
}

export interface SettlementBalance {
  currency: string
  available: string
  pending: string
  reserved: string
  /** Commission owed on cash/card orders (available went below zero). */
  owed: string
  nextRelease: string | null
}

export type PayoutAccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

export interface PayoutAccount {
  id: string
  tenantId: string
  tenantName?: string
  kind: 'iban' | 'crypto'
  currency: string
  iban: string
  holderName: string
  bankName: string
  asset: CoinKey | ''
  address: string
  memo: string
  label: string
  isDefault: boolean
  status: PayoutAccountStatus
  reviewNote: string
  createdAt: string
  reviewedAt: string | null
}

export type PayoutStatus = 'requested' | 'paid' | 'rejected' | 'cancelled'

export interface Payout {
  id: string
  currency: string
  amount: string
  status: PayoutStatus
  automatic: boolean
  reference: string
  note: string
  account: PayoutAccount
  createdAt: string
  processedAt: string | null
  tenant?: { id: string; name: string }
}

export interface SettlementOverview {
  terms: SettlementTerms
  balances: SettlementBalance[]
  accounts: PayoutAccount[]
  openPayouts: Payout[]
  minPayout: Record<string, string>
}

export type StatementKind =
  | 'order_payment'
  | 'order_refund'
  | 'commission'
  | 'release'
  | 'payout_hold'
  | 'payout'
  | 'payout_return'

export interface StatementLine {
  id: number
  kind: StatementKind
  bucket: 'available' | 'pending' | 'reserved'
  currency: string
  amount: string
  balanceAfter: string
  orderId: string | null
  orderNumber: string | null
  description: string
  createdAt: string
}

export interface OrderSettlementRow {
  orderId: string
  orderNumber: string
  currency: string
  gross: string
  commissionPercent: string
  commission: string
  net: string
  viaWallet: boolean
  status: 'held' | 'released' | 'charged'
  completedAt: string
  releaseAfter: string | null
}

export interface SettlementSettings {
  commission_percent: string
  hold_days: number
  min_payout: Record<string, string>
  auto_payout: { enabled: boolean; weekday: number }
}

export interface PlatformSettlementOverview {
  currencies: {
    currency: string
    available: string
    owed: string
    pending: string
    reserved: string
    revenue: string
    paidOut: string
  }[]
  openPayouts: number
  pendingAccounts: number
}

export interface TenantSettlementRow {
  id: string
  name: string
  terms: SettlementTerms
  balances: SettlementBalance[]
}

export interface NewPayoutAccount {
  kind: 'iban' | 'crypto'
  iban?: string
  holderName?: string
  bankName?: string
  asset?: CoinKey
  address?: string
  memo?: string
  label?: string
}

const base = (tenantId: string) => `/settlement/tenants/${tenantId}`

export const settlementService = {
  async overview(tenantId: string): Promise<SettlementOverview> {
    const { data } = await api.get<SettlementOverview>(`${base(tenantId)}/overview/`)
    return data
  },
  async statement(
    tenantId: string,
    params: { currency?: string; from?: string; to?: string; page?: number } = {},
  ): Promise<Paged<StatementLine>> {
    const { data } = await api.get<Paged<StatementLine>>(`${base(tenantId)}/statement/`, { params })
    return data
  },
  async statementCsv(tenantId: string, params: { currency?: string; from?: string; to?: string } = {}): Promise<Blob> {
    const { data } = await api.get<Blob>(`${base(tenantId)}/statement.csv`, { params, responseType: 'blob' })
    return data
  },
  async orders(tenantId: string, page = 1): Promise<Paged<OrderSettlementRow>> {
    const { data } = await api.get<Paged<OrderSettlementRow>>(`${base(tenantId)}/orders/`, { params: { page } })
    return data
  },
  async addAccount(tenantId: string, body: NewPayoutAccount): Promise<PayoutAccount> {
    const { data } = await api.post<PayoutAccount>(`${base(tenantId)}/accounts/`, body)
    return data
  },
  async disableAccount(tenantId: string, id: string): Promise<PayoutAccount> {
    const { data } = await api.post<PayoutAccount>(`${base(tenantId)}/accounts/${id}/disable/`)
    return data
  },
  async defaultAccount(tenantId: string, id: string): Promise<PayoutAccount> {
    const { data } = await api.post<PayoutAccount>(`${base(tenantId)}/accounts/${id}/default/`)
    return data
  },
  async payouts(tenantId: string, page = 1): Promise<Paged<Payout>> {
    const { data } = await api.get<Paged<Payout>>(`${base(tenantId)}/payouts/`, { params: { page } })
    return data
  },
  async requestPayout(tenantId: string, body: { accountId: string; amount: string }): Promise<Payout> {
    const { data } = await api.post<Payout>(`${base(tenantId)}/payouts/`, body)
    return data
  },
  async cancelPayout(tenantId: string, id: string): Promise<Payout> {
    const { data } = await api.post<Payout>(`${base(tenantId)}/payouts/${id}/cancel/`)
    return data
  },
  admin: {
    async settings(): Promise<SettlementSettings> {
      const { data } = await api.get<SettlementSettings>('/settlement/admin/settings/')
      return data
    },
    async saveSettings(body: SettlementSettings): Promise<SettlementSettings> {
      const { data } = await api.put<SettlementSettings>('/settlement/admin/settings/', body)
      return data
    },
    async overview(): Promise<PlatformSettlementOverview> {
      const { data } = await api.get<PlatformSettlementOverview>('/settlement/admin/overview/')
      return data
    },
    async tenants(search: string, page = 1): Promise<Paged<TenantSettlementRow>> {
      const { data } = await api.get<Paged<TenantSettlementRow>>('/settlement/admin/tenants/', { params: { search, page } })
      return data
    },
    async saveTerms(
      tenantId: string,
      body: { commissionPercent: string; holdDays: string; note: string },
    ): Promise<SettlementTerms> {
      const { data } = await api.put<SettlementTerms>(`/settlement/admin/tenants/${tenantId}/terms/`, body)
      return data
    },
    async payouts(params: { status?: string; search?: string; page?: number }): Promise<Paged<Payout>> {
      const { data } = await api.get<Paged<Payout>>('/settlement/admin/payouts/', { params })
      return data
    },
    async markPaid(id: string, body: { reference: string; note?: string }): Promise<Payout> {
      const { data } = await api.post<Payout>(`/settlement/admin/payouts/${id}/paid/`, body)
      return data
    },
    async rejectPayout(id: string, reason: string): Promise<Payout> {
      const { data } = await api.post<Payout>(`/settlement/admin/payouts/${id}/reject/`, { reason })
      return data
    },
    async accounts(status = 'pending', page = 1): Promise<Paged<PayoutAccount>> {
      const { data } = await api.get<Paged<PayoutAccount>>('/settlement/admin/accounts/', { params: { status, page } })
      return data
    },
    async reviewAccount(id: string, approve: boolean, note = ''): Promise<PayoutAccount> {
      const { data } = await api.post<PayoutAccount>(`/settlement/admin/accounts/${id}/${approve ? 'approve' : 'reject'}/`, { note })
      return data
    },
  },
}

/** Sheba (IBAN) check: "IR" + 24 digits with a valid mod-97 checksum. */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/[\s-]/g, '').toUpperCase()
  const full = iban.startsWith('IR') ? iban : `IR${iban}`
  if (!/^IR\d{24}$/.test(full)) return false
  const rearranged = full.slice(4) + full.slice(0, 4)
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

/** Short form of an account for lists: IR8205…9002 (Sara) / USDT_TRC20 TJYeas…kSvR */
export function accountLabel(a: Pick<PayoutAccount, 'kind' | 'iban' | 'holderName' | 'asset' | 'address' | 'label'>): string {
  const main =
    a.kind === 'iban'
      ? `${a.iban.slice(0, 6)}…${a.iban.slice(-4)}${a.holderName ? ` (${a.holderName})` : ''}`
      : `${a.asset.replace('_', ' ')} ${a.address.slice(0, 6)}…${a.address.slice(-4)}`
  return a.label ? `${a.label} · ${main}` : main
}
