'use client'

/**
 * ConfigurationFieldControl — P9.1.3 Phase C/D (Automatic Rendering)
 *
 * Maps a field's `uiControl` (or the ` type`-based fallback from
 * `resolveUiControl()`) to an actual input element. This is the one place
 * in the whole Console that has a switch statement over control kind — every
 * page that renders a module (Authentication today, any future module) goes
 * through this same component, so a new module never needs its own control
 * mapping written by hand.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { resolveUiControl } from './configUiHelpers'
import { resolveConfigOptionText } from '@/config'
import type { ConfigFieldDefinition, ConfigFieldOption } from '@/config'

export interface ConfigurationFieldControlProps {
  field: ConfigFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  /**
   * Scope id path for resolving this field's OWN `options[].label`/
   * `.description` (P9.5.7D.1) — defaults to ` field.id`, correct for
   * every ordinary module field (globally unique per Rule 3). Collection
   * schema properties pass their parent collection field's scoped path
   * (`[collectionFieldId, 'schema', propertyId]`) instead, so option
   * labels don't collide across different collections that happen to
   * reuse the same short property id — see `src/config/i18n.ts`.
   */
  optionScopeId?: string | string[]
}

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 disabled:opacity-50 disabled:cursor-not-allowed'

export function ConfigurationFieldControl({ field, value, onChange, disabled, optionScopeId }: ConfigurationFieldControlProps) {
  const t = useTranslations('console')
  const tFields = useTranslations('configFields')
  const control = resolveUiControl(field)
  const [secretVisible, setSecretVisible] = useState(false)
  const scopeId = optionScopeId ?? field.id
  const optionLabel = (opt: ConfigFieldOption) => resolveConfigOptionText(tFields, scopeId, opt, 'label', opt.label)

  switch (control) {
    case 'switch':
    case 'checkbox': {
      const checked = Boolean(value)
      return (
        <button
          type="button"
          role={control === 'switch' ? 'switch' : 'checkbox'}
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-[var(--card)] shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      )
    }

    case 'radio': {
      const options = field.options ?? []
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                value === opt.value
                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'
              }`}
            >
              {optionLabel(opt)}
            </button>
          ))}
        </div>
      )
    }

    case 'country_selector':
    case 'language_selector':
    case 'currency_picker':
    case 'otp_provider_picker':
    case 'timezone_picker': {
      const options = field.options ?? []
      return (
        <select
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>{optionLabel(opt)}</option>
          ))}
        </select>
      )
    }

    case 'font_selector': {
      const options = field.options ?? []
      return (
        <select
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: String(value ?? '') }}
          className={inputClass}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)} style={{ fontFamily: String(opt.value) }}>{optionLabel(opt)}</option>
          ))}
        </select>
      )
    }

    case 'color_picker': {
      const strValue = String(value ?? '#000000')
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded border border-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            type="text"
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </div>
      )
    }

    case 'slider': {
      const numValue = Number(value ?? 0)
      const min = field.validation?.min ?? 0
      const max = field.validation?.max ?? 100
      const step = field.validation?.step ?? 1
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={numValue}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-[var(--accent)] disabled:opacity-50"
          />
          <span className="w-14 shrink-0 text-right font-mono text-sm text-[var(--fg)]">{numValue}</span>
        </div>
      )
    }

    case 'number': {
      const min = field.validation?.min
      const max = field.validation?.max
      const step = field.validation?.step
      return (
        <input
          type="number"
          value={Number(value ?? 0)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputClass}
        />
      )
    }

    case 'secret_input': {
      const strValue = String(value ?? '')
      return (
        <div className="relative">
          <input
            type={secretVisible ? 'text' : 'password'}
            value={strValue}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? '••••••••••••'}
            className={`${inputClass} pr-10 font-mono`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setSecretVisible((v) => !v)}
            aria-label={secretVisible ? t('hideValueAria') : t('revealValueAria')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            {secretVisible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
      )
    }

    case 'json_editor':
    case 'table_editor': {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return (
        <textarea
          value={text}
          disabled={disabled}
          rows={control === 'table_editor' ? 8 : 5}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              // Not valid JSON yet (mid-edit) — keep the raw text so the
              // user can keep typing; ConfigurationValidator catches an
              // ultimately-invalid value at save time.
              onChange(e.target.value)
            }
          }}
          className={`${inputClass} font-mono text-xs`}
        />
      )
    }

    case 'file_upload': {
      return (
        <div className="space-y-1">
          <input
            type="url"
            value={String(value ?? '')}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? 'https://…'}
            className={inputClass}
          />
          <p className="text-xs text-[var(--fg-muted)]">{t('urlBasedUntilStorageWired')}</p>
        </div>
      )
    }

    case 'textarea': {
      return (
        <textarea
          value={String(value ?? '')}
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )
    }

    case 'text':
    default: {
      return (
        <input
          type="text"
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )
    }
  }
}
