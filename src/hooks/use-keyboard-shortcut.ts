'use client'

/**
 * useKeyboardShortcut — P9.3 Phase I (Framework Improvement)
 *
 * Generic global keyboard-shortcut binder — not Configuration Studio
 * specific, though the Studio is its first real consumer (Ctrl/Cmd+S save,
 * Ctrl/Cmd+K command palette, Esc close). Ignores keystrokes while the
 * focus is inside a text input/textarea/select/contenteditable unless
 * `allowInFormFields` is set, so shortcuts never fight normal typing.
 */
import { useEffect } from 'react'

export interface KeyboardShortcutOptions {
  /** Require Ctrl (Windows/Linux) or Cmd (macOS) held down. */
  meta?: boolean
  shift?: boolean
  /** Fire even while an <input>/<textarea>/<select>/contenteditable has focus. Defaults to false. */
  allowInFormFields?: boolean
  enabled?: boolean
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Binds `key` (e.g. 's', 'k', 'Escape') to `handler` for the component's lifetime. */
export function useKeyboardShortcut(key: string, handler: (e: KeyboardEvent) => void, options: KeyboardShortcutOptions = {}) {
  const { meta = false, shift = false, allowInFormFields = false, enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      if (meta && !(e.metaKey || e.ctrlKey)) return
      if (!meta && (e.metaKey || e.ctrlKey)) return
      if (shift && !e.shiftKey) return
      if (!allowInFormFields && isTypingTarget(e.target) && key.toLowerCase() !== 'escape') return
      handler(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, meta, shift, allowInFormFields, enabled])
}
