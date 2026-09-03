'use client'

/**
 * P8.9.2 — OTP segmented input component.
 *
 * Renders N single-digit boxes. Supports auto-advance, backspace navigation,
 * paste-to-fill, mobile SMS autofill, and keyboard accessibility.
 */

import { forwardRef, KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/utils'

export interface OTPInputProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  className?: string
}

export const OTPInput = forwardRef<HTMLDivElement, OTPInputProps>(function OTPInput(
  { length = 6, value = '', onChange, onComplete, disabled, error, autoFocus, className },
  ref,
) {
  const prefersReducedMotion = useReducedMotion()
  const baseId = useId()
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array(length).fill('')
    for (let i = 0; i < Math.min(value.length, length); i++) arr[i] = value[i] || ''
    return arr
  })
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Sync external value → local digits
  useEffect(() => {
    const arr = Array(length).fill('')
    for (let i = 0; i < Math.min(value.length, length); i++) arr[i] = value[i] || ''
    setDigits(arr)
  }, [value, length])

  const focus = useCallback((index: number) => {
    inputsRef.current[Math.max(0, Math.min(index, length - 1))]?.focus()
  }, [length])

  useEffect(() => {
    if (autoFocus) focus(0)
  }, [autoFocus, focus])

  const commit = useCallback((newDigits: string[]) => {
    setDigits(newDigits)
    const joined = newDigits.join('')
    onChange?.(joined)
    if (newDigits.every((d) => d !== '')) {
      onComplete?.(joined)
    }
  }, [onChange, onComplete])

  const handleChange = useCallback((index: number, raw: string) => {
    // Accept only digits
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    commit(next)
    if (digit && index < length - 1) focus(index + 1)
  }, [digits, length, commit, focus])

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        // Clear current box
        const next = [...digits]
        next[index] = ''
        commit(next)
      } else if (index > 0) {
        // Move back and clear previous
        const next = [...digits]
        next[index - 1] = ''
        commit(next)
        focus(index - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(index + 1)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      const next = [...digits]
      next[index] = ''
      commit(next)
    } else if (e.key === 'Tab') {
      // Allow natural tab navigation
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault()
      const next = [...digits]
      next[index] = e.key
      commit(next)
      if (index < length - 1) focus(index + 1)
    }
  }, [digits, length, commit, focus])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    commit(next)
    // Focus the last filled box or the next empty one
    const nextFocus = Math.min(pasted.length, length - 1)
    focus(nextFocus)
  }, [length, commit, focus])

  const shakeVariants = {
    idle: { x: 0 },
    shake: {
      x: prefersReducedMotion ? 0 : [0, -6, 6, -4, 4, -2, 2, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={cn('flex items-center gap-2 sm:gap-3', className)}
      role="group"
      aria-label="One-time code"
      animate={error ? 'shake' : 'idle'}
      variants={shakeVariants}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el }}
          id={`${baseId}-${i}`}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 w-10 sm:h-14 sm:w-12 rounded-xl border text-center text-xl font-bold',
            'bg-[var(--input-bg)] text-[var(--fg)] transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:border-transparent',
            digit
              ? error
                ? 'border-[var(--danger)] bg-[var(--danger-subtle)] focus:ring-[var(--danger)]'
                : 'border-[var(--accent)] bg-[var(--accent-subtle)] focus:ring-[var(--accent)]'
              : error
                ? 'border-[var(--danger-border)] focus:ring-[var(--danger)]'
                : 'border-[var(--border)] focus:ring-[var(--accent)]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </motion.div>
  )
})
