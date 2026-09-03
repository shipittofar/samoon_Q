import { describe, expect, it } from 'vitest'
import { BRANDING_PALETTE_PRESETS } from '@/config/branding-defaults'
import {
  SURFACE_REFS,
  brandTokensToCssVars,
  contrastRatio,
  deriveBrandTokens,
  isValidHexColor,
  parseColor,
  readableForeground,
} from '@/lib/brand-color'

describe('brand colour parsing', () => {
  it('accepts supported hex forms and rejects unsafe values', () => {
    expect(isValidHexColor('#abc')).toBe(true)
    expect(isValidHexColor('#abcdef')).toBe(true)
    expect(isValidHexColor('#abcdef80')).toBe(true)
    expect(isValidHexColor('#abcd')).toBe(true)
    expect(isValidHexColor('#abcde')).toBe(false)
    expect(isValidHexColor('red')).toBe(false)
    expect(isValidHexColor('var(--accent)')).toBe(false)
    expect(parseColor(null)).toBeNull()
  })

  it('chooses the more readable foreground for light and dark fills', () => {
    expect(readableForeground('#fbbf24')).toBe('#1c1917')
    expect(readableForeground('#1e3a5f')).toBe('#ffffff')
  })
})

describe('tenant brand semantic derivation', () => {
  const edgeCases = [
    { id: 'pure-white', primaryColor: '#ffffff', accentHoverColor: null },
    { id: 'pure-black', primaryColor: '#000000', accentHoverColor: null },
    { id: 'neon-yellow', primaryColor: '#ffff00', accentHoverColor: null },
    { id: 'neon-green', primaryColor: '#00ff00', accentHoverColor: null },
    { id: 'short-hex', primaryColor: '#39f', accentHoverColor: null },
  ]

  const palettes = [...BRANDING_PALETTE_PRESETS, ...edgeCases]

  it.each(palettes)(
    '$id meets text and non-text contrast targets in both themes',
    ({ primaryColor, accentHoverColor }) => {
      const tokens = deriveBrandTokens(primaryColor, accentHoverColor)

      for (const theme of ['light', 'dark'] as const) {
        const set = tokens[theme]
        const surface = SURFACE_REFS[theme]

        // WCAG 2.2 1.4.3 — normal text.
        expect(contrastRatio(set.accentFg, set.accent)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(set.accentText, surface)).toBeGreaterThanOrEqual(4.5)

        // WCAG 2.2 1.4.11 — controls, boundaries and focus indicators.
        expect(contrastRatio(set.accent, surface)).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(set.accentBorder, surface)).toBeGreaterThanOrEqual(3)

        // Hover must be visibly different from the resting fill.
        expect(contrastRatio(set.accent, set.accentHover)).toBeGreaterThanOrEqual(1.12)
      }
    },
  )

  it('falls back safely when a persisted colour is invalid', () => {
    const tokens = deriveBrandTokens('not-a-colour')
    expect(tokens.light.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(contrastRatio(tokens.light.accentFg, tokens.light.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('emits separate light and dark CSS variables', () => {
    const vars = brandTokensToCssVars(deriveBrandTokens('#1e3a5f'))
    expect(vars['--tenant-accent-light']).toBeDefined()
    expect(vars['--tenant-accent-dark']).toBeDefined()
    expect(vars['--tenant-accent-text-light']).toBeDefined()
    expect(vars['--tenant-accent-text-dark']).toBeDefined()
    expect(vars['--tenant-accent-fg-light']).toBeDefined()
    expect(vars['--tenant-accent-fg-dark']).toBeDefined()
    expect(vars['--tenant-accent-dark']).not.toBe(vars['--tenant-accent-light'])
  })
})
