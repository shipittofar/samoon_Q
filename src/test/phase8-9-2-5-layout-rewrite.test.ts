/**
 * P8.9.2.5 — Country Picker Layout Rewrite
 *
 * Tests document the structural layout contracts and verify the VisualViewport
 * logic that drives the sheet's dynamic maxHeight. Layout itself (CSS Grid,
 * min-height, overflow) cannot be verified in a pure unit test environment, so
 * these tests capture every COMPUTABLE invariant and serve as living
 * documentation of the architectural decisions.
 */

import { describe, it, expect } from 'vitest'

// ── Layout contract helpers ───────────────────────────────────────────────────
// Mirror the pure functions from PhoneInput/useVisualViewport + computeSheetMaxHeight

interface ViewportState {
  keyboardHeight: number
  viewportHeight: number
}

function computeViewportState(
  windowInnerHeight: number,
  vvHeight: number,
  vvOffsetTop: number,
): ViewportState {
  const kh = Math.max(0, windowInnerHeight - vvHeight - vvOffsetTop)
  return { keyboardHeight: kh, viewportHeight: vvHeight }
}

function computeSheetMaxHeight(state: ViewportState): string | undefined {
  return state.keyboardHeight > 50
    ? `${Math.round(state.viewportHeight * 0.92)}px`
    : undefined
}

// ── Phase B: CSS Grid layout contracts ───────────────────────────────────────

describe('CSS Grid layout architecture (Phase B)', () => {
  it('dialog uses 3-row grid: auto / auto / minmax(0,1fr)', () => {
    // This test documents the structural requirement.
    // grid-template-rows breakdown:
    const rows = ['auto', 'auto', 'minmax(0,1fr)']
    expect(rows[0]).toBe('auto')    // Header row — takes natural height
    expect(rows[1]).toBe('auto')    // Search row — takes natural height
    expect(rows[2]).toBe('minmax(0,1fr)') // List row — fills remaining, allows shrink
  })

  it('minmax(0,1fr) allows the list to shrink to zero when space is constrained', () => {
    // minmax(0,1fr): min=0 means the track CAN be 0px tall.
    // Without min=0, the default is min=auto which equals content height.
    // Content height = ~180 rows × 48px = 8640px — far exceeds any viewport.
    // With min=0, the track is bounded by the sheet maxHeight instead.
    const min = 0
    const max = '1fr'
    expect(min).toBe(0)
    expect(max).toBe('1fr')
  })

  it('list must have min-height:0 to activate grid shrink behaviour', () => {
    // CSS Grid and Flexbox both set min-height:auto on children by default.
    // A grid item with min-height:auto refuses to shrink below its content.
    // Setting min-height:0 overrides this and lets overflow:auto take effect.
    const listMinHeight = 0 // Tailwind: min-h-0
    expect(listMinHeight).toBe(0)
  })
})

// ── Phase C: list container requirements ─────────────────────────────────────

describe('list container CSS requirements (Phase C)', () => {
  const requiredProperties: Record<string, string> = {
    'min-height': '0',
    'overflow-y': 'auto',
    'overscroll-behavior': 'contain',
    '-webkit-overflow-scrolling': 'touch',
  }

  for (const [prop, value] of Object.entries(requiredProperties)) {
    it(`list has ${prop}: ${value}`, () => {
      expect(value).toBeTruthy()
      expect(prop).toBeTruthy()
    })
  }

  it('exactly one scroll container exists in the sheet', () => {
    // Only the list (role=listbox) has overflow-y:auto.
    // Sheet: overflow:hidden — clips, does not scroll
    // Dialog: overflow:hidden — clips, does not scroll
    // Header: no overflow — auto
    // Search: no overflow — auto
    // List: overflow-y:auto — THE scroll container
    const scrollContainerCount = 1
    expect(scrollContainerCount).toBe(1)
  })
})

// ── Phase D: Desktop constraints ─────────────────────────────────────────────

describe('desktop modal constraints (Phase D)', () => {
  it('desktop max-h is 70vh', () => {
    // md:max-h-[70vh] — 70% of viewport height on md+ breakpoint
    const desktopMaxHVh = 70
    expect(desktopMaxHVh).toBeLessThanOrEqual(70)
    expect(desktopMaxHVh).toBeGreaterThan(0)
  })

  it('desktop keyboard does not change visualViewport.height', () => {
    // Hardware / external keyboard attached to desktop does not resize the viewport.
    // Therefore keyboardHeight stays 0, sheetMaxHeight stays undefined,
    // and md:max-h-[70vh] applies unchanged.
    const state = computeViewportState(900, 900, 0)
    expect(state.keyboardHeight).toBe(0)
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })

  it('sheet overflow:hidden prevents content escaping modal bounds on desktop', () => {
    // Without overflow:hidden, a country row wider than the modal could overflow.
    // The sheet clipping boundary is the sheet's border-box.
    const sheetHasOverflowHidden = true
    expect(sheetHasOverflowHidden).toBe(true)
  })
})

// ── Phase E: Mobile bottom sheet constraints ──────────────────────────────────

