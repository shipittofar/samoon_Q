/** True when value is an absolute http(s) URL suitable to encode in a QR image. */
export function isHttpQrUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Backend resolver path `/qr/<code>` — encode as provided, never a storefront slug. */
export function isQrResolverPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^\/qr\/[A-Za-z0-9_-]+\/?$/.test(value.trim())
}

/** Absolute http(s) `qr.url` or backend resolver path. Rejects `/{tenantSlug}`. */
export function isEncodableQrUrl(value: unknown): value is string {
  return isHttpQrUrl(value) || isQrResolverPath(value)
}
