'use client'

import { useState, useEffect } from 'react'
import type { UploadSession } from '@/types/upload'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Monitor, Globe, Bell, Shield, User, ChevronRight, Upload, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ImageUploader, EMPTY_IMAGE_FIELD, type ImageFieldValue } from '@/components/ImageUploader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, Badge, OTPInput } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { FlagIcon } from '@/components/ui/FlagIcon'
import { useAuthStore, useThemeStore, useLangStore } from '@/stores'
import { useSetLocale, useRequestEmailVerification, useConfirmEmailVerification } from '@/hooks'
import { userService } from '@/services/combined.service'
import { COUNTRIES } from '@/data/countries'
import { cn } from '@/utils'
import { DirectUploadError } from '@/lib/upload-errors'
import { useIdempotencyKeys, useSubmissionGuard } from '@/hooks/use-submission-guard'
import toast from 'react-hot-toast'

// Schema messages are `validation` namespace keys, resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.
// email and phone_number are intentionally excluded from this schema:
// email owns a dedicated verification flow (see EmailVerificationCard
// below) and phone_number is immutable post-verification, displayed
// read-only. Neither is ever part of the profile update payload.
const profileSchema = z.object({
  first_name: z.string().min(2, 'required'),
  last_name: z.string().min(2, 'required'),
})
type ProfileFormData = z.infer<typeof profileSchema>

/** Split an E.164 phone number into its country + national parts for display. */
function splitPhoneNumber(phone?: string) {
  if (!phone) return null
  const digits = phone.startsWith('+') ? phone : `+${phone}`
  const match = [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => digits.startsWith(c.dialCode))
  if (!match) return { country: null, dialCode: '', national: digits }
  return { country: match, dialCode: match.dialCode, national: digits.slice(match.dialCode.length).trim() }
}

const THEMES = [
  { value: 'light', key: 'themeLight', icon: Sun },
  { value: 'dark', key: 'themeDark', icon: Moon },
  { value: 'system', key: 'themeSystem', icon: Monitor },
] as const

// Language names are endonyms (each language's name in its own script) —
// left untranslated by convention, matching how language pickers universally
// display them regardless of the active UI locale.
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸', dirKey: 'directionLtr' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷', dirKey: 'directionRtl' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dirKey: 'directionRtl' },
]

const NOTIFICATION_PREFS = [
  { id: 'order_updates', key: 'orderUpdates' },
  { id: 'promotions', key: 'notifPromotions' },
  { id: 'reservation_reminders', key: 'reservationReminders' },
  { id: 'system', key: 'systemNotices' },
]

