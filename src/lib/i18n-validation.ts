/**
 * Centralized validation message keys — P9.5.1B Phase E.
 *
 * Zod schemas run outside React (no hook access), so they can't call
 * `useTranslations()` directly. The pattern: schemas set `error.message` to
 * one of these keys (not literal English text), and the component renders
 * it via `useTranslations('validation')(errors.field.message)` — see
 * `src/app/login/page.tsx` for the reference implementation.
 *
 * Keep this list in sync with the `validation` namespace in
 * `src/i18n/locales/*.json` — every key here must exist there.
 */
export const VALIDATION_KEYS = {
  required: 'required',
  invalidPhone: 'invalid_phone',
  invalidEmail: 'invalid_email',
  invalidPassword: 'invalid_password',
  otpExpired: 'otp_expired',
  tooManyAttempts: 'too_many_attempts',
  networkError: 'network_error',
  permissionDenied: 'permission_denied',
  unknownError: 'unknown_error',
} as const

export type ValidationKey = (typeof VALIDATION_KEYS)[keyof typeof VALIDATION_KEYS]
