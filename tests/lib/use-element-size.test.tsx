import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef, type RefObject } from 'react'
import { useElementSize } from '@/lib/use-element-size'

function stubResizeObserver(onDisconnect: () => void, onObserve: (el: Element) => void) {
  class StubResizeObserver {
    observe(el: Element) { onObserve(el) }
    unobserve() {}
    disconnect() { onDisconnect() }
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
}

function measuredDiv(width: number, height: number): HTMLElement {
  const div = document.createElement('div')
  div.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => {},
  })
  return div
}

afterEach(() => { vi.unstubAllGlobals() })

describe('useElementSize', () => {
  it('returns the initial measured size', () => {
    let observed: Element | null = null
    stubResizeObserver(() => {}, el => { observed = el })
    const ref: RefObject<HTMLElement | null> = { current: measuredDiv(320, 240) }
    const { result, unmount } = renderHook(() => useElementSize(ref))
    expect(result.current).toEqual({ vw: 320, vh: 240 })
    expect(observed).not.toBeNull()
    unmount()
  })

  it('disconnects the observer on unmount', () => {
    let disconnectCalls = 0
    stubResizeObserver(() => { disconnectCalls += 1 }, () => {})
    const ref: RefObject<HTMLElement | null> = { current: measuredDiv(100, 50) }
    const { unmount } = renderHook(() => useElementSize(ref))
    expect(disconnectCalls).toBe(0)
    unmount()
    expect(disconnectCalls).toBe(1)
  })

  it('returns null when the ref has no element yet', () => {
    stubResizeObserver(() => {}, () => {})
    const { result, unmount } = renderHook(() => useElementSize(useRef<HTMLElement | null>(null)))
    expect(result.current).toBeNull()
    unmount()
  })
})
