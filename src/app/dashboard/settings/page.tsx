'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Monitor, Globe, Bell, Shield, User, ChevronRight, Camera, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { useAuthStore, useThemeStore, useLangStore } from '@/stores'
import { useSetLocale } from '@/hooks'
import { userService } from '@/services/combined.service'
import { cn } from '@/utils'
import toast from 'react-hot-toast'

const profileSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
})
type ProfileFormData = z.infer<typeof profileSchema>

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸', dir: 'LTR' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷', dir: 'RTL' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'RTL' },
]

const NOTIFICATION_PREFS = [
  { id: 'order_updates', label: 'Order Updates', desc: 'Status changes and delivery notifications' },
  { id: 'promotions', label: 'Promotions', desc: 'Deals, discounts and special offers' },
  { id: 'reservation_reminders', label: 'Reservation Reminders', desc: 'Reminders before your booking' },
  { id: 'system', label: 'System Notices', desc: 'Security and account notifications' },
]

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { locale } = useLangStore()
  const setLocale = useSetLocale()
  const [saving, setSaving] = useState(false)
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
      setUploadError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum 5 MB.')
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
      toast.success('Avatar updated!')
      setUploadState('success')
      setPendingFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setUploadError(msg)
      setUploadState('error')
    }
  }

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name || '', last_name: user?.last_name || '', email: user?.email || '', phone: user?.phone || '' },
  })

  const onSaveProfile = async (data: ProfileFormData) => {
    setSaving(true)
    try {
      const updated = await userService.updateProfile(data)
      setUser({ ...user!, ...updated })
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">Settings</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <User className="h-4 w-4 text-orange-500" />
          </div>
          <h2 className="font-semibold text-[var(--fg)]">Profile Information</h2>
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
                aria-label="Change profile photo"
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
              aria-label="Select profile photo"
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
                  {uploadState === 'uploading' ? 'Uploading…' : 'Upload'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancelPreview}
                  disabled={uploadState === 'uploading'}
                  leftIcon={<X className="h-3.5 w-3.5" />}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Feedback messages */}
            {uploadState === 'success' && (
              <p className="mt-1 text-xs text-emerald-600 font-medium">Avatar updated successfully.</p>
            )}
            {uploadState === 'error' && uploadError && (
              <p className="mt-1 text-xs text-red-500" role="alert">{uploadError}</p>
            )}
            {!pendingFile && !uploadError && uploadState !== 'success' && (
              <p className="mt-1 text-xs text-[var(--fg-muted)]">JPEG, PNG, WebP or GIF · max 5 MB</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First Name" required {...register('first_name')} error={errors.first_name?.message} />
            <Input label="Last Name" required {...register('last_name')} error={errors.last_name?.message} />
            <Input label="Email" type="email" required {...register('email')} error={errors.email?.message} />
            <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
          </div>
          <Button type="submit" loading={saving} disabled={!isDirty}>Save Changes</Button>
        </form>
      </Card>

      {/* Theme */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <Sun className="h-4 w-4 text-purple-500" />
          </div>
          <h2 className="font-semibold text-[var(--fg)]">Appearance</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                theme === value ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-[var(--border)] hover:border-orange-200',
              )}
            >
              <Icon className={cn('h-5 w-5', theme === value ? 'text-orange-500' : 'text-[var(--fg-muted)]')} />
              <span className={cn('text-sm font-medium', theme === value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg-muted)]')}>{label}</span>
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
          <h2 className="font-semibold text-[var(--fg)]">Language & Region</h2>
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
                  <p className="text-xs text-[var(--fg-muted)]">{lang.dir}</p>
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
          <h2 className="font-semibold text-[var(--fg)]">Notification Preferences</h2>
        </div>
        <div className="space-y-1">
          {NOTIFICATION_PREFS.map((pref) => (
            <div key={pref.id} className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{pref.label}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">{pref.desc}</p>
              </div>
              <button
                onClick={() => setNotifPrefs((p) => ({ ...p, [pref.id]: !p[pref.id] }))}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                  notifPrefs[pref.id] ? 'bg-orange-500' : 'bg-[var(--border-strong)]',
                )}
                role="switch"
                aria-checked={notifPrefs[pref.id]}
                aria-label={pref.label}
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
          <h2 className="font-semibold text-[var(--fg)]">Security</h2>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Change Password', desc: 'Update your account password' },
            { label: 'Two-Factor Authentication', desc: 'Add an extra layer of security' },
            { label: 'Active Sessions', desc: 'Manage logged-in devices' },
          ].map((item) => (
            <button key={item.label} className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] transition-colors text-start">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{item.label}</p>
                <p className="text-xs text-[var(--fg-muted)]">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
            </button>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h2 className="font-semibold text-red-500 mb-4">Danger Zone</h2>
        <Button variant="destructive" size="sm">Delete Account</Button>
      </Card>
    </div>
  )
}
