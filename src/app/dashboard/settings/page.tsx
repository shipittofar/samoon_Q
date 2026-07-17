'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Monitor, Globe, Bell, Shield, User, ChevronRight, Camera, Upload, X, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  const tValidation = useTranslations('validation')
  const tCommon = useTranslations('common')
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    order_updates: true, promotions: true, reservation_reminders: true, system: true,
  })

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      setUploadError(t('unsupportedFileType'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('fileTooLarge'))
      return
    }
    setUploadError(null)
    setUploadState('idle')
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleCancelPreview = () => {
    setPendingFile(null)
    setPreviewUrl(null)
    setUploadState('idle')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadAvatar = async () => {
    if (!pendingFile) return
    setUploadState('uploading')
    setUploadError(null)
    try {
      const { avatar_url } = await userService.uploadAvatar(pendingFile)
      setUser({ ...user!, avatar: avatar_url })
      toast.success(t('avatarUpdated'))
      setUploadState('success')
      setPendingFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('uploadFailedRetry')
      setUploadError(msg)
      setUploadState('error')
    }
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
  // immediately to whatever the store holds, including after
  // useConfirmEmailVerification() refetches /auth/me and updates the store.
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
      // useConfirmEmailVerification() re-fetches /auth/me and hydrates the
      // store — hasEmail above flips on the next render off that alone.
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
          <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <User className="h-4 w-4 text-orange-500" />
          </div>
          <h2 className="font-semibold text-[var(--fg)]">{t('profileInformation')}</h2>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 bg-[var(--card-hover)] rounded-xl">
          {/* Avatar preview / current avatar */}
          <div className="relative shrink-0">
            <Avatar
              src={previewUrl ?? user?.avatar}
              firstName={user?.first_name}
              lastName={user?.last_name}
              size="lg"
            />
            {!pendingFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t('changeProfilePhotoAria')}
                className="absolute -bottom-1 -end-1 h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md hover:bg-orange-600 transition-colors"
              >
                <Camera className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--fg)]">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-[var(--fg-muted)]">{user?.email}</p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label={t('selectProfilePhotoAria')}
              onChange={handleFileChange}
              data-testid="avatar-file-input"
            />

            {/* Upload controls — shown when a file is staged */}
            {pendingFile && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleUploadAvatar}
                  loading={uploadState === 'uploading'}
                  disabled={uploadState === 'uploading'}
                  leftIcon={<Upload className="h-3.5 w-3.5" />}
                >
                  {uploadState === 'uploading' ? t('uploadingEllipsis') : t('upload')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancelPreview}
                  disabled={uploadState === 'uploading'}
                  leftIcon={<X className="h-3.5 w-3.5" />}
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            )}

            {/* Feedback messages */}
            {uploadState === 'success' && (
              <p className="mt-1 text-xs text-emerald-600 font-medium">{t('avatarUpdatedSuccessfully')}</p>
            )}
            {uploadState === 'error' && uploadError && (
              <p className="mt-1 text-xs text-red-500" role="alert">{uploadError}</p>
            )}
            {!pendingFile && !uploadError && uploadState !== 'success' && (
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('avatarFormatHint')}</p>
            )}
          </div>
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
          <Button type="submit" loading={saving} disabled={!isDirty}>{t('saveChanges')}</Button>
        </form>
      </Card>

      {/* Email Verification — fully independent card/flow from Profile Information above */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Mail className="h-4 w-4 text-blue-500" />
            </div>
            <h2 className="font-semibold text-[var(--fg)]">{t('emailVerification')}</h2>
          </div>
          {hasEmail ? (
            <Badge variant="success" dot>{t('verified')}</Badge>
          ) : (
            <Badge variant="warning" dot>{t('notVerified')}</Badge>
          )}
        </div>

        {hasEmail ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">{t('emailVerifiedTitle')}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 font-medium">{user?.email}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">{t('emailAddedDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!codeSent && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">{t('emailNotVerifiedTitle')}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">{t('emailNotVerifiedDesc')}</p>
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
          <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <Sun className="h-4 w-4 text-purple-500" />
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
                theme === value ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-[var(--border)] hover:border-orange-200',
              )}
            >
              <Icon className={cn('h-5 w-5', theme === value ? 'text-orange-500' : 'text-[var(--fg-muted)]')} />
              <span className={cn('text-sm font-medium', theme === value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg-muted)]')}>{t(key)}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Language */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Globe className="h-4 w-4 text-blue-500" />
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
                locale === lang.code ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-[var(--border)] hover:border-orange-200',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <p className={cn('font-medium', locale === lang.code ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]')}>{lang.label}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{t(lang.dirKey)}</p>
                </div>
              </div>
              {locale === lang.code && <span className="text-orange-500 text-sm">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <Bell className="h-4 w-4 text-amber-500" />
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
                  'relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                  notifPrefs[pref.id] ? 'bg-orange-500' : 'bg-[var(--border-strong)]',
                )}
                role="switch"
                aria-checked={notifPrefs[pref.id]}
                aria-label={t(`notifPrefs.${pref.key}.label`)}
              >
                <span className={cn('absolute top-0.5 start-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200', notifPrefs[pref.id] ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <Shield className="h-4 w-4 text-red-500" />
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
              <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
            </button>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h2 className="font-semibold text-red-500 mb-4">{t('dangerZone')}</h2>
        <Button variant="destructive" size="sm">{t('deleteAccount')}</Button>
      </Card>
    </div>
  )
}
