/**
 * Wallet API (backend wallet app): the signed-in user's balances and
 * ledger lines, and the platform superuser tools (search, adjust, freeze,
 * ledger health, limits). Money only moves on the server.
 */
import api from './axios.instance'

export interface WalletAccount {
  currency: string
  balance: string
  frozen: boolean
}

export type WalletTxKind = 'order_payment' | 'order_refund' | 'topup' | 'adjustment' | 'reversal'

export interface WalletLine {
  id: number
  transactionId: string
  kind: WalletTxKind
  currency: string
  amount: string
  balanceAfter: string
  description: string
  orderId: string | null
  orderNumber: string | null
  createdAt: string
}

export interface WalletLinesPage {
  results: WalletLine[]
  count: number
  page: number
  pageSize: number
}

export interface WalletUserRow {
  id: string
  name: string
  phone: string
  email: string
  accounts: WalletAccount[]
}

export interface WalletHealth {
  ok: boolean
  problems: string[]
  accounts: number
  transactions: number
}

export type WalletLimits = Partial<Record<'per_transaction' | 'daily_spend' | 'daily_topup', Record<string, string>>>

export type TopUpStatus = 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
export type TopUpMethod = 'bank' | 'crypto'
export type CoinKey = 'USDT_TRC20' | 'USDT_BEP20' | 'TON' | 'XRP'

export interface TopUpInstructions {
  address: string
  network: string
  coin: string
  amount: string
  memo: string
  memoLabel: string
}

export interface TopUp {
  id: string
  orderNumber: number
  method: TopUpMethod
  provider: string
  currency: string
  asset: string
  amount: string
  creditedAmount: string | null
  status: TopUpStatus
  receiptRef: string
  cardPan: string
  failureReason: string
  verified: boolean
  createdAt: string
  paidAt: string | null
  instructions: TopUpInstructions | null
}

export interface AdminTopUp extends TopUp {
  user: { id: string; name: string; phone: string; email: string }
  gatewayRef: string
  log: { at: string; event: string; data: unknown }[]
  reviewedBy: string | null
}

export interface TopUpCoinOption {
  key: CoinKey
  currency: string
  network: string
  min: string
  max: string
  providers: string[]
}

export interface TopUpOptions {
  bank: { providers: string[]; currency: string; min: string; max: string }
  crypto: TopUpCoinOption[]
  sandbox: boolean
}

export interface TopUpRedirect {
  url: string
  method: 'GET' | 'POST'
  fields: Record<string, string>
}

export interface TopUpCoinSettings {
  enabled: boolean
  min: string
  max: string
  address: string
}

export interface TopUpSettings {
  bank: { providers: string[]; min: string; max: string }
  crypto: { providers: string[]; coins: Record<CoinKey, TopUpCoinSettings> }
  expire_minutes: number
  configured?: Record<string, boolean>
  sandbox?: boolean
}

export interface Paged<T> {
  results: T[]
  count: number
  page: number
  pageSize: number
}

export const BANK_GATEWAYS = ['zarinpal', 'idpay', 'mellat', 'sadad'] as const
export const CRYPTO_GATEWAYS = ['nowpayments', 'cryptomus', 'direct'] as const
export const COIN_KEYS: CoinKey[] = ['USDT_TRC20', 'USDT_BEP20', 'TON', 'XRP']

/**
 * Send the browser to a gateway: GET with the fields as query string, or a
 * POST form (Bank Mellat wants RefId posted).
 */
