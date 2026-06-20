'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Monitor, Globe, Bell, Shield, User, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { useAuthStore, useThemeStore, useLangStore } from '@/stores'
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
  const { locale, setLocale } = useLangStore()
  const [saving, setSaving] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    order_updates: true, promotions: true, reservation_reminders: true, system: true,
  })

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
          <Avatar src={user?.avatar} firstName={user?.first_name} lastName={user?.last_name} size="lg" />
          <div>
            <p className="font-semibold text-[var(--fg)]">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-[var(--fg-muted)]">{user?.email}</p>
          </div>
          <Button variant="secondary" size="sm" className="ms-auto">Change Photo</Button>
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
