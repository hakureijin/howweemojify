import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initTracking } from '@/lib/tracking-session'
import { track, FLUSH_THRESHOLD } from '@/lib/tracking'

// The section's viewport-relative rect, read by initTracking via getBoundingClientRect.
let rect = { top: 0, bottom: 500 }
let rafQueue: FrameRequestCallback[] = []
const runFrames = () => { const q = rafQueue; rafQueue = []; q.forEach(cb => cb(0)) }
let clock = 0

beforeEach(() => {
  rect = { top: 0, bottom: 500 }
  rafQueue = []
  clock = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => { rafQueue = [] })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  vi.stubGlobal('Blob', class { constructor(public parts: string[]) {} })
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 650, configurable: true })
  window.history.replaceState({}, '', '/zh/static/?pid=P017')
  document.body.innerHTML = '<section data-track-section="hero"></section><a href="https://unicode.org">u</a>'
  const section = document.querySelector('section')!
  section.getBoundingClientRect = vi.fn(() => ({ ...rect, height: rect.bottom - rect.top }) as DOMRect)
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

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
    expect(document.querySelector('section')!.getBoundingClientRect).not.toHaveBeenCalled()
    stop()
  })

  it('records a session in the experiment build', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    const stop = initTracking({ condition: 'static', locale: 'zh' })

    // jsdom doesn't implement navigation; stop the anchor's default action (after
    // initTracking's own capture-phase listener has already seen the click) so the
    // click doesn't try to navigate and log a "Not implemented" warning.
    document.addEventListener('click', e => e.preventDefault(), true)

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

  it('records dwell for a section taller than several viewports, from its geometry', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    rect = { top: -1200, bottom: 2200 } // 3,400 px section filling the whole 650 px viewport
    const stop = initTracking({ condition: 'static', locale: 'zh' })

    clock += 4000
    rect = { top: -3300, bottom: 100 } // only 100 px left at the top edge
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll')) // rAF-throttled: one pass per frame
    expect(rafQueue).toHaveLength(1)
    runFrames()

    clock += 1000
    rect = { top: 0, bottom: 3400 } // back in view after a resize
    window.dispatchEvent(new Event('resize'))
    clock += 2000
    window.dispatchEvent(new Event('pagehide'))

    const events = sentEvents()
    expect(events.filter(e => e.type === 'section_dwell')).toEqual([expect.objectContaining({ section: 'hero', ms: 4000 })])
    expect(events.find(e => e.type === 'session_end')!.dwell).toEqual({ hero: 6000 })
    stop()
    window.dispatchEvent(new Event('scroll'))
    expect(rafQueue).toHaveLength(0)
  })

  it.each([
    [400, true],
    [413, true],
    [500, false],
    [503, false],
  ])('a %i response counts as delivered: %s', async (status, delivered) => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status })))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    for (let i = 1; i < FLUSH_THRESHOLD; i++) track('x', 'y') // + session_start = auto-flush
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await new Promise(r => setTimeout(r, 0)) // let the queue settle the response

    window.dispatchEvent(new Event('pagehide'))
    // Everything sent after the first post: later posts plus beacons.
    const laterPosts = (fetch as ReturnType<typeof vi.fn>).mock.calls.slice(1)
      .flatMap(c => JSON.parse((c[1] as RequestInit).body as string) as Record<string, unknown>[])
    const resent = [...laterPosts, ...sentEvents()].filter(e => e.type === 'interact')
    expect(resent).toHaveLength(delivered ? 0 : FLUSH_THRESHOLD - 1)
    if (delivered) expect(warn).toHaveBeenCalledWith('[tracking] server rejected batch', status)
    else expect(warn).not.toHaveBeenCalled()
    stop()
  })

  it('brackets a session restored from the bfcache with a resumed session_start', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    const pageshow = (persisted: boolean) =>
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))

    pageshow(false) // an ordinary load is not a resume
    window.dispatchEvent(new Event('pagehide'))
    pageshow(true)
    track('x', 'after-restore')
    window.dispatchEvent(new Event('pagehide'))

    const types = sentEvents().map(e => e.type)
    expect(types).toEqual(['session_start', 'session_end', 'session_start', 'interact', 'session_end'])
    expect(sentEvents()[0]).not.toHaveProperty('resumed')
    expect(sentEvents()[2]).toMatchObject({ type: 'session_start', resumed: true })
    stop()
  })
})
