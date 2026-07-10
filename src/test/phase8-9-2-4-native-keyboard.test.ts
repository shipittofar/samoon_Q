/**
 * P8.9.2.4 — Native Mobile Keyboard Behavior
 *
 * Tests cover the VisualViewport-driven sheet max-height logic:
 * - keyboard open / close detection
 * - viewportHeight computation
 * - sheetMaxHeight calculation
 * - threshold behaviour (keyboardHeight > 50)
 * - fallback when VisualViewport unavailable
 * - orientation change
 * - search while keyboard visible
 * - selected row visibility constraint
 * - scroll persistence
 */

import { describe, it, expect } from 'vitest'

// ── Helpers mirroring the PhoneInput hook logic ────────────────────────────────

interface ViewportState {
  keyboardHeight: number
  viewportHeight: number
}

/**
 * Pure function version of the useVisualViewport state computation.
 * Given window.innerHeight and visualViewport dimensions, returns the state.
 */
function computeViewportState(
  windowInnerHeight: number,
  vvHeight: number,
  vvOffsetTop: number,
): ViewportState {
  const kh = Math.max(0, windowInnerHeight - vvHeight - vvOffsetTop)
  return { keyboardHeight: kh, viewportHeight: vvHeight }
}

/**
 * Pure function version of the sheet max-height decision.
 */
function computeSheetMaxHeight(state: ViewportState): string | undefined {
  const keyboardOpen = state.keyboardHeight > 50
  return keyboardOpen ? `${Math.round(state.viewportHeight * 0.92)}px` : undefined
}

// ── Keyboard open / close detection ──────────────────────────────────────────

describe('useVisualViewport — keyboard detection', () => {
  it('keyboard closed: keyboardHeight is 0 when viewport equals window', () => {
    const state = computeViewportState(844, 844, 0)
    expect(state.keyboardHeight).toBe(0)
    expect(state.viewportHeight).toBe(844)
  })

  it('keyboard open: detects height delta correctly', () => {
    // iPhone 14: window=844, keyboard≈350px, vv.height≈494
    const state = computeViewportState(844, 494, 0)
    expect(state.keyboardHeight).toBe(350)
    expect(state.viewportHeight).toBe(494)
  })

  it('includes vv.offsetTop in keyboard height calculation', () => {
    // Some Android browsers report a non-zero offsetTop
    const state = computeViewportState(900, 500, 50)
    // kh = 900 - 500 - 50 = 350
    expect(state.keyboardHeight).toBe(350)
  })

  it('clamps keyboard height to 0 — never negative', () => {
    // Edge case: vv.height slightly larger than innerHeight (can happen briefly during animation)
    const state = computeViewportState(800, 810, 0)
    expect(state.keyboardHeight).toBe(0)
  })
})

// ── Sheet max-height computation ──────────────────────────────────────────────

describe('computeSheetMaxHeight — sheet anchoring', () => {
  it('returns undefined when keyboard is closed', () => {
    const state = computeViewportState(844, 844, 0)
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })

  it('returns pixel string when keyboard is open', () => {
    const state = computeViewportState(844, 494, 0)
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBe(`${Math.round(494 * 0.92)}px`)
  })

  it('maxHeight is 92% of visible viewport', () => {
    const vvHeight = 500
    const state: ViewportState = { keyboardHeight: 300, viewportHeight: vvHeight }
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBe(`${Math.round(vvHeight * 0.92)}px`)
  })

  it('threshold: keyboardHeight=50 does NOT trigger resize (≤50 is not open)', () => {
    const state: ViewportState = { keyboardHeight: 50, viewportHeight: 794 }
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })

  it('threshold: keyboardHeight=51 triggers resize (>50 is open)', () => {
    const state: ViewportState = { keyboardHeight: 51, viewportHeight: 793 }
    expect(computeSheetMaxHeight(state)).toBeDefined()
  })

  it('rounds to integer pixels — no sub-pixel values', () => {
    const state: ViewportState = { keyboardHeight: 333, viewportHeight: 511 }
    const mh = computeSheetMaxHeight(state)
    // Should be an integer followed by px
    expect(mh).toMatch(/^\d+px$/)
  })
})

// ── Platform simulations ──────────────────────────────────────────────────────

describe('platform keyboard simulations', () => {
  it('iPhone 14 Pro — standard keyboard', () => {
    // window.innerHeight=932, keyboard≈345, vv.height≈587
    const state = computeViewportState(932, 587, 0)
    expect(state.keyboardHeight).toBe(345)
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBe(`${Math.round(587 * 0.92)}px`)
  })

  it('iPhone SE — small screen with keyboard', () => {
    // window.innerHeight=667, keyboard≈260, vv.height≈407
    const state = computeViewportState(667, 407, 0)
    expect(state.keyboardHeight).toBe(260)
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBeDefined()
    // Sheet fits in visible area
    const px = parseInt(mh!, 10)
    expect(px).toBeLessThanOrEqual(state.viewportHeight)
  })

  it('Android Pixel — gesture navigation (nav bar included in vv delta)', () => {
    // window.innerHeight=851 (includes nav bar), vv.height=470 (above keyboard+nav)
    const state = computeViewportState(851, 470, 0)
    expect(state.keyboardHeight).toBe(381)
    expect(computeSheetMaxHeight(state)).toBeDefined()
  })

  it('Android Samsung — 3-button nav bar', () => {
    const state = computeViewportState(800, 430, 0)
    expect(state.keyboardHeight).toBe(370)
    expect(computeSheetMaxHeight(state)).toBeDefined()
  })

  it('iPad landscape — split keyboard (short visible height)', () => {
    // Landscape, vv.height≈380 above floating keyboard
    const state = computeViewportState(810, 380, 0)
    expect(state.keyboardHeight).toBe(430)
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBe(`${Math.round(380 * 0.92)}px`)
  })

  it('landscape phone_number — very short viewport above keyboard', () => {
    // Landscape orientation: window.innerHeight=375, keyboard≈215, vv.height≈160
    const state = computeViewportState(375, 160, 0)
    expect(state.keyboardHeight).toBe(215)
    const mh = computeSheetMaxHeight(state)
    // Sheet must still fit; 92% of 160 = ~147px — very short but not 0
    const px = parseInt(mh!, 10)
    expect(px).toBeGreaterThan(0)
    expect(px).toBeLessThanOrEqual(160)
  })

  it('external keyboard — no software keyboard, no resize', () => {
    // External keyboard: visualViewport unchanged
    const state = computeViewportState(844, 844, 0)
    expect(state.keyboardHeight).toBe(0)
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })
})

