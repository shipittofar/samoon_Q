/** Default visible prefixes for Tenant public-profile inputs. */

export const WEBSITE_PREFIX = 'www.'
export const SOCIAL_PREFIX = '@'

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

/** Empty → prefix. Existing saved values are returned unchanged. */
export function initPrefixedField(saved: string | undefined | null, prefix: string): string {
  if (saved == null || !saved.trim()) return prefix
  return saved
}

/**
 * Keep a single leading prefix. Does not stack `www.www.` or `@@`.
 * HTTP(S) URLs are left as-is (no extra `www.` / `@`).
 */
export function applyPrefixInput(next: string, prefix: string): string {
  if (next.length === 0) return prefix
  let v = next
  const doubled = prefix + prefix
  while (v.startsWith(doubled)) {
    v = v.slice(prefix.length)
  }
  if (isHttpUrl(v)) return v
  return v
}

/** Persist empty / prefix-only fields as unset. */
export function valueForPrefixedSave(value: string, prefix: string): string | undefined {
  const v = value.trim()
  if (!v || v === prefix) return undefined
  return v
}

export function galleryUrlsFromImageFields(
  fields: Array<{ file: File | null; existingUrl: string; cleared: boolean }>,
  fileToUrl: (file: File) => string,
): string[] {
  const urls: string[] = []
  for (const field of fields) {
    if (field.cleared) continue
    if (field.file) {
      const url = fileToUrl(field.file)
      if (url) urls.push(url)
      continue
    }
    if (field.existingUrl) urls.push(field.existingUrl)
  }
  return urls
}
