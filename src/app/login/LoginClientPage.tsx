'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import {
  Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles,
  ShieldCheck, User, Crown, ChefHat, Megaphone,
  HeadphonesIcon, CreditCard, Layers, Building2, Phone,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useLogin, useSendOTP } from '@/hooks'
import { useConfigurationField } from '@/hooks/use-platform-configuration'
import { getDemoRedirect, getPostLoginRedirect } from '@/utils/auth-redirect'
import toast from 'react-hot-toast'
import { LOGIN_LIMIT } from '@/lib/rate-limit'

const USE_MOCK_ENV = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

// ── Demo accounts ──────────────────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { key: 'customer',      email: 'demo@savor.com',      phone: '+1 415 555 0101', icon: User,           color: 'text-blue-600 dark:text-blue-400',     bg: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',     border: 'border-blue-200 dark:border-blue-800' },
  { key: 'staff',         email: 'staff@savor.com',     phone: '+1 415 555 0102', icon: ShieldCheck,    color: 'text-green-600 dark:text-green-400',   bg: 'hover:bg-green-50 dark:hover:bg-green-950/20',   border: 'border-green-200 dark:border-green-800' },
  { key: 'cashier',       email: 'cashier@savor.com',   phone: '+1 415 555 0103', icon: CreditCard,     color: 'text-cyan-600 dark:text-cyan-400',     bg: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',     border: 'border-cyan-200 dark:border-cyan-800' },
  { key: 'kitchen',       email: 'kitchen@savor.com',   phone: '+1 415 555 0104', icon: ChefHat,        color: 'text-amber-600 dark:text-amber-400',   bg: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800' },
  { key: 'marketing',     email: 'marketing@savor.com', phone: '+1 415 555 0105', icon: Megaphone,      color: 'text-pink-600 dark:text-pink-400',     bg: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',     border: 'border-pink-200 dark:border-pink-800' },
  { key: 'support',       email: 'support@savor.com',   phone: '+1 415 555 0106', icon: HeadphonesIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20', border: 'border-indigo-200 dark:border-indigo-800' },
  { key: 'admin',         email: 'admin@savor.com',     phone: '+1 415 555 0107', icon: ShieldCheck,    color: 'text-orange-600 dark:text-orange-400', bg: 'hover:bg-orange-50 dark:hover:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800' },
  { key: 'owner',         email: 'owner@savor.com',     phone: '+1 415 555 0108', icon: Crown,          color: 'text-purple-600 dark:text-purple-400', bg: 'hover:bg-purple-50 dark:hover:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800' },
  { key: 'platformAdmin', email: 'platform@savor.com',  phone: '+1 415 555 0109', icon: Building2,      color: 'text-rose-600 dark:text-rose-400',     bg: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',     border: 'border-rose-200 dark:border-rose-800' },
  { key: 'multiRole',     email: 'multirole@savor.com', phone: '+1 415 555 0110', icon: Layers,         color: 'text-teal-600 dark:text-teal-400',     bg: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',     border: 'border-teal-200 dark:border-teal-800' },
]

// ── Email fallback schema ──────────────────────────────────────────────────────

// Schema messages are `validation` namespace keys, not literal English text
// (Phase E — centralized validation messages) — resolved through
// `tValidation()` wherever `errors.<field>.message` is rendered below.
const emailSchema = z.object({
  email: z.string().email('invalid_email'),
  password: z.string().min(6, 'invalid_password'),
})
type EmailFormData = z.infer<typeof emailSchema>

// ── Page component ─────────────────────────────────────────────────────────────

export function LoginClientPage() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const { mutate: login, isPending: isEmailPending } = useLogin()
  const { mutate: sendOTP, isPending: isSendingOTP } = useSendOTP()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')

  // P9.1.2 — Runtime Integration: demo grid visibility now additionally gated
  // by authentication.demo_accounts_visible (platform-locked config), never
  // replacing the NEXT_PUBLIC_USE_MOCK build flag — both must allow it.
  const { resolved: demoVisibleField } = useConfigurationField('authentication.demo_accounts_visible')
  const USE_MOCK = USE_MOCK_ENV && (demoVisibleField?.value as boolean | undefined) !== false

  const [phoneE164, setPhoneE164] = useState('')
  const [phoneValid, setPhoneValid] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  })

  // ── Phone continue ────────────────────────────────────────────────────────────

  const handlePhoneContinue = () => {
    const rateCheck = LOGIN_LIMIT.check(phoneE164)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyAttempts'))
      return
    }
    sendOTP(phoneE164, {
      onSuccess: () => {
        router.push(`/verify?phone=${encodeURIComponent(phoneE164)}`)
      },
      onError: () => toast.error(t('otpSendFailed')),
    })
  }

  // ── Demo one-click login ──────────────────────────────────────────────────────

  const loginAs = (email: string) => {
    const rateCheck = LOGIN_LIMIT.check(email)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyLoginAttempts'))
      return
    }
    login({ email, password: 'password' }, {
      onSuccess: () => {
        LOGIN_LIMIT.reset(email)
        toast.success(t('loginSuccess'))
        router.push(getDemoRedirect(email))
      },
      onError: () => toast.error(t('loginFailed')),
    })
  }

  // ── Email form submit ─────────────────────────────────────────────────────────

  const onEmailSubmit = (data: EmailFormData) => {
    const rateCheck = LOGIN_LIMIT.check(data.email)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyLoginAttempts'))
      return
    }
    login(data, {
      onSuccess: (result) => {
        LOGIN_LIMIT.reset(data.email)
        toast.success(t('loginSuccess'))
        router.push(getPostLoginRedirect(result.user.role))
      },
      onError: () => toast.error(t('invalidCredentials')),
    })
  }

  const fillDemo = () => {
    setValue('email', 'demo@savor.com')
    setValue('password', 'password')
  }

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }

  const isPending = isEmailPending || isSendingOTP

  return (
    <div className="min-h-screen bg-[var(--bg)] flex">
      {/* ── Left: Form ── */}
      <div className="flex-1 flex items-start justify-center p-6 sm:p-8 overflow-y-auto">
        <motion.div {...motionProps} className="w-full max-w-md py-8">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">S</span>
            </div>
            <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Savor</span>
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-2">
              {t('welcome')}
            </h1>
            <p className="text-[var(--fg-muted)]">{t('enterPhoneToContinue')}</p>
          </div>

          {/* ── Primary: Phone entry ── */}
          <div className="mb-6 space-y-3">
            <PhoneInput
              label={t('phoneNumber')}
              defaultCountry="US"
              onChange={(e164, meta) => {
                setPhoneE164(e164)
                setPhoneValid(meta.isValid)
              }}
              hint={t('phoneHint')}
              required
            />
            <Button
              type="button"
              className="w-full"
              size="lg"
              loading={isSendingOTP}
              disabled={!phoneValid || isSendingOTP}
              onClick={handlePhoneContinue}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {tCommon('continue')}
            </Button>
          </div>

          {/* ── Demo accounts ── */}
          {USE_MOCK && (
            <>
              <Divider label={t('orTryDemo')} className="mb-4" />
              <div className="mb-6 space-y-2">
                <p className="text-xs text-[var(--fg-muted)] flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-orange-500" aria-hidden="true" />
                  {t('oneClickDemoHint')}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEMO_ACCOUNTS.map(({ key, email, phone, icon: Icon, color, bg, border }) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => loginAs(email)}
                      disabled={isPending}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left transition-colors ${border} ${bg} disabled:opacity-50`}
                    >
                      <span className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(`demoAccounts.${key}.label`)}
                      </span>
                      <span className="text-[11px] text-[var(--fg-muted)] leading-tight">{t(`demoAccounts.${key}.description`)}</span>
                      <span className="text-[10px] text-[var(--fg-muted)] opacity-60 font-mono">{phone}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Email fallback (collapsed by default) ── */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowEmailForm((v) => !v)}
              className="w-full text-center text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors py-2"
              aria-expanded={showEmailForm}
            >
              {showEmailForm ? t('hideEmailSignIn') : t('signInWithEmailInstead')}
            </button>

            <AnimatePresence>
              {showEmailForm && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4">
                    {USE_MOCK && (
                      <button
                        type="button"
                        onClick={fillDemo}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('fillDemoCredentials')}
                      </button>
                    )}
                    <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
                      <Input
                        label={t('email')}
                        type="email"
                        required
                        leftIcon={<Mail className="h-3.5 w-3.5" />}
                        placeholder={t('emailPlaceholder')}
                        {...register('email')}
                        error={errors.email?.message ? tValidation(errors.email.message) : undefined}
                        autoComplete="email"
                      />
                      <Input
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
                        {...register('password')}
                        error={errors.password?.message ? tValidation(errors.password.message) : undefined}
                        autoComplete="current-password"
                      />
                      <div className="flex items-center justify-end text-sm">
                        <Link href="/forgot-password" className="text-orange-500 hover:text-orange-600 transition-colors">
                          {t('forgotPasswordLink')}
                        </Link>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        loading={isEmailPending}
                        rightIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        {t('signInWithEmail')}
                      </Button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-[var(--fg-muted)] mt-8">
            {t('agreeToTerms')}{' '}
            <Link href="/terms" className="text-orange-500 hover:underline">{tCommon('termsOfService')}</Link>
            {' '}{tCommon('and')}{' '}
            <Link href="/privacy" className="text-orange-500 hover:underline">{tCommon('privacyPolicy')}</Link>
          </p>
        </motion.div>
      </div>

      {/* ── Right: Hero (desktop only) ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700" aria-hidden="true">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 2px, transparent 2px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="text-7xl mb-6">🍽️</div>
          <h2 className="font-[var(--font-display)] text-4xl font-bold mb-4">{t('fineDining')},<br />{t('delivered')}.</h2>
          <p className="text-white/80 max-w-sm text-lg leading-relaxed">
            {t('heroCulinaryExcellence')}
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-white/20" />
              ))}
            </div>
            <p className="text-sm text-white/70">{t('joinedByFoodies')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