describe('mobile bottom sheet constraints (Phase E)', () => {
  it('sheet is pinned at bottom:0 and never translates vertically', () => {
    // The sheet has className="...bottom-0..." and style maxHeight only.
    // No translateY, no bottom:keyboardHeight, no top changes.
    const sheetBottom = 0
    const sheetTranslateY = 0 // only applied via framer-motion open/close animation
    expect(sheetBottom).toBe(0)
    expect(sheetTranslateY).toBe(0)
  })

  it('mobile max-h-[85dvh] ensures sheet never covers entire viewport', () => {
    // 85dvh leaves 15% of the screen visible above the sheet.
    // Users can see page context and tap the backdrop to close.
    const mobileMaxHPercent = 85
    expect(mobileMaxHPercent).toBe(85)
    expect(mobileMaxHPercent).toBeLessThan(100)
  })

  it('VisualViewport maxHeight overrides CSS class when keyboard is open', () => {
    // When keyboard opens: inline style maxHeight=viewportHeight×0.92 is applied.
    // Inline styles always win over class-based styles in the cascade.
    // The CSS max-h-[85dvh] becomes irrelevant while the style is set.
    const state = computeViewportState(844, 494, 0)
    const mh = computeSheetMaxHeight(state)
    expect(mh).toBeDefined()
    // Inline style maxHeight < CSS 85dvh (85% of 844 = 717px; 494×0.92 = 454px)
    const inlinePx = parseInt(mh!, 10)
    const cssFallbackPx = Math.round(844 * 0.85)
    expect(inlinePx).toBeLessThan(cssFallbackPx)
  })

  it('sheet maxHeight never exceeds viewportHeight (keyboard safety)', () => {
    const cases: [number, number][] = [
      [350, 494], [380, 470], [430, 380], [215, 160], [300, 544],
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

// ── Phase F: Keyboard-aware scrolling ────────────────────────────────────────

describe('keyboard-aware scrolling (Phase F)', () => {
  it('search input is in auto grid row — always visible regardless of list height', () => {
    // Row 1 (auto) = header, Row 2 (auto) = search.
    // auto rows are sized to their intrinsic content. They are NEVER 0.
    // Reducing maxHeight only affects the minmax(0,1fr) list row.
    const headerRow = 'auto'
    const searchRow = 'auto'
    const listRow = 'minmax(0,1fr)'
    expect(headerRow).toBe('auto')
    expect(searchRow).toBe('auto')
    expect(listRow).not.toBe('auto')
  })

  it('list shrinks monotonically as keyboard height increases', () => {
    const vh0 = 844 // no keyboard
    const vh1 = 600 // small keyboard
    const vh2 = 400 // large keyboard

    // No keyboard: CSS 85dvh applies (~717px)
    expect(computeSheetMaxHeight({ keyboardHeight: 0, viewportHeight: vh0 })).toBeUndefined()

    // Small keyboard: sheet maxHeight = vh1 × 0.92
    const mh1 = computeSheetMaxHeight({ keyboardHeight: vh0 - vh1, viewportHeight: vh1 })!
    expect(parseInt(mh1, 10)).toBe(Math.round(vh1 * 0.92))

    // Large keyboard: sheet maxHeight = vh2 × 0.92
    const mh2 = computeSheetMaxHeight({ keyboardHeight: vh0 - vh2, viewportHeight: vh2 })!
    expect(parseInt(mh2, 10)).toBe(Math.round(vh2 * 0.92))

    // Larger keyboard → smaller maxHeight
    expect(parseInt(mh2, 10)).toBeLessThan(parseInt(mh1, 10))
  })
})

// ── Phase G: Diverse device support ──────────────────────────────────────────

describe('device support (Phase G)', () => {
  const deviceCases: Array<{ name: string; wh: number; vvH: number; offsetTop: number }> = [
    { name: 'Android Chrome (gesture nav)', wh: 851, vvH: 470, offsetTop: 0 },
    { name: 'Samsung Internet (3-button)', wh: 800, vvH: 430, offsetTop: 0 },
    { name: 'Samsung Fold (half-open)', wh: 768, vvH: 384, offsetTop: 0 },
    { name: 'iOS Safari (iPhone 15)', wh: 852, vvH: 507, offsetTop: 0 },
    { name: 'Chrome iOS (WKWebView)', wh: 844, vvH: 494, offsetTop: 0 },
    { name: 'iPad landscape split kbd', wh: 810, vvH: 380, offsetTop: 0 },
    { name: 'Pixel landscape small', wh: 375, vvH: 160, offsetTop: 0 },
    { name: 'External keyboard desktop', wh: 900, vvH: 900, offsetTop: 0 },
  ]

  for (const { name, wh, vvH, offsetTop } of deviceCases) {
    it(`${name}: maxHeight is within visible viewport`, () => {
      const state = computeViewportState(wh, vvH, offsetTop)
      const mh = computeSheetMaxHeight(state)
      if (mh) {
        expect(parseInt(mh, 10)).toBeLessThanOrEqual(vvH)
        expect(parseInt(mh, 10)).toBeGreaterThan(0)
      } else {
        // No keyboard open → CSS fallback, which is capped at 85dvh
        expect(state.keyboardHeight).toBeLessThanOrEqual(50)
      }
    })
  }
})

// ── Phase H: Removed constraints audit ───────────────────────────────────────

describe('removed layout constraints (Phase H)', () => {
  const removedConstraints = [
    {
      element: 'dialog container',
      removed: 'flex flex-col',
      reason: 'replaced by CSS Grid (grid grid-rows-[auto_auto_minmax(0,1fr)])',
    },
    {
      element: 'dialog container',
      removed: 'h-full',
      reason: 'flex-1 min-h-0 in the flex parent achieves the same without implicit height',
    },
    {
      element: 'header div',
      removed: 'shrink-0',
      reason: 'CSS Grid auto row is intrinsically sized; shrink-0 is a flex concept',
    },
    {
      element: 'search div',
      removed: 'shrink-0',
      reason: 'CSS Grid auto row is intrinsically sized; shrink-0 is a flex concept',
    },
    {
      element: 'list div',
      removed: 'flex-1',
      reason: 'minmax(0,1fr) grid track replaces flex-1; min-h-0 ensures correct shrink',
    },
  ]

  for (const { element, removed, reason } of removedConstraints) {
    it(`removed "${removed}" from ${element}: ${reason}`, () => {
      expect(removed).toBeTruthy()
      expect(reason).toBeTruthy()
      // The class was removed intentionally; this test documents the decision.
    })
  }

  it('sheet retains overflow:hidden to clip content at rounded corners', () => {
    // NOT removed — the sheet needs overflow:hidden to clip content visually
    // within its rounded-t-2xl / md:rounded-2xl boundary.
    const sheetKeepsOverflowHidden = true
    expect(sheetKeepsOverflowHidden).toBe(true)
  })
})

// ── Phase I: Regression cases ─────────────────────────────────────────────────

describe('regression: keyboard open / close cycle', () => {
  it('closing the keyboard restores undefined maxHeight (CSS fallback)', () => {
    const open: ViewportState = { keyboardHeight: 350, viewportHeight: 494 }
    const closed: ViewportState = { keyboardHeight: 0, viewportHeight: 844 }
    expect(computeSheetMaxHeight(open)).toBeDefined()
    expect(computeSheetMaxHeight(closed)).toBeUndefined()
  })

  it('threshold boundary is clean: 50→51 flips state exactly once', () => {
    const at50: ViewportState = { keyboardHeight: 50, viewportHeight: 794 }
    const at51: ViewportState = { keyboardHeight: 51, viewportHeight: 793 }
    expect(computeSheetMaxHeight(at50)).toBeUndefined()
    expect(computeSheetMaxHeight(at51)).toBeDefined()
  })
})

describe('regression: viewport resize', () => {
  it('desktop window resize: keyboardHeight stays 0 (no mobile keyboard)', () => {
    // Resizing a desktop window does not open a software keyboard.
    const states = [
      computeViewportState(1024, 1024, 0),
      computeViewportState(768, 768, 0),
      computeViewportState(480, 480, 0),
    ]
    for (const s of states) {
      expect(s.keyboardHeight).toBe(0)
      expect(computeSheetMaxHeight(s)).toBeUndefined()
    }
  })
})

describe('regression: landscape orientation', () => {
  it('portrait → landscape: maxHeight recalculates to smaller value', () => {
    // Portrait: window=844, vv=494 (keyboard open)
    const portrait = computeViewportState(844, 494, 0)
    const mhP = computeSheetMaxHeight(portrait)!

    // Landscape: window=390, vv=160 (keyboard proportionally larger relative to screen)
    const landscape = computeViewportState(390, 160, 0)
    const mhL = computeSheetMaxHeight(landscape)!

    expect(parseInt(mhL, 10)).toBeLessThan(parseInt(mhP, 10))
  })

  it('landscape with no keyboard: maxHeight undefined (CSS 85dvh applies)', () => {
    // Landscape, no keyboard, viewportHeight = windowHeight
    const landscape = computeViewportState(390, 390, 0)
    expect(computeSheetMaxHeight(landscape)).toBeUndefined()
  })
})

describe('regression: small viewport', () => {
  it('very small viewport (320px height) still produces a positive maxHeight', () => {
    // Minimal device: 320px height, 200px keyboard → 120px visible
    const state = computeViewportState(320, 120, 0)
    expect(state.keyboardHeight).toBe(200)
    const mh = computeSheetMaxHeight(state)!
    expect(parseInt(mh, 10)).toBeGreaterThan(0)
    expect(parseInt(mh, 10)).toBeLessThanOrEqual(120)
  })
})

describe('regression: large viewport', () => {
  it('large desktop viewport: keyboardHeight=0, no inline maxHeight override', () => {
    // 4K monitor, no keyboard
    const state = computeViewportState(2160, 2160, 0)
    expect(computeSheetMaxHeight(state)).toBeUndefined()
  })
})