export function goToGateway(redirect: TopUpRedirect, doc: Document = document): void {
  if (redirect.method === 'POST') {
    const form = doc.createElement('form')
    form.method = 'POST'
    form.action = redirect.url
    for (const [name, value] of Object.entries(redirect.fields)) {
      const input = doc.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    doc.body.appendChild(form)
    form.submit()
    return
  }
  const url = new URL(redirect.url, doc.location.href)
  for (const [name, value] of Object.entries(redirect.fields)) url.searchParams.set(name, value)
  doc.location.assign(url.toString())
}

export const walletService = {
  async mine(): Promise<WalletAccount[]> {
    const { data } = await api.get<{ accounts: WalletAccount[] }>('/wallet/')
    return data.accounts
  },
  async lines(params: { currency?: string; page?: number; pageSize?: number } = {}): Promise<WalletLinesPage> {
    const { data } = await api.get<WalletLinesPage>('/wallet/transactions/', { params })
    return data
  },
  topups: {
    async options(): Promise<TopUpOptions> {
      const { data } = await api.get<TopUpOptions>('/wallet/topups/options/')
      return data
    },
    async list(page = 1): Promise<Paged<TopUp>> {
      const { data } = await api.get<Paged<TopUp>>('/wallet/topups/', { params: { page, pageSize: 10 } })
      return data
    },
    async get(id: string): Promise<TopUp> {
      const { data } = await api.get<TopUp>(`/wallet/topups/${id}/`)
      return data
    },
    async start(body: {
      method: TopUpMethod
      provider: string
      amount: string
      asset?: string
    }): Promise<{ topup: TopUp; redirect?: TopUpRedirect; instructions?: TopUpInstructions }> {
      const { data } = await api.post('/wallet/topups/', body)
      return data
    },
    async submitTx(id: string, txHash: string): Promise<TopUp> {
      const { data } = await api.post<TopUp>(`/wallet/topups/${id}/tx/`, { txHash })
      return data
    },
    async cancel(id: string): Promise<TopUp> {
      const { data } = await api.post<TopUp>(`/wallet/topups/${id}/cancel/`)
      return data
    },
  },
  admin: {
    async topups(params: { status?: string; provider?: string; search?: string; page?: number }): Promise<Paged<AdminTopUp>> {
      const { data } = await api.get<Paged<AdminTopUp>>('/wallet/admin/topups/', { params })
      return data
    },
    async approveTopUp(id: string, body: { amount?: string; note?: string }): Promise<AdminTopUp> {
      const { data } = await api.post<AdminTopUp>(`/wallet/admin/topups/${id}/approve/`, body)
      return data
    },
    async rejectTopUp(id: string, reason: string): Promise<AdminTopUp> {
      const { data } = await api.post<AdminTopUp>(`/wallet/admin/topups/${id}/reject/`, { reason })
      return data
    },
    async topupSettings(): Promise<TopUpSettings> {
      const { data } = await api.get<TopUpSettings>('/wallet/admin/topup-settings/')
      return data
    },
    async saveTopupSettings(body: TopUpSettings): Promise<TopUpSettings> {
      const { data } = await api.put<TopUpSettings>('/wallet/admin/topup-settings/', body)
      return data
    },
    async users(search: string): Promise<WalletUserRow[]> {
      const { data } = await api.get<{ results: WalletUserRow[] }>('/wallet/admin/users/', { params: { search } })
      return data.results
    },
    async user(id: string, page = 1): Promise<WalletUserRow & { lines: WalletLinesPage }> {
      const { data } = await api.get(`/wallet/admin/users/${id}/`, { params: { page } })
      return data
    },
    async adjust(id: string, body: { currency: string; amount: string; reason: string; idempotencyKey: string }): Promise<WalletUserRow> {
      const { data } = await api.post(`/wallet/admin/users/${id}/adjust/`, body)
      return data
    },
    async freeze(id: string, currency: string, frozen: boolean): Promise<WalletUserRow> {
      const { data } = await api.post(`/wallet/admin/users/${id}/freeze/`, { currency, frozen })
      return data
    },
    async health(): Promise<WalletHealth> {
      const { data } = await api.get<WalletHealth>('/wallet/admin/health/')
      return data
    },
    async limits(): Promise<WalletLimits> {
      const { data } = await api.get<WalletLimits>('/wallet/admin/limits/')
      return data
    },
    async saveLimits(limits: WalletLimits): Promise<WalletLimits> {
      const { data } = await api.put<WalletLimits>('/wallet/admin/limits/', limits)
      return data
    },
  },
}

/** Balance in `currency` from a list of accounts (0 when there is none). */
export function balanceIn(accounts: WalletAccount[] | undefined, currency: string): number {
  const account = accounts?.find((a) => a.currency === currency.toUpperCase())
  return account ? parseFloat(account.balance) || 0 : 0
}
