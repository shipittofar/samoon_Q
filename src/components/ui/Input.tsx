import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils'

const inputBase =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed'

// ── Input ──────────────────────────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--fg)]">
            {label}
            {props.required && <span className="text-orange-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(inputBase, leftIcon && 'ps-10', rightIcon && 'pe-10', error && 'border-red-500 focus:border-red-500 focus:ring-red-500/40', className)}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {rightIcon && (
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--fg-muted)]">{hint}</p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ── Textarea ───────────────────────────────────────────────────────────────────
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--fg)]">
            {label}
            {props.required && <span className="text-orange-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={4}
          className={cn(inputBase, 'resize-none', error && 'border-red-500 focus:border-red-500 focus:ring-red-500/40', className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-xs text-red-500">⚠ {error}</p>}
        {hint && !error && <p className="text-xs text-[var(--fg-muted)]">{hint}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

// ── Select ─────────────────────────────────────────────────────────────────────
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--fg)]">
            {label}
            {props.required && <span className="text-orange-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(inputBase, 'appearance-none cursor-pointer', error && 'border-red-500', className)}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">⚠ {error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

// ── Checkbox ───────────────────────────────────────────────────────────────────
export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).slice(2)}`
    return (
      <label htmlFor={inputId} className="flex items-center gap-2.5 cursor-pointer group">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          className={cn('h-4 w-4 rounded border-[var(--border)] accent-orange-500 cursor-pointer', className)}
          {...props}
        />
        {label && <span className="text-sm text-[var(--fg)] group-hover:text-[var(--fg-muted)] transition-colors">{label}</span>}
      </label>
    )
  },
)
Checkbox.displayName = 'Checkbox'
