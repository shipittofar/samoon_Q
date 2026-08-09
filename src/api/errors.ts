import type { AxiosError } from 'axios'

export interface ApiErrorBody {
  code?: string
  message?: string
  detail?: string
  errors?: Record<string, string[] | string>
}

/** Extract backend validation / error message for UI display. */
export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!error || typeof error !== 'object') return fallback
  const ax = error as AxiosError<ApiErrorBody>
  const data = ax.response?.data
  if (!data) {
    if (ax.message) return ax.message
    return fallback
  }
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (typeof data.detail === 'string' && data.detail.trim()) return data.detail
  if (data.errors && typeof data.errors === 'object') {
    const parts: string[] = []
    for (const [field, val] of Object.entries(data.errors)) {
      if (Array.isArray(val)) parts.push(...val.map((m) => `${field}: ${m}`))
      else if (typeof val === 'string') parts.push(`${field}: ${val}`)
    }
    if (parts.length > 0) return parts.join('; ')
  }
  return fallback
}

export function getApiErrorCode(error: unknown): string | undefined {
  const ax = error as AxiosError<ApiErrorBody>
  return ax.response?.data?.code
}

export function getApiStatus(error: unknown): number | undefined {
  const ax = error as AxiosError
  return ax.response?.status
}
