'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useRegister } from '@/hooks'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

// Schema messages are `validation` namespace keys (Phase E), resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.
const registerSchema = z.object({
  first_name: z.string().min(2, 'required'),
  last_name: z.string().min(2, 'required'),
  email: z.string().email('invalid_email'),
  phone: z.string().min(10, 'invalid_phone').optional().or(z.literal('')),
  password: z.string().min(8, 'invalid_password'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'passwords_do_not_match',
  path: ['confirm_password'],
})

type RegisterFormData = z.infer<typeof registerSchema>

const PERK_KEYS = ['exclusiveDeals', 'fasterCheckout', 'realtimeTracking', 'priorityReservations'] as const

export function RegisterClientPage() {
  const router = useRouter()
  const { mutate: doRegister, isPending } = useRegister()
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = (data: RegisterFormData) => {
    doRegister(data, {
      onSuccess: () => {
        toast.success(t('registrationSuccess'))
        router.push('/')
      },
      onError: () => toast.error(t('registrationFailed')),
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex">
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 60% 40%, white 2px, transparent 2px)', backgroundSize: '50px 50px' }} />
        <Link href="/" className="relative flex items-center gap-2 mb-auto">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-[var(--font-display)] text-xl font-bold text-white">Savor</span>
        </Link>
        <div className="relative text-white">
          <h2 className="font-[var(--font-display)] text-4xl font-bold mb-4">{t('joinSavorFamily')}</h2>
          <p className="text-white/80 text-lg mb-8">{t('joinSavorFamilySubtitle')}</p>
          <div className="space-y-4">
            {PERK_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white/90">{t(`perks.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Savor</span>
            </Link>
            <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-2">{t('createAccountTitle')}</h1>
            <p className="text-[var(--fg-muted)]">{t('joinThousands')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('firstName')} required leftIcon={<User className="h-3.5 w-3.5" />} placeholder="John" {...register('first_name')} error={errors.first_name?.message ? tValidation(errors.first_name.message) : undefined} />
              <Input label={t('lastName')} required placeholder="Doe" {...register('last_name')} error={errors.last_name?.message ? tValidation(errors.last_name.message) : undefined} />
            </div>
            <Input label={t('email')} type="email" required leftIcon={<Mail className="h-3.5 w-3.5" />} placeholder={t('emailPlaceholder')} {...register('email')} error={errors.email?.message ? tValidation(errors.email.message) : undefined} />
            <Input label={t('phone')} type="tel" leftIcon={<Phone className="h-3.5 w-3.5" />} placeholder="+1 234 567 8900" {...register('phone')} error={errors.phone?.message ? tValidation(errors.phone.message) : undefined} />
            <Input
              label={t('password')} type={showPw ? 'text' : 'password'} required
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              rightIcon={<button type="button" onClick={() => setShowPw((v) => !v)} aria-label={t('togglePassword')}>{showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
              placeholder={t('minEightChars')} {...register('password')} error={errors.password?.message ? tValidation(errors.password.message) : undefined}
            />
            <Input
              label={t('confirmPassword')} type={showConfirm ? 'text' : 'password'} required
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              rightIcon={<button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={t('toggleConfirmPassword')}>{showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
              placeholder={t('repeatPassword')} {...register('confirm_password')} error={errors.confirm_password?.message ? tValidation(errors.confirm_password.message) : undefined}
            />
            <p className="text-xs text-[var(--fg-muted)]">
              {t('agreeToTermsCreate')}{' '}
              <Link href="/terms" className="text-orange-500 hover:underline">{tCommon('termsOfService')}</Link>{' '}{tCommon('and')}{' '}
              <Link href="/privacy" className="text-orange-500 hover:underline">{tCommon('privacyPolicy')}</Link>.
            </p>
            <Button type="submit" className="w-full" size="lg" loading={isPending} rightIcon={<ArrowRight className="h-4 w-4" />}>
              {t('createAccountButton')}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--fg-muted)] mt-6">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-orange-500 font-medium hover:text-orange-600 transition-colors">{t('signInArrow')}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
