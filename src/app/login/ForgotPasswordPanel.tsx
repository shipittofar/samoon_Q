'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authService } from '@/services/auth.service'
import toast from 'react-hot-toast'
import { PASSWORD_RESET_LIMIT } from '@/lib/rate-limit'
import { useTranslations } from 'next-intl'

const forgotSchema = z.object({
  email: z.string().email('invalid_email'),
})
type ForgotFormData = z.infer<typeof forgotSchema>

interface ForgotPasswordPanelProps {
  onBack: () => void
}

export function ForgotPasswordPanel({ onBack }: ForgotPasswordPanelProps) {
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const t = useTranslations('auth')
  const tValidation = useTranslations('validation')
  const tNotifications = useTranslations('notifications')

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotFormData) => {
    const rateCheck = PASSWORD_RESET_LIMIT.check(data.email)
    if (!rateCheck.allowed) {
      toast.error(t('tooManyResetAttempts'))
      return
    }
    setLoading(true)
    try {
      await authService.forgotPassword(data.email)
      setSubmittedEmail(data.email)
      setSubmitted(true)
    } catch {
      toast.error(tNotifications('resetEmailFailed'))
    } finally {
      setLoading(false)
    }
  }

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } }

  if (submitted) {
    return (
      <motion.div {...motionProps} className="text-center py-2">
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, delay: 0.05 }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[var(--success-subtle)] mb-5"
        >
          <CheckCircle2 className="h-8 w-8 text-[var(--success-text)]"/>
        </motion.div>
        <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
          {t('checkInbox')}
        </h2>
        <p className="text-[var(--fg-muted)] text-sm mb-2">
          {t('resetLinkSentTo')}
        </p>
        <p className="font-semibold text-[var(--fg)] mb-6">{submittedEmail}</p>
        <p className="text-xs text-[var(--fg-subtle)] mb-6">
          {t('didntReceiveIt')}{' '}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="text-[var(--accent-text)] hover:text-[var(--accent-text)] underline underline-offset-2"
          >
            {t('tryAgain')}
          </button>
          .
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          leftIcon={<ArrowLeft className="h-4 w-4"/>}
          onClick={onBack}
        >
          {t('backToSignInButton')}
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div {...motionProps}>
      <div className="mb-6">
        <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">
          {t('forgotTitle')}
        </h1>
        <p className="text-[var(--fg-muted)] text-sm">
          {t('forgotSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('emailAddress')}
          type="email"
          required
          leftIcon={<Mail className="h-3.5 w-3.5"/>}
          placeholder={t('emailPlaceholder')}
          {...register('email')}
          error={errors.email?.message ? tValidation(errors.email.message) : undefined}
          autoComplete="email"
          autoFocus
        />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={loading}
          rightIcon={<ArrowRight className="h-4 w-4"/>}
        >
          {t('sendResetLink')}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-1.5 w-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mt-6"
      >
        <ArrowLeft className="h-3.5 w-3.5"/>
        {t('backToSignIn')}
      </button>
    </motion.div>
  )
}
