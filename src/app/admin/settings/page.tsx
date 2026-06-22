'use client'

import { useState } from 'react'
import { Settings, Palette, Clock, Plug, Bell, Shield } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { useTenantStore } from '@/stores'

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function PlaceholderSection({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
      <p className="text-sm">{label} settings coming soon.</p>
    </div>
  )
}

function GeneralTab() {
  const tenant = useTenantStore((s) => s.tenant)
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
        <input
          type="text"
          defaultValue={tenant?.name ?? ''}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          readOnly
        />
        <p className="text-xs text-gray-400 mt-1">Managed by your account settings.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
        <input
          type="text"
          defaultValue={tenant?.businessTypes?.join(', ') ?? ''}
          className="w-full border rounded-md px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
          readOnly
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
        <input
          type="text"
          defaultValue={tenant?.id ?? ''}
          className="w-full border rounded-md px-3 py-2 text-sm font-mono text-gray-500 focus:outline-none"
          readOnly
        />
      </div>
    </div>
  )
}

function BrandingTab() {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
        <div className="flex items-center gap-3">
          <input type="color" defaultValue="#2563eb" className="h-9 w-16 rounded border cursor-pointer" />
          <span className="text-sm text-gray-500">#2563eb</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-gray-400">
          Drag & drop or click to upload logo
        </div>
      </div>
    </div>
  )
}

function HoursTab() {
  return (
    <div className="space-y-3">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-4 text-sm">
          <span className="w-28 text-gray-600">{day}</span>
          <input type="time" defaultValue="09:00" className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">–</span>
          <input type="time" defaultValue="22:00" className="border rounded px-2 py-1 text-sm" />
          <label className="flex items-center gap-1.5 text-gray-500">
            <input type="checkbox" defaultChecked className="rounded" />
            Open
          </label>
        </div>
      ))}
    </div>
  )
}

function NotificationsTab() {
  const CHANNELS = ['Email', 'SMS', 'Push', 'In-App'] as const
  const EVENTS = ['New Order', 'Order Status Change', 'New Reservation', 'SLA Breach', 'Staff Clock-in'] as const
  return (
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
              {CHANNELS.map((c) => (
                <td key={c} className="text-center py-2.5">
                  <input type="checkbox" defaultChecked={c === 'In-App'} className="rounded" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
          {/* Sidebar tabs */}
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

          {/* Content */}
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
