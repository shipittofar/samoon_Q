import type { RichNotification } from '@/types/notification'

/** The notifications page of the area the user is in (customers cannot open the console's). */
export function notificationsPage(pathname: string | null | undefined): string {
  return pathname?.startsWith('/console') ? '/console/notifications' : '/dashboard/notifications'
}

/** Where a notification leads: its own link (inside this site only), else the notifications page. */
export function notificationTarget(
  n: Pick<Partial<RichNotification>, 'deepLink'>,
  pathname: string | null | undefined,
): string {
  const href = n.deepLink?.href ?? ''
  return /^\/(?![/\\])/.test(href) ? href : notificationsPage(pathname)
}
