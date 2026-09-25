import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createQueue, createDwell, createHoverTimer, isSectionActive, makeId,
  setActiveTracker, track, hoverStart, hoverEnd,
  FLUSH_THRESHOLD, MAX_BATCH, MAX_QUEUE, type Transport,
} from '@/lib/tracking'

const ctx = { pid: 'P1', sessionId: 's', condition: 'static' as const, locale: 'zh' }
const env = (clock = { t: 0 }) => ({ now: () => clock.t, viewport: () => ({ vw: 1440, vh: 900 }) })

function fakeTransport(results: boolean[] = []) {
  const posts: unknown[][] = []
  const beacons: unknown[][] = []
  const t: Transport = {
    post: vi.fn(async (body: string) => { posts.push(JSON.parse(body)); return results.length ? results.shift()! : true }),
    beacon: vi.fn((body: string) => { beacons.push(JSON.parse(body)); return true }),
  }
  return { t, posts, beacons }
}

afterEach(() => setActiveTracker(null))

describe('makeId', () => {
  it('works without crypto.randomUUID (plain-http LAN pages)', () => {
    const id = makeId(buf => buf.fill(171))
    expect(id).toBe('ab'.repeat(16))
  })
  it('defaults to crypto.getRandomValues', () => {
    expect(makeId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('createQueue', () => {
  it('stamps context, viewport, time and a sequence number', () => {
    const { t } = fakeTransport()
    const q = createQueue(ctx, t, env({ t: 42 }))
    q.push('scroll', { y: 10 })
    q.flushBeacon()
    const [ev] = (t.beacon as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]))[0]
    expect(ev).toMatchObject({ pid: 'P1', condition: 'static', locale: 'zh', vw: 1440, vh: 900, type: 'scroll', t: 42, y: 10, seq: 1 })
  })

  it('auto-flushes at the threshold', async () => {
    const { t, posts } = fakeTransport()
    const q = createQueue(ctx, t, env())
    for (let i = 0; i < FLUSH_THRESHOLD; i++) q.push('e')
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(q.size()).toBe(0)
  })

  it('keeps events when the collector is down and sends them later', async () => {
    const { t, posts } = fakeTransport([false, true])
    const q = createQueue(ctx, t, env())
    q.push('a'); q.push('b')
    await q.flush()
    expect(q.size()).toBe(2)
    q.push('c')
    await q.flush()
    expect(q.size()).toBe(0)
    expect(posts[1].map(e => (e as { type: string }).type)).toEqual(['a', 'b', 'c'])
  })

  it('does not drop events pushed while a post is in flight', async () => {
    let release!: (ok: boolean) => void
    const t: Transport = { post: () => new Promise(r => { release = r }), beacon: () => true }
    const q = createQueue(ctx, t, env())
    q.push('a')
    const p = q.flush()
    q.push('b')
    release(true)
    await p
    expect(q.size()).toBe(1)
  })

  it('sends at most MAX_BATCH per request and caps the queue', () => {
    const { t, beacons } = fakeTransport()
    const q = createQueue(ctx, { ...t, post: async () => false }, env())
    for (let i = 0; i < MAX_QUEUE + 10; i++) q.push('e')
    expect(q.size()).toBe(MAX_QUEUE)
    q.flushBeacon()
    expect(beacons.every(b => b.length <= MAX_BATCH)).toBe(true)
    expect(beacons.flat()).toHaveLength(MAX_QUEUE)
    expect((beacons[0][0] as { seq: number }).seq).toBe(11)
  })
})

describe('createDwell', () => {
  it('accumulates visible time per section and excludes hidden-tab time', () => {
    const clock = { t: 0 }
    const d = createDwell(() => clock.t)
    d.setInView('hero', true)
    clock.t = 1000
    expect(d.setPageVisible(false)).toEqual([{ id: 'hero', ms: 1000 }])
    clock.t = 5000
    d.setPageVisible(true)
    clock.t = 5500
    expect(d.setInView('hero', false)).toBe(500)
    expect(d.totals()).toEqual({ hero: 1500 })
  })
  it('totals include the running stint', () => {
    const clock = { t: 0 }
    const d = createDwell(() => clock.t)
    d.setInView('ch02-map', true)
    clock.t = 300
    expect(d.totals()).toEqual({ 'ch02-map': 300 })
  })
})

describe('isSectionActive', () => {
  it('accepts half the section visible', () => expect(isSectionActive(0.5, 100, 900)).toBe(true))
  it('accepts a tall section filling half the viewport', () => expect(isSectionActive(0.2, 450, 900)).toBe(true))
  it('rejects a sliver', () => expect(isSectionActive(0.1, 90, 900)).toBe(false))
})

describe('hover timer and singleton', () => {
  it('only reports hovers of at least 300 ms', () => {
    const clock = { t: 0 }
    const h = createHoverTimer(() => clock.t)
    h.start('k'); clock.t = 299
    expect(h.end('k')).toBeNull()
    h.start('k'); clock.t = 700
    expect(h.end('k')).toBe(401)
  })

  it('track/hover are no-ops until a tracker is active', () => {
    expect(() => { track('map', 'zoom', 2); hoverStart('map', 'x'); hoverEnd('map', 'x') }).not.toThrow()
  })

  it('routes interact events to the active tracker', () => {
    const clock = { t: 0 }
    const { t } = fakeTransport()
    const queue = createQueue(ctx, t, env(clock))
    setActiveTracker({ queue, hover: createHoverTimer(() => clock.t) })
    track('cumulative', 'range', 'since-2015')
    hoverStart('map', 'sushi-jp'); clock.t = 500; hoverEnd('map', 'sushi-jp')
    queue.flushBeacon()
    const events = (t.beacon as ReturnType<typeof vi.fn>).mock.calls.flatMap(c => JSON.parse(c[0]))
    expect(events).toMatchObject([
      { type: 'interact', target: 'cumulative', action: 'range', detail: 'since-2015' },
      { type: 'interact', target: 'map', action: 'hover', detail: 'sushi-jp', ms: 500 },
    ])
  })
})
