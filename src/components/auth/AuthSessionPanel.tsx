'use client'

/**
 * Shared in-place authentication UI (login / OTP / complete-profile / register).
 * Used by AuthModal on checkout. Does not navigate after success.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, RefreshCw,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { OTPInput } from '@/components/ui/OTPInput'
import { useLogin, useRegister, useSendOTP, useVerifyOTP } from '@/hooks'
import { useConfigurationField } from '@/hooks/use-platform-configuration'
import { ForgotPasswordPanel } from '@/app/login/ForgotPasswordPanel'
import { LOGIN_LIMIT } from '@/lib/rate-limit'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'
import Link from 'next/link'

const FALLBACK_RESEND_SECONDS = 60
const FALLBACK_MAX_ATTEMPTS = 3

const emailSchema = z.object({
  email: z.string().email('invalid_email'),
  password: z.string().min(6, 'invalid_password'),
})
type EmailFormData = z.infer<typeof emailSchema>

const profileSchema = z.object({
  first_name: z.string().min(1, 'required').max(50),
  last_name: z.string().min(1, 'required').max(50),
  terms: z.literal(true, { errorMap: () => ({ message: 'must_accept_terms' }) }),
})
type ProfileFormData = z.infer<typeof profileSchema>

const registerSchema = z.object({
  first_name: z.string().min(2, 'required'),
  last_name: z.string().min(2, 'required'),
  email: z.string().email('invalid_email'),
  phone_number: z.string().min(10, 'invalid_phone').optional().or(z.literal('')),
  password: z.string().min(8, 'invalid_password'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'passwords_do_not_match',
  path: ['confirm_password'],
})
type RegisterFormData = z.infer<typeof registerSchema>

type AuthView =
  | 'phone'
  | 'email'
  | 'forgot-password'
  | 'otp'
  | 'complete-profile'
  | 'register'

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

export interface AuthSessionPanelProps {
  onAuthenticated: () => void
}

export function AuthSessionPanel({ onAuthenticated }: AuthSessionPanelProps) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')

  const inPlaceAuth = { navigate: false as const, preserveOrderingContext: true as const }
  const login = useLogin(inPlaceAuth)
  const registerAccount = useRegister(inPlaceAuth)
  const sendOTP = useSendOTP()
  const verifyOTP = useVerifyOTP(inPlaceAuth)

  const { resolved: resendCooldownField } = useConfigurationField('authentication.otp.resend_cooldown_seconds')
  const { resolved: maxAttemptsField } = useConfigurationField('authentication.otp.max_verify_attempts')
  const RESEND_SECONDS = (resendCooldownField?.value as number | undefined) ?? FALLBACK_RESEND_SECONDS
  const MAX_ATTEMPTS = (maxAttemptsField?.value as number | undefined) ?? FALLBACK_MAX_ATTEMPTS

  const [view, setView] = useState<AuthView>('phone')
  const [phoneE164, setPhoneE164] = useState('')
  const [dialCode, setDialCode] = useState('')
  const [nationalNumber, setNationalNumber] = useState('')
  const [phoneValid, setPhoneValid] = useState(false)
  const [phoneAuthMode, setPhoneAuthMode] = useState<'otp' | 'password'>('otp')
  const [phonePassword, setPhonePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpAttempts, setOtpAttempts] = useState(0)
  const { seconds, expired: resendReady, start: restartCountdown } = useCountdown(RESEND_SECONDS)

  const emailForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) })
  const profileForm = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) })
  const registerForm = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const isLoginPending = login.isPending
  const isOtpPending = verifyOTP.isPending
  const isSendPending = sendOTP.isPending
  const isRegisterPending = registerAccount.isPending

  const maskedPhone = phoneE164.length > 6
    ? `${phoneE164.slice(0, 3)} ${'•'.repeat(Math.max(phoneE164.length - 6, 0))} ${phoneE164.slice(-4)}`
    : phoneE164

  const handleAuthSuccess = useCallback(() => {
    onAuthenticated()
  }, [onAuthenticated])

  const handlePhoneContinue = () => {
    const rateCheck = LOGIN_LIMIT.check(phoneE164)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyAttempts'))
      return
    }
    sendOTP.mutate(
      { phone_number: phoneE164, dialCode },
      {
        onSuccess: () => {
          setOtp('')
          setOtpError(null)
          setOtpAttempts(0)
          restartCountdown()
          setView('otp')
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('otpSendFailed'))),
      },
    )
  }

  const handlePhonePasswordLogin = () => {
    if (isLoginPending) return
    if (!phonePassword || !nationalNumber) {
      toast.error(t('enterPhoneToContinue'))
      return
    }
    const rateKey = phoneE164 || 'phone-password'
    const rateCheck = LOGIN_LIMIT.check(rateKey)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyLoginAttempts'))
      return
    }
    login.mutate(
      { phone_number: nationalNumber, country_code: dialCode, password: phonePassword },
      {
        onSuccess: () => {
          LOGIN_LIMIT.reset(rateKey)
          toast.success(t('loginSuccess'))
          handleAuthSuccess()
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('invalidCredentials'))),
      },
    )
  }

  const onEmailSubmit = (data: EmailFormData) => {
    if (isLoginPending) return
    const rateCheck = LOGIN_LIMIT.check(data.email)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyLoginAttempts'))
      return
    }
    login.mutate(data, {
      onSuccess: () => {
        LOGIN_LIMIT.reset(data.email)
        toast.success(t('loginSuccess'))
        handleAuthSuccess()
      },
      onError: (err) => toast.error(getApiErrorMessage(err, t('invalidCredentials'))),
    })
  }

  const submitOtp = (code: string) => {
    if (isOtpPending || code.length < 6) return
    setOtpError(null)
    verifyOTP.mutate(
      { phone_number: phoneE164, dialCode, otp: code },
      {
        onSuccess: (result) => {
          if (result.is_new_user) {
            setView('complete-profile')
            return
          }
          toast.success(t('loginSuccess'))
          handleAuthSuccess()
        },
        onError: (err) => {
          const nextAttempts = otpAttempts + 1
          setOtpAttempts(nextAttempts)
          setOtp('')
          setOtpError(getApiErrorMessage(err, t('invalidOtp')))
        },
      },
    )
  }

  const handleResend = () => {
    if (!resendReady || isSendPending) return
    sendOTP.mutate(
      { phone_number: phoneE164, dialCode },
      {
        onSuccess: () => {
          toast.success(t('otpResent'))
          setOtp('')
          setOtpError(null)
          setOtpAttempts(0)
          restartCountdown()
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('otpResendFailed'))),
      },
    )
  }

  const onCompleteProfile = (data: ProfileFormData) => {
    const localPhoneNumber = dialCode && phoneE164.startsWith(dialCode)
      ? phoneE164.slice(dialCode.length)
      : phoneE164
    registerAccount.mutate(
      {
        country_code: dialCode,
        phone_number: localPhoneNumber,
        first_name: data.first_name,
        last_name: data.last_name,
      },
      {
        onSuccess: () => {
          toast.success(t('completeProfileSuccess'))
          handleAuthSuccess()
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('completeProfileFailed'))),
      },
    )
  }

  const onEmailRegister = (data: RegisterFormData) => {
    registerAccount.mutate(
      {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number || undefined,
        password: data.password,
        confirm_password: data.confirm_password,
      },
      {
        onSuccess: () => {
          toast.success(t('registrationSuccess'))
          handleAuthSuccess()
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('registrationFailed'))),
      },
    )
  }

  const otpLocked = otpAttempts >= MAX_ATTEMPTS

  return (
    <div className="space-y-4">
      {view === 'phone' && (
        <div className="space-y-3">
          <PhoneInput
            label={t('phoneNumber')}
            onChange={(e164, meta) => {
              setPhoneE164(e164)
              setDialCode(meta.dialCode)
              setNationalNumber(meta.nationalNumber)
              setPhoneValid(meta.isValid)
            }}
            hint={phoneAuthMode === 'otp' ? t('phoneHint') : undefined}
            required
          />
          {phoneAuthMode === 'otp' ? (
            <>
              <Button
                type="button"
                className="w-full"
                size="lg"
                loading={isSendPending}
                disabled={!phoneValid || isSendPending}
                onClick={handlePhoneContinue}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {tCommon('continue')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => setPhoneAuthMode('password')}
              >
                {t('signInWithPasswordInstead')}
              </Button>
            </>
          ) : (
            <>
              <Input
                label={t('password')}
                type={showPassword ? 'text' : 'password'}
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
                leftIcon={<Lock className="h-3.5 w-3.5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? tCommon('hidePassword') : tCommon('showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                }
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <Button
                type="button"
                className="w-full"
                size="lg"
                loading={isLoginPending}
                disabled={!phonePassword || !nationalNumber || isLoginPending}
                onClick={handlePhonePasswordLogin}
              >
                {t('signInWithPassword')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={isLoginPending}
                onClick={() => setPhoneAuthMode('otp')}
              >
                {t('backToOtpLogin')}
              </Button>
            </>
          )}
          {phoneAuthMode === 'otp' && (
            <button
              type="button"
              onClick={() => setView('email')}
              className="w-full text-center text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] py-2"
            >
              {t('signInWithEmailInstead')}
            </button>
          )}
          <p className="text-center text-sm text-[var(--fg-muted)]">
            {t('dontHaveAccount')}{' '}
            <button
              type="button"
              className="text-[var(--accent-text)] font-medium"
              onClick={() => setView('register')}
            >
              {t('createAccountTitle')}
            </button>
          </p>
        </div>
      )}

      {view === 'email' && (
        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
          <Input
            id="auth-session-email"
            label={t('email')}
            type="email"
            required
            leftIcon={<Mail className="h-3.5 w-3.5" />}
            placeholder={t('emailPlaceholder')}
            {...emailForm.register('email')}
            error={emailForm.formState.errors.email?.message ? tValidation(emailForm.formState.errors.email.message) : undefined}
            autoComplete="email"
          />
          <Input
            id="auth-session-password"
            label={t('password')}
            type={showPassword ? 'text' : 'password'}
            required
            leftIcon={<Lock className="h-3.5 w-3.5" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? tCommon('hidePassword') : tCommon('showPassword')}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
            placeholder="••••••••"
            {...emailForm.register('password')}
            error={emailForm.formState.errors.password?.message ? tValidation(emailForm.formState.errors.password.message) : undefined}
            autoComplete="current-password"
          />
          <div className="flex justify-end text-sm">
            <button type="button" onClick={() => setView('forgot-password')} className="text-[var(--accent-text)]">
              {t('forgotPasswordLink')}
            </button>
          </div>
          <Button type="submit" className="w-full" size="lg" loading={isLoginPending} disabled={isLoginPending}>
            {t('signInWithEmail')}
          </Button>
          <button
            type="button"
            onClick={() => setView('phone')}
            className="w-full text-center text-sm text-[var(--fg-muted)] py-2"
          >
            {t('backToPhoneLogin')}
          </button>
        </form>
      )}

      {view === 'forgot-password' && (
        <ForgotPasswordPanel onBack={() => setView('email')} />
      )}

      {view === 'otp' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => { setView('phone'); setOtpError(null) }}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {tCommon('back')}
          </button>
          <div>
            <h3 className="font-semibold text-[var(--fg)]">{t('verifyYourNumber')}</h3>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {t('weSentCodeTo')} {maskedPhone}
            </p>
          </div>
          <OTPInput
            length={6}
            value={otp}
            onChange={setOtp}
            onComplete={submitOtp}
            error={Boolean(otpError)}
            disabled={isOtpPending || otpLocked}
            autoFocus
          />
          {otpError && (
            <p role="alert" className="text-sm text-[var(--danger-text)]">{otpError}</p>
          )}
          {otpLocked && (
            <p role="alert" className="text-sm text-[var(--danger-text)]">{t('tooManyAttemptsHeading')}</p>
          )}
          <Button
            type="button"
            className="w-full"
            size="lg"
            loading={isOtpPending}
            disabled={otp.length < 6 || isOtpPending || otpLocked}
            onClick={() => submitOtp(otp)}
          >
            {t('verifyCode')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={isSendPending}
            disabled={!resendReady || isSendPending}
            onClick={handleResend}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            {resendReady ? t('resendCode') : `${t('resendCodeIn')} ${seconds}s`}
          </Button>
        </div>
      )}

      {view === 'complete-profile' && (
        <form onSubmit={profileForm.handleSubmit(onCompleteProfile)} className="space-y-4" noValidate>
          {phoneE164 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--card-hover)] border border-[var(--border)]">
              <Phone className="h-4 w-4 text-[var(--accent-text)] shrink-0" />
              <span className="text-sm font-mono">{phoneE164}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('firstName')}
              required
              autoComplete="given-name"
              autoFocus
              {...profileForm.register('first_name')}
              error={profileForm.formState.errors.first_name?.message ? tValidation(profileForm.formState.errors.first_name.message) : undefined}
            />
            <Input
              label={t('lastName')}
              required
              autoComplete="family-name"
              {...profileForm.register('last_name')}
              error={profileForm.formState.errors.last_name?.message ? tValidation(profileForm.formState.errors.last_name.message) : undefined}
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" {...profileForm.register('terms')} className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)]" />
            <span className="text-sm text-[var(--fg-muted)]">
              {t('agreeToTerms')}{' '}
              <Link href="/terms" className="text-[var(--accent-text)] hover:underline" target="_blank">{tCommon('termsOfService')}</Link>
              {' '}{tCommon('and')}{' '}
              <Link href="/privacy" className="text-[var(--accent-text)] hover:underline" target="_blank">{tCommon('privacyPolicy')}</Link>
            </span>
          </label>
          {profileForm.formState.errors.terms && (
            <p role="alert" className="text-xs text-[var(--danger-text)]">
              {tValidation(profileForm.formState.errors.terms.message ?? 'must_accept_terms')}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" loading={isRegisterPending} disabled={isRegisterPending}>
            {t('createAccountButton')}
          </Button>
        </form>
      )}

      {view === 'register' && (
        <form onSubmit={registerForm.handleSubmit(onEmailRegister)} className="space-y-4">
          <button
            type="button"
            onClick={() => setView('phone')}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {tCommon('back')}
          </button>
          <h3 className="font-semibold text-[var(--fg)]">{t('createAccountTitle')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('firstName')}
              required
              {...registerForm.register('first_name')}
              error={registerForm.formState.errors.first_name?.message ? tValidation(registerForm.formState.errors.first_name.message) : undefined}
            />
            <Input
              label={t('lastName')}
              required
              {...registerForm.register('last_name')}
              error={registerForm.formState.errors.last_name?.message ? tValidation(registerForm.formState.errors.last_name.message) : undefined}
            />
          </div>
          <Input
            label={t('email')}
            type="email"
            required
            leftIcon={<Mail className="h-3.5 w-3.5" />}
            {...registerForm.register('email')}
            error={registerForm.formState.errors.email?.message ? tValidation(registerForm.formState.errors.email.message) : undefined}
          />
          <Input
            label={t('password')}
            type={showPassword ? 'text' : 'password'}
            required
            leftIcon={<Lock className="h-3.5 w-3.5" />}
            {...registerForm.register('password')}
            error={registerForm.formState.errors.password?.message ? tValidation(registerForm.formState.errors.password.message) : undefined}
          />
          <Input
            label={t('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            required
            leftIcon={<Lock className="h-3.5 w-3.5" />}
            {...registerForm.register('confirm_password')}
            error={registerForm.formState.errors.confirm_password?.message ? tValidation(registerForm.formState.errors.confirm_password.message) : undefined}
          />
          <Button type="submit" className="w-full" size="lg" loading={isRegisterPending} disabled={isRegisterPending}>
            {t('createAccountButton')}
          </Button>
        </form>
      )}
    </div>
  )
}
