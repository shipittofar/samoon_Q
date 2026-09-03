'use client'

/**
 * ConfigurationSaveBar — P9.3 Phase G (Framework Improvement)
 *
 * Extracted from ConfigurationModulePage (P9.1.3 Phase J) unchanged in
 * markup/behavior, so existing tests asserting on "N unsaved change(s)"/
 * "Save Changes"/ "Discard" keep passing — this is a pure extraction plus
 * a keyboard-shortcut hint, not a redesign. Any future module's page (or
 * the Studio shell wrapping it) reuses this exact component; nothing here
 * references a specific module.
 */
import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'

export interface ConfigurationSaveBarProps {
  dirtyCount: number
  requiresReason: boolean
  reason: string
  onReasonChange: (value: string) => void
  isSaving: boolean
  onSave: () => void
  onDiscard: () => void
}

export function ConfigurationSaveBar({
  dirtyCount, requiresReason, reason, onReasonChange, isSaving, onSave, onDiscard,
}: ConfigurationSaveBarProps) {
  const t = useTranslations('console')
  useKeyboardShortcut('s', () => onSave(), { meta: true, allowInFormFields: true })

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--card)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] motion-safe:animate-[slide-up_180ms_ease-out]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Badge variant="warning">{t('unsavedChanges', { count: dirtyCount })}</Badge>
          {requiresReason && (
            <input
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="w-64 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary"size="sm"onClick={onDiscard} disabled={isSaving}>
            {t('discard')}
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            leftIcon={isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>}
          >
            {isSaving ? t('saving') : t('saveChanges')}
            <span className="ms-1.5 hidden rounded border border-white/30 px-1 text-[10px] font-normal opacity-80 sm:inline">⌘S</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
