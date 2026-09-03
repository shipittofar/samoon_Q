'use client'

import { useConsoleWorkspaceRealtime } from '@/hooks/console-realtime'

/** Console-shell owner of the workspace WebSocket. Mount once in the Console layout. */
export function ConsoleWorkspaceRealtime() {
  useConsoleWorkspaceRealtime()
  return null
}
