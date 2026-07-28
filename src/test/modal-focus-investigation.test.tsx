/**
 * Modal focus regression — inline onClose + parent re-render must not steal focus.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

// jsdom reports offsetParent as null for most nodes; Modal filters those out.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement
    },
  })
})

/** Mirrors console/menu/page.tsx — form state and modal in the same parent. */
function InlineOnCloseParent() {
  const [value, setValue] = useState('')
  return (
    <Modal open onClose={() => {}} title="Add item">
      <input
        data-testid="menu-field"
        aria-label="Item name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Modal>
  )
}

async function flushFocusRaf() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

describe('Modal focus regression', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps input focused while typing with inline onClose (parent re-renders each keystroke)', async () => {
    const user = userEvent.setup()

    render(<InlineOnCloseParent />)
    await flushFocusRaf()

    const input = screen.getByTestId('menu-field')
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    await user.click(input)

    await user.type(input, 'abc')
    await flushFocusRaf()

    expect(document.activeElement).toBe(input)
    expect(document.activeElement).not.toBe(closeBtn)
  })

  it('Escape calls the latest onClose after handler identity changes (ref, not stale closure)', async () => {
    const onCloseV1 = vi.fn()
    const onCloseV2 = vi.fn()

    function Parent() {
      const [useV2, setUseV2] = useState(false)
      const onClose = useV2 ? onCloseV2 : onCloseV1
      return (
        <>
          <button type="button" data-testid="swap-close" onClick={() => setUseV2(true)}>
            swap
          </button>
          <Modal open onClose={onClose} title="Escape test">
            <input data-testid="field" />
          </Modal>
        </>
      )
    }

    render(<Parent />)
    await flushFocusRaf()

    fireEvent.click(screen.getByTestId('swap-close'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCloseV2).toHaveBeenCalledTimes(1)
    expect(onCloseV1).not.toHaveBeenCalled()
  })
})
