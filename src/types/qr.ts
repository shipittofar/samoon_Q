/** Backend QR payload attached to Tenant and Branch responses. */
export interface QrCode {
  /** Opaque QR identifier — not an authorization token. */
  code: string
  /** URL that must be encoded into the QR image. */
  url: string
}
