'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
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

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [loading, setLoading] = useState(false)
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

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/"className="flex items-center gap-2 mb-10 justify-center">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Samoon</span>
        </Link>

        <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-xl overflow-hidden">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8"
              >
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

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mt-6"
                >
                  <ArrowLeft className="h-3.5 w-3.5"/>
                  {t('backToSignIn')}
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
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
                    onClick={() => setSubmitted(false)}
                    className="text-[var(--accent-text)] hover:text-[var(--accent-text)] underline underline-offset-2"
                  >
                    {t('tryAgain')}
                  </button>
                  .
                </p>
                <Link href="/login">
                  <Button variant="secondary"className="w-full"leftIcon={<ArrowLeft className="h-4 w-4"/>}>
                    {t('backToSignInButton')}
                  </Button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