const SECURITY_ITEMS = ['changePassword', 'twoFactorAuth', 'activeSessions'] as const

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { locale } = useLangStore()
  const setLocale = useSetLocale()
  const [saving, setSaving] = useState(false)
  const t = useTranslations('dashboard')
  const tUpload = useTranslations('console')
  const tValidation = useTranslations('validation')
  const tCommon = useTranslations('common')
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    order_updates: true, promotions: true, reservation_reminders: true, system: true,
  })

  // Avatar upload state
  const [avatarImage, setAvatarImage] = useState<ImageFieldValue>({
    ...EMPTY_IMAGE_FIELD,
    existingUrl: user?.avatar ?? '',
  })
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [avatarSession, setAvatarSession] = useState<UploadSession | null>(null)
  const avatarGuard = useSubmissionGuard('user-avatar')
  const uploadKeys = useIdempotencyKeys()

  useEffect(() => {
    setAvatarImage((prev) => ({
      ...prev,
      existingUrl: user?.avatar ?? '',
    }))
  }, [user?.avatar])

  const handleUploadAvatar = () => {
    const file = avatarImage.file
    if (!file) return
    void avatarGuard.run(async ({ signal, isCurrent }) => {
      setUploadState('uploading')
      setUploadError(null)
      try {
        const { avatar_url } = await userService.uploadAvatar(file, {
          signal,
          idempotencyKey: uploadKeys.keyFor('avatar', file),
          onSession: (session) => {
            if (!isCurrent()) return
            setAvatarSession(session)
          },
        })
        if (!isCurrent()) return
        setUser({ ...user!, avatar: avatar_url })
        toast.success(t('avatarUpdated'))
        setUploadState('success')
        setAvatarImage({ file: null, existingUrl: avatar_url, cleared: false })
        setAvatarSession(null)
        uploadKeys.reset('avatar')
      } catch (err: unknown) {
        if (!isCurrent()) return
        if (err instanceof DirectUploadError && err.uploadError.code === 'cancelled') {
          setUploadState('idle')
          return
        }
        if (err instanceof DirectUploadError) {
          setUploadError(tUpload(err.uploadError.messageKey))
        } else {
          const msg = err instanceof Error ? err.message : t('uploadFailedRetry')
          setUploadError(msg)
        }
        setUploadState('error')
      }
    })
  }

  const handleCancelAvatarUpload = () => {
    avatarGuard.invalidate()
    setUploadState('idle')
    setAvatarSession(null)
  }

  const handleAvatarFileChange = (image: ImageFieldValue) => {
    avatarGuard.invalidate()
    setAvatarImage(image)
    setUploadError(null)
    setUploadState('idle')
    setAvatarSession(null)
    if (!image.file) uploadKeys.reset('avatar')
  }

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name || '', last_name: user?.last_name || '' },
  })

  const phone = splitPhoneNumber(user?.phone_number)

  // Email verification — deliberately independent of the profile form/state
  // above: it never shares a payload, mutation, or card with first/last
  // name. See useRequestEmailVerification()/useConfirmEmailVerification().
  //
  // Business rule: an account either has an email or it doesn't — there is
  // no separate "verified" flag to track. hasEmail is computed straight
  // from `user` on every render (never cached in state), so the UI reacts
  // immediately to whatever the store holds after confirm merges email
  // (and after an optional /auth/me refresh).
  const hasEmail = Boolean(user?.email?.trim())
  // Purely a UI step ("did we just send a code") — not a verification
  // status, and never consulted to decide hasEmail.
  const [codeSent, setCodeSent] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState(user?.email || '')
  const [verifyCode, setVerifyCode] = useState('')
  const requestEmailVerification = useRequestEmailVerification()
  const confirmEmailVerification = useConfirmEmailVerification()
  const verifyEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifyEmail)

  // Seeds the field once the async-loaded user email arrives, without
  // clobbering anything the user has already typed.
  useEffect(() => {
    if (user?.email) setVerifyEmail((prev) => prev || user.email || '')
  }, [user?.email])

  const handleSendVerificationCode = async () => {
    try {
      await requestEmailVerification.mutateAsync(verifyEmail)
      setCodeSent(true)
      toast.success(t('verificationCodeSent'))
    } catch {
      toast.error(t('failedToSendVerificationCode'))
    }
  }

  const handleCancelVerification = () => {
    setCodeSent(false)
    setVerifyCode('')
  }

  const handleVerifyEmail = async () => {
    try {
      // Confirm success merges user.email into the auth store (hasEmail
      // flips on the next render). /auth/me is a follow-up, not required.
      await confirmEmailVerification.mutateAsync({ email: verifyEmail, code: verifyCode })
      setCodeSent(false)
      setVerifyCode('')
      toast.success(t('emailVerifiedSuccessfully'))
    } catch {
      toast.error(t('invalidVerificationCode'))
    }
  }

  const onSaveProfile = async (data: ProfileFormData) => {
    setSaving(true)
    try {
      const updated = await userService.updateProfile(data)
      setUser({ ...user!, ...updated })
      toast.success(t('profileUpdated'))
    } catch {
      toast.error(t('failedToUpdateProfile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('settings')}</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">{t('manageAccountPreferences')}</p>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
            <User className="h-4 w-4 text-[var(--accent-text)]"/>
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('profileInformation')}</h2>
        </div>

        <div className="mb-6 p-4 bg-[var(--card-hover)] rounded-xl space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={avatarImage.file ? undefined : (avatarImage.existingUrl || user?.avatar)}
              firstName={user?.first_name}
              lastName={user?.last_name}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--fg)]">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-[var(--fg-muted)]">{user?.email}</p>
            </div>
          </div>

          <ImageUploader
            label={t('changeProfilePhotoAria')}
            purpose="user_avatar"
            value={avatarImage}
            session={avatarSession}
            onRetry={handleUploadAvatar}
            onCancelUpload={handleCancelAvatarUpload}
            onChange={handleAvatarFileChange}
            error={uploadError}
          />

          {avatarImage.file && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                type="button"
                onClick={handleUploadAvatar}
                loading={avatarGuard.locked || uploadState === 'uploading'}
                disabled={avatarGuard.locked || uploadState === 'uploading'}
                leftIcon={<Upload className="h-3.5 w-3.5"/>}
              >
                {uploadState === 'uploading' ? t('uploadingEllipsis') : t('upload')}
              </Button>
            </div>
          )}

          {uploadState === 'success' && (
            <p className="text-xs text-[var(--success-text)] font-medium">{t('avatarUpdatedSuccessfully')}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('firstName')} required {...register('first_name')} error={errors.first_name?.message ? tValidation(errors.first_name.message) : undefined} />
            <Input label={t('lastName')} required {...register('last_name')} error={errors.last_name?.message ? tValidation(errors.last_name.message) : undefined} />

            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">{t('phoneLabel')}</label>
              <div
                className="flex items-center gap-2 h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card-hover)] text-[var(--fg-muted)] cursor-not-allowed select-none"
                aria-readonly="true"
                title={t('phoneNotEditable')}
              >
                {phone?.country ? (
                  <FlagIcon code={phone.country.code} size={18} />
                ) : (
                  <span className="text-base leading-none">📵</span>
                )}
                {phone?.dialCode && (
                  <span className="font-medium text-[var(--fg)] shrink-0">{phone.dialCode}</span>
                )}
                <span className="truncate">{phone?.national || t('noPhoneOnFile')}</span>
              </div>
            </div>
          </div>
          <Button type="submit"loading={saving} disabled={!isDirty}>{t('saveChanges')}</Button>
        </form>
      </Card>

      {/* Email Verification — fully independent card/flow from Profile Information above */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[var(--info-subtle)] flex items-center justify-center">
              <Mail className="h-4 w-4 text-[var(--info-text)]"/>
            </div>
            <h2 className="font-semibold text-[var(--fg)]">{t('emailVerification')}</h2>
          </div>
          {hasEmail ? (
            <Badge variant="success"dot>{t('verified')}</Badge>
          ) : (
            <Badge variant="warning"dot>{t('notVerified')}</Badge>
          )}
        </div>

        {hasEmail ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--success-subtle)] border border-[var(--success-border)]">
            <CheckCircle2 className="h-5 w-5 text-[var(--success-text)] shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold text-[var(--success-text)]">{t('emailVerifiedTitle')}</p>
              <p className="text-sm text-[var(--success-text)] mt-1 font-medium">{user?.email}</p>
              <p className="text-sm text-[var(--success-text)] mt-0.5">{t('emailAddedDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!codeSent && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning-subtle)] border border-[var(--warning-border)]">
                <AlertTriangle className="h-5 w-5 text-[var(--rating)] shrink-0 mt-0.5"/>
                <div>
                  <p className="font-semibold text-[var(--warning-text)]">{t('emailNotVerifiedTitle')}</p>
                  <p className="text-sm text-[var(--warning-text)] mt-0.5">{t('emailNotVerifiedDesc')}</p>
                </div>
              </div>
            )}

            <Input
              label={t('emailLabel')}
              type="email"
              value={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.value)}
              disabled={codeSent}
            />

            {codeSent && (
              <div>
                <label className="block text-sm font-medium text-[var(--fg)] mb-2">{t('verificationCodeLabel')}</label>
                <OTPInput length={6} value={verifyCode} onChange={setVerifyCode} autoFocus />
              </div>
            )}

            <div className="flex items-center gap-2 justify-end">
              {codeSent && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelVerification}
                  disabled={confirmEmailVerification.isPending}
                >
                  {tCommon('cancel')}
                </Button>
              )}
              {!codeSent ? (
                <Button
                  type="button"
                  onClick={handleSendVerificationCode}
                  loading={requestEmailVerification.isPending}
                  disabled={!verifyEmailValid || requestEmailVerification.isPending}
                >
                  {t('sendVerificationCode')}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleVerifyEmail}
                  loading={confirmEmailVerification.isPending}
                  disabled={verifyCode.length < 6 || confirmEmailVerification.isPending}
                >
                  {t('verifyEmail')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Theme */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[var(--chart-5)]/10 flex items-center justify-center">
            <Sun className="h-4 w-4 text-[var(--chart-5)]"/>
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('appearance')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, key, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                theme === value ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] hover:border-[var(--accent-border)]/50',
              )}
            >
              <Icon className={cn('h-5 w-5', theme === value ? 'text-[var(--accent-text)]' : 'text-[var(--fg-muted)]')} />
              <span className={cn('text-sm font-medium', theme === value ? 'text-[var(--accent-text)]' : 'text-[var(--fg-muted)]')}>{t(key)}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Language */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[var(--info-subtle)] flex items-center justify-center">
            <Globe className="h-4 w-4 text-[var(--info-text)]"/>
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('languageAndRegion')}</h2>
        </div>
        <div className="space-y-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              className={cn(
                'flex items-center justify-between w-full px-4 py-3.5 rounded-xl border-2 text-start transition-all',
                locale === lang.code ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] hover:border-[var(--accent-border)]/50',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <p className={cn('font-medium', locale === lang.code ? 'text-[var(--accent-text)]' : 'text-[var(--fg)]')}>{lang.label}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{t(lang.dirKey)}</p>
                </div>
              </div>
              {locale === lang.code && <span className="text-[var(--accent-text)] text-sm">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[var(--warning-subtle)] flex items-center justify-center">
            <Bell className="h-4 w-4 text-[var(--rating)]"/>
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('notificationPreferences')}</h2>
        </div>
        <div className="space-y-1">
          {NOTIFICATION_PREFS.map((pref) => (
            <div key={pref.id} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t(`notifPrefs.${pref.key}.label`)}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">{t(`notifPrefs.${pref.key}.desc`)}</p>
              </div>
              <button
                onClick={() => setNotifPrefs((p) => ({ ...p, [pref.id]: !p[pref.id] }))}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  notifPrefs[pref.id] ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
                )}
                role="switch"
                aria-checked={notifPrefs[pref.id]}
                aria-label={t(`notifPrefs.${pref.key}.label`)}
              >
                <span className={cn('absolute top-0.5 start-0.5 h-5 w-5 rounded-full bg-[var(--card)] shadow-sm transition-transform duration-200', notifPrefs[pref.id] ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--danger-subtle)] flex items-center justify-center">
            <Shield className="h-4 w-4 text-[var(--danger-text)]"/>
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('security')}</h2>
        </div>
        <div className="space-y-1">
          {SECURITY_ITEMS.map((key) => (
            <button key={key} className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors text-start">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t(`securityItems.${key}.label`)}</p>
                <p className="text-xs text-[var(--fg-muted)]">{t(`securityItems.${key}.desc`)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]"/>
            </button>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h2 className="font-semibold text-[var(--danger-text)] mb-4">{t('dangerZone')}</h2>
        <Button variant="destructive"size="sm">{t('deleteAccount')}</Button>
      </Card>
    </div>
  )
}
