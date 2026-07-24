'use client'

/**
 * P8.9.2 — OTP verification page (/verify).
 *
 * Full phone_number-auth verification screen. Mock behavior:
 *  - Code '000000' always fails (error-state UX demo)
 *  - Any other 6-digit code succeeds
 *  - Known demo phones → login as demo user → role-aware redirect
 *  - Unknown phones → /complete-profile (new user registration)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Phone, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { OTPInput } from '@/components/ui/OTPInput'
import { Button } from '@/components/ui/Button'
import { useVerifyOTP, useSendOTP } from '@/hooks'
import { useConfigurationField } from '@/hooks/use-platform-configuration'
import { dispatchPostLoginRedirect } from '@/lib/post-auth-navigation'
import toast from 'react-hot-toast'
import type {
  VerifyOTPRequest,
} from '@/types'


// P9.1.2 — fallback values match the platform defaults registered in
// src/config/modules/authentication.ts, used only if the registry lookup
// ever returns undefined (e.g. during a hot-reload edge case).
const FALLBACK_RESEND_SECONDS = 60
const FALLBACK_MAX_ATTEMPTS = 3

// ── Countdown hook ─────────────────────────────────────────────────────────────

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  const [active, setActive] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    setSeconds(initial)
    setActive(true)
  }, [initial])

  useEffect(() => {
    if (!active) return
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active])

  return { seconds, expired: !active, start }
}

// ── State machine ──────────────────────────────────────────────────────────────

type VerifyState = 'pending' | 'verifying' | 'invalid' | 'tooManyAttempts' | 'success'

// ── Inner page (reads search params) ──────────────────────────────────────────

function VerifyPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const phone_number = params.get('phone_number') ?? ''
  const dialCode = params.get('dialCode') ?? ''
  const prefersReducedMotion = useReducedMotion()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  const { mutate: verifyOTP } = useVerifyOTP()
  const { mutate: sendOTP, isPending: isResending } = useSendOTP()

  // P9.1.2 — Runtime Integration: resend cooldown and max verify attempts now
  // resolve through the Platform Configuration Foundation
  // (authentication.otp.resend_cooldown_seconds / authentication.otp.max_verify_attempts)
  // instead of hardcoded literals. Defaults are unchanged (60s / 3 attempts).
  const { resolved: resendCooldownField } = useConfigurationField('authentication.otp.resend_cooldown_seconds')
  const { resolved: maxAttemptsField } = useConfigurationField('authentication.otp.max_verify_attempts')
  const RESEND_SECONDS = (resendCooldownField?.value as number | undefined) ?? FALLBACK_RESEND_SECONDS
  const MAX_ATTEMPTS = (maxAttemptsField?.value as number | undefined) ?? FALLBACK_MAX_ATTEMPTS
  const { resolved: mockAuthField } = useConfigurationField('authentication.mock_authentication_enabled')
  const mockHintVisible = process.env.NEXT_PUBLIC_USE_MOCK === 'true' && (mockAuthField?.value as boolean | undefined) !== false

  const [otp, setOtp] = useState('')
  const [state, setState] = useState<VerifyState>('pending')
  const [attempts, setAttempts] = useState(0)
  const { seconds, expired: resendReady, start: restartCountdown } = useCountdown(RESEND_SECONDS)

  // Redirect if no phone_number provided
  useEffect(() => {
    if (!phone_number) router.replace('/login')
  }, [phone_number, router])

  // Mask phone_number for display: e.g. +1 •••• 0101
  const maskedPhone = phone_number.length > 6
    ? `${phone_number.slice(0, 3)} ${'•'.repeat(phone_number.length - 6)} ${phone_number.slice(-4)}`
    : phone_number

  const handleComplete = useCallback((code: string) => {
    if (state !== 'pending' && state !== 'invalid') return
    setState('verifying')

    verifyOTP({ phone_number, dialCode, otp: code }, {
      onSuccess: (result) => {
        setState('success')
        // P10.8 — is_new_user: true means registration is NOT complete
        // (no session was initialized by useVerifyOTP() for this case —
        // see docs/P10.8_OTP_AUTH_FLOW_SPLIT.md). This page's only
        // responsibility for a new user is the redirect below; dialCode
        // is forwarded so /complete-profile never has to guess it.
        const dest = result.is_new_user
          ? `/complete-profile?phone_number=${encodeURIComponent(phone_number)}&dialCode=${encodeURIComponent(dialCode)}`
          : null

        setTimeout(() => {
          if (dest) {
            router.push(dest)
          } else if (!result.is_new_user) {
            dispatchPostLoginRedirect(result.user, result.p7Roles)
          }
        }, prefersReducedMotion ? 100 : 1200)
      },
      onError: () => {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setOtp('')
        if (newAttempts >= MAX_ATTEMPTS) {
          setState('tooManyAttempts')
        } else {
          setState('invalid')
          // Reset to pending after animation
          setTimeout(() => setState('pending'), 600)
        }
      },
    })
  }, [state, phone_number, otp, attempts, verifyOTP, router, prefersReducedMotion, MAX_ATTEMPTS])

  const handleResend = () => {
    sendOTP(
      {
        phone_number,
        dialCode,
      },
      {
      onSuccess: () => {
        toast.success(t('otpResent'))
        setOtp('')
        setAttempts(0)
        setState('pending')
        restartCountdown()
      },
      onError: () => toast.error(t('otpResendFailed')),
    })
  }

  const motionBase = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <motion.div {...motionBase} className="w-full max-w-sm">

        {/* Back link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
          {tCommon('back')}
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">S</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {state === 'success' ? (
            /* ── Success state ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: prefersReducedMotion ? 1 : 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6 mx-auto"
              >
                <CheckCircle2 className="h-10 w-10 text-green-500" aria-hidden="true" />
              </motion.div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
                {t('verified')}
              </h1>
              <p className="text-[var(--fg-muted)]">{t('takingYouToAccount')}</p>
              <span role="status" className="sr-only">{t('phoneVerifiedRedirecting')}</span>
            </motion.div>
          ) : state === 'tooManyAttempts' ? (
            /* ── Too many attempts ── */
            <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4 mx-auto">
                <Phone className="h-8 w-8 text-red-500" aria-hidden="true" />
              </div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
                {t('tooManyAttemptsHeading')}
              </h1>
              <p className="text-[var(--fg-muted)] mb-6 text-sm">
                {t('requestNewCodeToContinue')}
              </p>
              <Button
                type="button"
                onClick={handleResend}
                loading={isResending}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                className="w-full"
                size="lg"
              >
                {t('sendNewCode')}
              </Button>
            </motion.div>
          ) : (
            /* ── Normal / verifying / invalid states ── */
            <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
                {t('enterTheCode')}
              </h1>
              <p className="text-[var(--fg-muted)] mb-8 text-sm">
                {t('weSentCodeTo')}{' '}
                <span className="font-medium text-[var(--fg)] font-mono">{maskedPhone}</span>
              </p>

              {/* OTP boxes */}
              <div className="flex justify-center mb-6">
                <OTPInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleComplete}
                  disabled={state === 'verifying'}
                  error={state === 'invalid'}
                  autoFocus
                />
              </div>

              {/* Error message */}
              <AnimatePresence>
                {state === 'invalid' && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="text-center text-sm text-red-500 mb-4"
                  >
                    {t('wrongCodeAttemptsRemaining', { count: MAX_ATTEMPTS - attempts })}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Verify button */}
              <Button
                type="button"
                className="w-full mb-6"
                size="lg"
                loading={state === 'verifying'}
                disabled={otp.length < 6 || state === 'verifying'}
                onClick={() => otp.length === 6 && handleComplete(otp)}
              >
                {state === 'verifying' ? t('verifying') : t('verify')}
              </Button>

              {/* Resend section */}
              <div className="text-center">
                {resendReady ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="inline-flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {isResending ? t('sendingResend') : t('resendCode')}
                  </button>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">
                    {t('resendCodeIn')}{' '}
                    <span
                      role="timer"
                      aria-live="polite"
                      aria-label={t('secondsRemainingAria', { seconds })}
                      className="font-mono tabular-nums text-[var(--fg)]"
                    >
                      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
                    </span>
                  </p>
                )}
              </div>

              {/* Dev hint (mock mode only) */}
              {mockHintVisible && (
                <p className="mt-6 text-center text-[11px] text-[var(--fg-muted)] opacity-60">
                  {t('mockModeHint', { code: '000000' })}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Wrapper with Suspense (required for useSearchParams in Next.js 15) ─────────

function VerifyPageFallback() {
  const tCommon = useTranslations('common')
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" aria-label={tCommon('loading')} />
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyPageFallback />}>
      <VerifyPageInner />
    </Suspense>
  )
}