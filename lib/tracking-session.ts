import { isExperiment } from './experiment'
import { withBasePath } from './base-path'
import {
  createDwell, createHoverTimer, createQueue, isSectionInView, makeId, setActiveTracker,
  FLUSH_MS, HEARTBEAT_MS, SCROLL_THROTTLE_MS,
  type Condition, type Transport,
} from './tracking'

/** Wire the page up for the experiment. Returns a cleanup function; in the
 *  public build it does nothing and returns a no-op. */
export function initTracking({ condition, locale }: { condition: Condition; locale: string }): () => void {
  if (!isExperiment() || typeof window === 'undefined') return () => {}

  const now = () => Date.now()
  const endpoint = withBasePath('/api/log')
  const transport: Transport = {
    post: body =>
      fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
        .then(r => r.ok),
    beacon: body =>
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })),
  }
  const ctx = {
    pid: new URLSearchParams(window.location.search).get('pid') || 'anonymous',
    sessionId: makeId(),
    condition,
    locale,
  }
  const queue = createQueue(ctx, transport, { now, viewport: () => ({ vw: window.innerWidth, vh: window.innerHeight }) })
  const dwell = createDwell(now)
  setActiveTracker({ queue, hover: createHoverTimer(now) })

  const startedAt = now()
  const depth = () => {
    const h = document.documentElement.scrollHeight
    return h > 0 ? Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100)) : 0
  }
  let maxDepthPct = depth()
  let lastScroll = 0
  let ended = false

  queue.push('session_start', { ua: navigator.userAgent, path: window.location.pathname })

  const onScroll = () => {
    maxDepthPct = Math.max(maxDepthPct, depth())
    const t = now()
    if (t - lastScroll < SCROLL_THROTTLE_MS) return
    lastScroll = t
    queue.push('scroll', { y: Math.round(window.scrollY), maxDepthPct })
  }
  const onVisibility = () => {
    const visible = document.visibilityState === 'visible'
    for (const s of dwell.setPageVisible(visible)) queue.push('section_dwell', { section: s.id, ms: s.ms })
    queue.push('visibility', { state: visible ? 'visible' : 'hidden' })
    if (!visible) queue.flushBeacon()
  }
  const onPageHide = () => {
    if (ended) return
    ended = true
    queue.push('session_end', { ms: now() - startedAt, dwell: dwell.totals(), maxDepthPct })
    queue.flushBeacon()
  }
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href]')
    if (a) queue.push('link', { href: a.getAttribute('href') })
  }

  // Section activity is recomputed from geometry on every scroll frame and resize, so
  // dwell stays accurate however tall a section is (independent of the scroll-event throttle).
  const evaluateSections = () => {
    const vh = window.innerHeight
    document.querySelectorAll<HTMLElement>('[data-track-section]').forEach(el => {
      const id = el.dataset.trackSection
      if (!id) return
      const { top, bottom } = el.getBoundingClientRect()
      const activeNow = isSectionInView(top, bottom, vh)
      const ms = dwell.setInView(id, activeNow)
      if (!activeNow && ms > 0) queue.push('section_dwell', { section: id, ms })
    })
  }
  let frame = 0
  const onScrollFrame = () => {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      evaluateSections()
    })
  }
  evaluateSections()

  const flushTimer = window.setInterval(() => void queue.flush(), FLUSH_MS)
  const heartbeatTimer = window.setInterval(
    () => queue.push('heartbeat', { ms: now() - startedAt, dwell: dwell.totals(), maxDepthPct }),
    HEARTBEAT_MS,
  )
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('scroll', onScrollFrame, { passive: true })
  window.addEventListener('resize', evaluateSections)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('click', onClick, true)

  return () => {
    if (frame) window.cancelAnimationFrame(frame)
    window.removeEventListener('scroll', onScrollFrame)
    window.removeEventListener('resize', evaluateSections)
    window.clearInterval(flushTimer)
    window.clearInterval(heartbeatTimer)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('click', onClick, true)
    setActiveTracker(null)
  }
}
