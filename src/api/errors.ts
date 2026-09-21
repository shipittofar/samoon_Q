import type { AxiosError } from 'axios'

export interface ApiErrorBody {
  code?: string
  message?: string
  detail?: string
  errors?: Record<string, string[] | string>
  error?: {
    code?: string
    message?: string
  }
  [key: string]: unknown
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
  const nested = data.error
  if (nested && typeof nested === 'object' && typeof nested.message === 'string' && nested.message.trim()) {
    return nested.message
  }
  if (data.errors && typeof data.errors === 'object') {
    const parts: string[] = []
    for (const [field, val] of Object.entries(data.errors)) {
      if (Array.isArray(val)) parts.push(...val.map((m) => `${field}: ${m}`))
      else if (typeof val === 'string') parts.push(`${field}: ${val}`)
    }
    if (parts.length > 0) return parts.join('; ')
  }
  const fieldParts: string[] = []
  for (const [field, val] of Object.entries(data)) {
    if (field === 'code' || field === 'message' || field === 'detail' || field === 'errors' || field === 'error') continue
    if (Array.isArray(val)) {
      fieldParts.push(...val.filter((item): item is string => typeof item === 'string').map((m) => `${field}: ${m}`))
    }
  }
  if (fieldParts.length > 0) return fieldParts.join('; ')
  return fallback
}

export function getApiErrorCode(error: unknown): string | undefined {
  const ax = error as AxiosError<ApiErrorBody>
  const data = ax.response?.data
  if (typeof data?.code === 'string' && data.code) return data.code
  if (data?.error && typeof data.error === 'object' && typeof data.error.code === 'string') {
    return data.error.code
  }
  return undefined
}

export function getApiStatus(error: unknown): number | undefined {
  const ax = error as AxiosError
  return ax.response?.status
}
