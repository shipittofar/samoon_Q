/** Walk ancestors for an overflow scrollport; otherwise use the window. */
export function findScrollableAncestor(start: HTMLElement | null): HTMLElement | Window {
  let el: HTMLElement | null = start
  while (el) {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null
    const overflowY = style?.overflowY ?? ''
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
    if (canScroll && el.scrollHeight > el.clientHeight + 1) {
      return el
    }
    el = el.parentElement
  }
  return typeof window !== 'undefined' ? window : (start as HTMLElement)
}

/** Reset the wizard (or page) to the top after step changes. */
export function scrollWizardToTop(start: HTMLElement | null): void {
  const target = findScrollableAncestor(start)
  if (target === window) {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    return
  }
  ;(target as HTMLElement).scrollTop = 0
}
