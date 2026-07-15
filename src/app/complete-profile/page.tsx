'use client'

/**
 * P8.9.2 — Registration completion page (/complete-profile).
 *
 * Shown after OTP verification when the phone_number number belongs to a new user.
 * Collects only the minimum information needed: first name, last name, terms acceptance.
 * Phone number is pre-filled from the query param and is NOT editable.
 */

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useRegister } from '@/hooks'
import toast from 'react-hot-toast'

// ── Schema ─────────────────────────────────────────────────────────────────────
// Schema messages are `validation` namespace keys, resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.

const schema = z.object({
  first_name: z.string().min(1, 'required').max(50),
  last_name: z.string().min(1, 'required').max(50),
  terms: z.literal(true, { errorMap: () => ({ message: 'must_accept_terms' }) }),
})
type FormData = z.infer<typeof schema>

// ── Inner page ─────────────────────────────────────────────────────────────────

function CompleteProfileInner() {
  const router = useRouter()
  const params = useSearchParams()
  const phone_number = params.get('phone_number') ?? ''
  const dialCode = params.get('dialCode') ?? ''
  const prefersReducedMotion = useReducedMotion()
  const { mutate: register, isPending } = useRegister()
  const t = useTranslations('auth')
  const tValidation = useTranslations('validation')
  const tCommon = useTranslations('common')

  const { register: reg, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormData) => {
    // P10.9 — country_code and phone_number are sent as separate fields,
    // matching the OTP request shape (auth.service.ts's sendOTP()/
    // verifyOTP() already do the same phone_number.slice(dialCode.length)
    // split) — never concatenated. country_code always comes from the
    // dial code the user actually selected on /login, forwarded through
    // via the /verify -> /complete-profile redirect (see
    // src/app/verify/page.tsx), never hardcoded.
    const localPhoneNumber = dialCode && phone_number.startsWith(dialCode)
      ? phone_number.slice(dialCode.length)
      : phone_number

    register(
      {
        // email: `${phone_number.replace(/\D/g, '')}@samoon.local`,
        country_code: dialCode,
        phone_number: localPhoneNumber,
        first_name: data.first_name,
        last_name: data.last_name,
        // P10.9 — password is not part of the phone-OTP registration
        // flow for now. Re-enable by uncommenting these two lines (and
        // restoring the corresponding form fields/schema entries) once
        // password support returns to this flow.
        // password: data.password,
        // confirm_password: data.confirm_password,
      },
      {
        onSuccess: () => {
          toast.success(t('completeProfileSuccess'))
          router.push('/dashboard')
        },
        onError: () => toast.error(t('completeProfileFailed')),
      },
    )
  }

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <motion.div {...motionProps} className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Samoon</span>
        </div>

        <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
          {t('createYourAccount')}
        </h1>
        <p className="text-[var(--fg-muted)] mb-8 text-sm">
          {t('justAFewMoreDetails')}
        </p>

        {/* Phone number — read-only, for context */}
        {phone_number && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] mb-6">
            <Phone className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" />
            <span className="text-sm text-[var(--fg)] font-mono">{phone_number}</span>
            <span className="ms-auto text-xs text-green-500 font-medium">{t('verified')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('firstName')}
              placeholder="Alex"
              required
              autoComplete="given-name"
              autoFocus
              {...reg('first_name')}
              error={errors.first_name?.message ? tValidation(errors.first_name.message) : undefined}
            />
            <Input
              label={t('lastName')}
              placeholder="Kim"
              required
              autoComplete="family-name"
              {...reg('last_name')}
              error={errors.last_name?.message ? tValidation(errors.last_name.message) : undefined}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              {...reg('terms')}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-orange-500 cursor-pointer"
            />
            <span className="text-sm text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition-colors">
              {t('agreeToTerms')}{' '}
              <Link href="/terms" className="text-orange-500 hover:underline" target="_blank">
                {tCommon('termsOfService')}
              </Link>{' '}
              {tCommon('and')}{' '}
              <Link href="/privacy" className="text-orange-500 hover:underline" target="_blank">
                {tCommon('privacyPolicy')}
              </Link>
            </span>
          </label>
          {errors.terms && (
            <p role="alert" className="text-xs text-red-500">{errors.terms.message ? tValidation(errors.terms.message) : undefined}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={isPending}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {t('createAccountButton')}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────

function CompleteProfileFallback() {
  const tCommon = useTranslations('common')
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" aria-label={tCommon('loading')} />
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<CompleteProfileFallback />}>
      <CompleteProfileInner />
    </Suspense>
  )
}