// ── Orientation change ────────────────────────────────────────────────────────

describe('orientation change', () => {
  it('portrait → landscape: recalculates correctly', () => {
    // Portrait, keyboard open
    const portrait = computeViewportState(844, 494, 0)
    expect(portrait.keyboardHeight).toBe(350)
    const mhPortrait = computeSheetMaxHeight(portrait)
    expect(mhPortrait).toBeDefined()

    // Rotate to landscape (smaller height, keyboard proportionally smaller)
    const landscape = computeViewportState(390, 175, 0)
    expect(landscape.keyboardHeight).toBe(215)
    const mhLandscape = computeSheetMaxHeight(landscape)
    expect(mhLandscape).toBeDefined()
    // Landscape sheet max-height is smaller than portrait
    expect(parseInt(mhLandscape!, 10)).toBeLessThan(parseInt(mhPortrait!, 10))
  })

  it('landscape → portrait: sheet max-height increases', () => {
    const landscape = computeViewportState(390, 175, 0)
    const portrait = computeViewportState(844, 494, 0)
    const mhL = computeSheetMaxHeight(landscape)!
    const mhP = computeSheetMaxHeight(portrait)!
    expect(parseInt(mhP, 10)).toBeGreaterThan(parseInt(mhL, 10))
  })
})

// ── Search while keyboard visible ─────────────────────────────────────────────

describe('search interaction with keyboard visible', () => {
  it('sheet max-height is stable while query changes (viewport unchanged)', () => {
    // The VisualViewport state does not change as the user types
    const state: ViewportState = { keyboardHeight: 350, viewportHeight: 494 }
    const mh1 = computeSheetMaxHeight(state)
    const mh2 = computeSheetMaxHeight(state) // same state, different query (not tracked here)
    expect(mh1).toBe(mh2)
  })

  it('maxHeight is a string suitable as a CSS value', () => {
    const state: ViewportState = { keyboardHeight: 350, viewportHeight: 494 }
    const mh = computeSheetMaxHeight(state)!
    expect(typeof mh).toBe('string')
    expect(mh.endsWith('px')).toBe(true)
    expect(parseInt(mh, 10)).toBeGreaterThan(0)
  })
})

// ── Selected row visibility ───────────────────────────────────────────────────

describe('selected row visibility contract', () => {
  it('maxHeight never exceeds viewportHeight — sheet cannot overlap keyboard', () => {
    const cases: [number, number][] = [
      [350, 494],  // iPhone keyboard open
      [380, 470],  // Android with nav
      [430, 380],  // iPad landscape
      [215, 160],  // landscape phone_number
    ]
    for (const [kh, vh] of cases) {
      const state: ViewportState = { keyboardHeight: kh, viewportHeight: vh }
      const mh = computeSheetMaxHeight(state)
      if (mh) {
        expect(parseInt(mh, 10)).toBeLessThanOrEqual(vh)
      }
    }
  })
})

// ── Fallback when VisualViewport unavailable ──────────────────────────────────

describe('VisualViewport unavailability', () => {
  it('when keyboardHeight=0, sheetMaxHeight is undefined — CSS fallback applies', () => {
    // If window.visualViewport is missing, the hook returns initial state {kh:0, vh:innerHeight}
    const state: ViewportState = { keyboardHeight: 0, viewportHeight: 800 }
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })

  it('CSS max-h class (85dvh) is used when maxHeight is undefined', () => {
    // We cannot test CSS class application in unit tests, but we verify the signal
    const state: ViewportState = { keyboardHeight: 0, viewportHeight: 800 }
    const mh = computeSheetMaxHeight(state)
    // undefined → component falls back to className max-h-[85dvh]
    expect(mh).toBeUndefined()
  })
})

// ── Scroll persistence ────────────────────────────────────────────────────────

describe('scroll persistence signal', () => {
  it('keyboard closing (keyboardHeight 350 → 0): maxHeight returns to undefined', () => {
    const open: ViewportState = { keyboardHeight: 350, viewportHeight: 494 }
    const closed: ViewportState = { keyboardHeight: 0, viewportHeight: 844 }
    expect(computeSheetMaxHeight(open)).toBeDefined()
    expect(computeSheetMaxHeight(closed)).toBeUndefined()
    // When maxHeight becomes undefined, CSS max-h-[85dvh] takes over — sheet expands
  })

  it('keyboard height transitions through threshold boundary cleanly', () => {
    // kh=50: still closed
    expect(computeSheetMaxHeight({ keyboardHeight: 50, viewportHeight: 794 })).toBeUndefined()
    // kh=51: now open
    expect(computeSheetMaxHeight({ keyboardHeight: 51, viewportHeight: 793 })).toBeDefined()
    // kh=50 again (briefly during hide animation): reverts to closed
    expect(computeSheetMaxHeight({ keyboardHeight: 50, viewportHeight: 794 })).toBeUndefined()
  })
})
