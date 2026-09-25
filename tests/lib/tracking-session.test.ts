import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initTracking } from '@/lib/tracking-session'
import { track } from '@/lib/tracking'

let ioCallback: IntersectionObserverCallback | null = null
const observed: Element[] = []

beforeEach(() => {
  observed.length = 0
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { ioCallback = cb }
    observe(el: Element) { observed.push(el) }
    disconnect() {}
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  vi.stubGlobal('Blob', class { constructor(public parts: string[]) {} })
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
  window.history.replaceState({}, '', '/zh/static/?pid=P017')
  document.body.innerHTML = '<section data-track-section="hero"></section><a href="https://unicode.org">u</a>'
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

// sendBeacon receives a Blob; the Blob stub above keeps the JSON string it was built from.
function sentEvents(): Record<string, unknown>[] {
  const calls = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls
  return calls.flatMap(c => JSON.parse((c[1] as unknown as { parts: string[] }).parts[0]))
}

describe('initTracking', () => {
  it('does nothing in the public build', () => {
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    track('x', 'y')
    window.dispatchEvent(new Event('pagehide'))
    expect(fetch).not.toHaveBeenCalled()
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
    expect(observed).toHaveLength(0)
    stop()
  })

  it('records a session in the experiment build', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    expect(observed).toHaveLength(1)

    // jsdom doesn't implement navigation; stop the anchor's default action (after
    // initTracking's own capture-phase listener has already seen the click) so the
    // click doesn't try to navigate and log a "Not implemented" warning.
    document.addEventListener('click', e => e.preventDefault(), true)

    ioCallback!([{ target: observed[0], isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 500 } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    window.dispatchEvent(new Event('pagehide'))

    const events = sentEvents()
    const types = events.map(e => e.type)
    expect(types).toEqual(expect.arrayContaining(['session_start', 'link', 'session_end']))
    for (const e of events) expect(e).toMatchObject({ pid: 'P017', condition: 'static', locale: 'zh' })
    expect(events.find(e => e.type === 'link')).toMatchObject({ href: 'https://unicode.org' })
    expect(events.find(e => e.type === 'session_end')!.dwell).toHaveProperty('hero')
    stop()
  })
})
