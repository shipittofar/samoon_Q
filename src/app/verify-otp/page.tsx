'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/stores'
import toast from 'react-hot-toast'
import { OTP_LIMIT } from '@/lib/rate-limit'
import { useConfigurationField } from '@/hooks/use-platform-configuration'
import { useTranslations } from 'next-intl'

// P9.1.2 — fallback matches the platform default in src/config/modules/authentication.ts
const FALLBACK_RESEND_SECONDS = 60

function OTPContent() {
  const router = useRouter()
  const params = useSearchParams()
  const phone_number = params.get('phone_number') ?? ''
  const dialCode = params.get('dialCode') ?? ''
  const { setUser } = useAuthStore()
  const t = useTranslations('auth')
  const tValidation = useTranslations('validation')
  const tNotifications = useTranslations('notifications')

  // P9.1.2 — resend cooldown now resolves through the Platform Configuration
  // Foundation (authentication.otp.resend_cooldown_seconds) instead of a
  // hardcoded literal. Default is unchanged (60s).
  const { resolved: resendCooldownField } = useConfigurationField('authentication.otp.resend_cooldown_seconds')
  const RESEND_SECONDS = (resendCooldownField?.value as number | undefined) ?? FALLBACK_RESEND_SECONDS

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
    if (next.every((d) => d !== '') && next.join('').length === 6) {
      handleVerify(next.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      handleVerify(pasted)
    }
  }

  const handleVerify = async (code: string) => {
    if (code.length < 6) return
    const rateCheck = OTP_LIMIT.check(phone_number)
    if (!rateCheck.allowed) {
      toast.error(tValidation('too_many_attempts'))
      return
    }
    setLoading(true)
    try {
      const result = await authService.verifyOTP({ phone_number, dialCode, otp: code })
      OTP_LIMIT.reset(phone_number)
      // P10.8 — is_new_user: true means registration is NOT complete.
      // authService.verifyOTP() already withheld tokens/session for this
      // case (see docs/P10.8_OTP_AUTH_FLOW_SPLIT.md) — this page's only
      // responsibility here is the redirect; it must not call setUser()
      // or otherwise behave like a successful login.
      if (result.is_new_user) {
        router.push(`/complete-profile?phone_number=${encodeURIComponent(phone_number)}&dialCode=${encodeURIComponent(dialCode)}`)
        return
      }
      setUser(result.user)
      toast.success(`${tNotifications('phoneVerified')} 🎉`)
      router.push('/')
    } catch {
      toast.error(t('invalidOtp'))
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await authService.sendOTP({ phone_number, dialCode, })
      setCountdown(RESEND_SECONDS)
      toast.success(t('otpResent'))
    } catch {
      toast.error(t('otpResendFailed'))
    } finally {
      setResending(false)
    }
  }

  const filled = otp.filter(Boolean).length

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Link href="/"className="flex items-center gap-2 mb-10 justify-center">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Samoon</span>
        </Link>

        <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-xl p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[var(--accent-subtle)] mb-5"
          >
            <Shield className="h-8 w-8 text-[var(--accent-text)]"/>
          </motion.div>

          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
            {t('verifyYourNumber')}
          </h1>
          <p className="text-[var(--fg-muted)] text-sm mb-1">
            {t('weSentCodeTo')}
          </p>
          <p className="font-semibold text-[var(--fg)] mb-8">
            {phone_number || '+1 *** *** **00'}
          </p>

          {/* OTP Input */}
          <div className="flex gap-2 justify-center mb-8"onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`
                  h-12 w-10 rounded-xl border-2 text-center text-lg font-bold transition-all
                  focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/20
                  ${digit
                    ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--fg)]'
                    : 'border-[var(--border)] bg-[var(--input-bg)] text-[var(--fg)]'
                  }
                `}
                aria-label={t('digitLabel', { position: index + 1 })}
                disabled={loading}
              />
            ))}
          </div>

          {/* Progress indicator */}
          <div className="flex gap-1 justify-center mb-6">
            {otp.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${i < filled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                  }`}
              />
            ))}
          </div>

          <Button
            className="w-full mb-4"
            size="lg"
            loading={loading}
            disabled={filled < 6}
            onClick={() => handleVerify(otp.join(''))}
          >
            {loading ? t('verifying') : t('verifyCode')}
          </Button>

          {/* Resend */}
          <div className="text-sm text-[var(--fg-muted)]">
            {countdown > 0 ? (
              <p>{t('resendCodeIn')} <span className="font-semibold text-[var(--accent-text)]">{countdown}s</span></p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-[var(--accent-text)] hover:text-[var(--accent-text)] font-medium flex items-center gap-1.5 mx-auto transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                {resending ? t('sendingResend') : t('resendCode')}
              </button>
            )}
          </div>

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mt-6"
          >
            <ArrowLeft className="h-3.5 w-3.5"/>
            {t('backToSignIn')}
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default function VerifyOTPPage() {
  return <Suspense><OTPContent /></Suspense>
}
