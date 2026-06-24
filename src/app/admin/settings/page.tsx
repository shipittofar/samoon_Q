'use client'

import { useState, useEffect } from 'react'
import { Settings, Palette, Clock, Plug, Bell, Shield, Save, CheckCircle, Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { useTenantStore } from '@/stores'
import { useUpdateTenantSettings } from '@/hooks'
import type { TenantTheme } from '@/types'

const TABS = ['general', 'branding', 'hours', 'integrations', 'notifications', 'advanced'] as const
type Tab = (typeof TABS)[number]

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ElementType }> = {
  general:       { label: 'General',        icon: Settings  },
  branding:      { label: 'Branding',       icon: Palette   },
  hours:         { label: 'Business Hours', icon: Clock     },
  integrations:  { label: 'Integrations',   icon: Plug      },
  notifications: { label: 'Notifications',  icon: Bell      },
  advanced:      { label: 'Advanced',       icon: Shield    },
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

type DayKey = (typeof DAYS)[number]

interface HoursEntry { open: string; close: string; isOpen: boolean }
type HoursMap = Record<DayKey, HoursEntry>

function defaultHours(existing?: unknown): HoursMap {
  const map = existing as Record<string, HoursEntry> | undefined
  return Object.fromEntries(
    DAYS.map((day) => [day, map?.[day] ?? { open: '09:00', close: '22:00', isOpen: true }]),
  ) as HoursMap
}

interface SaveBarProps { isPending: boolean; saved: boolean; onSave: () => void }
function SaveBar({ isPending, saved, onSave }: SaveBarProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t">
      {saved && !isPending && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> Saved
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isPending ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

function GeneralTab() {
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const [contactEmail, setContactEmail] = useState(
    (tenant?.settings?.contactEmail as string | undefined) ?? '',
  )
  const [contactPhone, setContactPhone] = useState(
    (tenant?.settings?.contactPhone as string | undefined) ?? '',
  )

  function handleSave() {
    save({ contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
        <input
          type="text"
          value={tenant?.name ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">Managed by your account settings.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
        <input
          type="text"
          value={tenant?.businessTypes?.join(', ') ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 capitalize cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
        <input
          type="text"
          value={tenant?.id ?? ''}
          readOnly
          className="w-full border rounded-md px-3 py-2 text-sm font-mono text-gray-500 bg-gray-50 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="contact@example.com"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+1 555-000-0000"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function BrandingTab() {
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const existingTheme = tenant?.settings?.theme as TenantTheme | undefined
  const [primaryColor, setPrimaryColor] = useState(existingTheme?.primaryColor ?? '#2563eb')
  const [logoUrl, setLogoUrl] = useState(existingTheme?.logoUrl ?? '')
  const [fontBody, setFontBody] = useState(existingTheme?.fontBody ?? '')

  useEffect(() => {
    const t = tenant?.settings?.theme as TenantTheme | undefined
    if (t) {
      setPrimaryColor(t.primaryColor ?? '#2563eb')
      setLogoUrl(t.logoUrl ?? '')
      setFontBody(t.fontBody ?? '')
    }
  }, [tenant?.slug])

  function handleSave() {
    const theme: TenantTheme = {
      ...(existingTheme ?? {}),
      primaryColor,
      logoUrl: logoUrl || undefined,
      fontBody: fontBody || undefined,
    }
    save({ theme })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-16 rounded border cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-32 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Body Font</label>
        <input
          type="text"
          value={fontBody}
          onChange={(e) => setFontBody(e.target.value)}
          placeholder='"Inter", sans-serif'
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function HoursTab() {
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()
  const [hours, setHours] = useState<HoursMap>(() =>
    defaultHours(tenant?.settings?.businessHours),
  )

  function setDay(day: DayKey, patch: Partial<HoursEntry>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  function handleSave() {
    save({ businessHours: hours })
  }

  return (
    <div className="space-y-3">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-4 text-sm">
          <span className="w-28 text-gray-600 shrink-0">{day}</span>
          <input
            type="time"
            value={hours[day].open}
            onChange={(e) => setDay(day, { open: e.target.value })}
            disabled={!hours[day].isOpen}
            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          />
          <span className="text-gray-400">–</span>
          <input
            type="time"
            value={hours[day].close}
            onChange={(e) => setDay(day, { close: e.target.value })}
            disabled={!hours[day].isOpen}
            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          />
          <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={hours[day].isOpen}
              onChange={(e) => setDay(day, { isOpen: e.target.checked })}
              className="rounded"
            />
            Open
          </label>
        </div>
      ))}
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

type NotifMatrix = Record<string, Record<string, boolean>>

function NotificationsTab() {
  const tenant = useTenantStore((s) => s.tenant)
  const { mutate: save, isPending, isSuccess } = useUpdateTenantSettings()

  const CHANNELS = ['Email', 'SMS', 'Push', 'In-App'] as const
  const EVENTS = ['New Order', 'Order Status Change', 'New Reservation', 'SLA Breach', 'Staff Clock-in'] as const
  type Channel = (typeof CHANNELS)[number]
  type Event = (typeof EVENTS)[number]

  const existingMatrix = tenant?.settings?.notificationMatrix as NotifMatrix | undefined

  const [matrix, setMatrix] = useState<NotifMatrix>(() => {
    const base: NotifMatrix = {}
    for (const evt of EVENTS) {
      base[evt] = {}
      for (const ch of CHANNELS) {
        base[evt][ch] = existingMatrix?.[evt]?.[ch] ?? ch === 'In-App'
      }
    }
    return base
  })

  function toggle(evt: Event, ch: Channel) {
    setMatrix((prev) => ({
      ...prev,
      [evt]: { ...prev[evt], [ch]: !prev[evt][ch] },
    }))
  }

  function handleSave() {
    save({ notificationMatrix: matrix })
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-gray-600 pb-3 w-48">Event</th>
              {CHANNELS.map((c) => (
                <th key={c} className="text-center font-medium text-gray-600 pb-3 px-4">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {EVENTS.map((evt) => (
              <tr key={evt}>
                <td className="py-2.5 text-gray-700">{evt}</td>
                {CHANNELS.map((ch) => (
                  <td key={ch} className="text-center py-2.5">
                    <input
                      type="checkbox"
                      checked={matrix[evt]?.[ch] ?? false}
                      onChange={() => toggle(evt, ch)}
                      className="rounded"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar isPending={isPending} saved={isSuccess} onSave={handleSave} />
    </div>
  )
}

function PlaceholderSection({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
      <p className="text-sm">{label} settings coming soon.</p>
    </div>
  )
}

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <nav className="w-44 shrink-0 space-y-1">
            {TABS.map((tab) => {
              const { label, icon: Icon } = TAB_CONFIG[tab]
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    activeTab === tab
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="flex-1 bg-white rounded-lg border p-6">
            <h2 className="text-base font-semibold mb-5">{TAB_CONFIG[activeTab].label}</h2>
            <ErrorBoundary feature={`Settings — ${TAB_CONFIG[activeTab].label}`}>
              {activeTab === 'general'       && <GeneralTab />}
              {activeTab === 'branding'      && <BrandingTab />}
              {activeTab === 'hours'         && <HoursTab />}
              {activeTab === 'integrations'  && <PlaceholderSection label="Integrations" />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'advanced'      && <PlaceholderSection label="Advanced" />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ErrorBoundary feature="Settings">
      <PermissionGuard permission="settings.view">
        <SettingsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
