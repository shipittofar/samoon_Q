'use client'

import { Bell, BellOff, BellRing } from 'lucide-react'
import { useNotificationPermission } from '@/hooks'
import { Button } from '@/components/ui/Button'

export function PushNotificationSettings() {
  const { permission, request } = useNotificationPermission()

  const statusText = {
    granted: 'Enabled',
    denied: 'Blocked by browser',
    default: 'Not enabled',
  }[permission]

  const StatusIcon = permission === 'granted' ? BellRing : permission === 'denied' ? BellOff : Bell

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${permission === 'granted' ? 'bg-green-100 text-green-600' : 'bg-[var(--card-hover)] text-[var(--fg-muted)]'}`}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">Push Notifications</p>
          <p className="text-xs text-[var(--fg-muted)]">{statusText}</p>
        </div>
      </div>
      {permission === 'default' && (
        <Button size="sm" onClick={request}>
          Enable
        </Button>
      )}
      {permission === 'denied' && (
        <p className="text-xs text-[var(--fg-muted)]">Update in browser settings</p>
      )}
      {permission === 'granted' && (
        <span className="text-xs font-medium text-green-600">Active</span>
      )}
    </div>
  )
}
