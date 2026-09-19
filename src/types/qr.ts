/** Destination the public QR resolver redirects to after scan. */
export type QrDestination = 'tenant' | 'branch' | 'menu' | 'reservation'

export const QR_DESTINATIONS: readonly QrDestination[] = [
  'tenant',
  'branch',
  'menu',
  'reservation',
]

export const TENANT_QR_DESTINATIONS: readonly QrDestination[] = ['tenant']

export const BRANCH_QR_DESTINATIONS: readonly QrDestination[] = [
  'tenant',
  'branch',
  'menu',
  'reservation',
]

/** Backend QR payload attached to Tenant/Branch responses and GET …/qr/. */
export interface QrCode {
  /** Opaque QR identifier — not an authorization token. */
  code: string
  /** URL that must be encoded into the QR image. */
  url: string
  /** When false the resolver returns 410; the code/url stay the same. */
  is_active?: boolean | null
  /** Redirect target after scan. Tenant QR is always `tenant`. */
  destination?: QrDestination | null
}

/** Management GET/mutation response — same fields, status always present. */
export type ManagedQr = QrCode & {
  is_active: boolean
  destination: QrDestination
}

export interface QrDestinationPayload {
  destination: QrDestination
}
