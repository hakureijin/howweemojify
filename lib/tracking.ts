export type Condition = 'interactive' | 'static'

export interface SessionContext {
  pid: string
  sessionId: string
  condition: Condition
  locale: string
}

export interface Transport {
  post(body: string): Promise<boolean>
  beacon(body: string): boolean
}

type Payload = Record<string, unknown>

export const MAX_BATCH = 50 // well under the server's 100-event / 64 KB limit
export const MAX_BATCH_BYTES = 60_000 // bytes; leaves headroom under the server's 64 KB limit
export const FLUSH_THRESHOLD = 20
export const FLUSH_MS = 5000
export const HEARTBEAT_MS = 15000
export const MAX_QUEUE = 500
export const HOVER_MIN_MS = 300
export const SCROLL_THROTTLE_MS = 500

/** 128-bit hex id. Uses getRandomValues, not randomUUID: the latter only exists
 *  in secure contexts, and lab machines open the page over plain http on a LAN IP. */
export function makeId(fill: (buf: Uint8Array) => Uint8Array = buf => crypto.getRandomValues(buf)): string {
  return Array.from(fill(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
}

export interface EventQueue {
  push(type: string, payload?: Payload): void
  flush(): Promise<void>
  flushBeacon(): void
  size(): number
}

export function createQueue(
  ctx: SessionContext,
  transport: Transport,
  env: { now: () => number; viewport: () => { vw: number; vh: number } },
): EventQueue {
  let queue: Payload[] = []
  let seq = 0
  let inflight = false
  // The highest seq owned by flush()'s outstanding POST, valid only while `inflight` is
  // true. flushBeacon must not resend those events (they may still be acknowledged by the
  // in-flight request) — it only drains events past this point.
  let inflightLastSeq = 0

  /** Drops (and warns about) any queued event that alone exceeds MAX_BATCH_BYTES — it could
   *  never be delivered in any batch, and must not block the queue forever — then returns up
   *  to MAX_BATCH events, matching `eligible`, from the front of the queue whose combined
   *  JSON size stays within MAX_BATCH_BYTES. Shared by flush() and flushBeacon(). */
  const selectBatch = (eligible: (e: Payload) => boolean = () => true): Payload[] => {
    queue = queue.filter(e => {
      if (JSON.stringify(e).length > MAX_BATCH_BYTES) {
        console.warn('[tracking] dropped oversized event', e.type, e.seq)
        return false
      }
      return true
    })
    const batch: Payload[] = []
    for (const e of queue) {
      if (!eligible(e)) continue
      if (batch.length >= MAX_BATCH) break
      if (JSON.stringify([...batch, e]).length > MAX_BATCH_BYTES) break
      batch.push(e)
    }
    return batch
  }

  const flush = async () => {
    if (inflight || queue.length === 0) return
    const batch = selectBatch()
    if (batch.length === 0) return
    const lastSeq = batch[batch.length - 1].seq as number
    inflight = true
    inflightLastSeq = lastSeq
    let ok = false
    try {
      ok = await transport.post(JSON.stringify(batch))
    } catch {
      ok = false
    }
    inflight = false
    // Acknowledge by sequence number, not position: events may have been
    // pushed (or the oldest trimmed) while the request was in flight.
    if (ok) queue = queue.filter(e => (e.seq as number) > lastSeq)
  }

  return {
    push(type, payload = {}) {
      seq += 1
      queue.push({ ...payload, ...ctx, ...env.viewport(), type, t: env.now(), seq })
      if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE)
      if (queue.length >= FLUSH_THRESHOLD) void flush()
    },
    flush,
    flushBeacon() {
      while (true) {
        const batch = selectBatch(inflight ? e => (e.seq as number) > inflightLastSeq : undefined)
        if (batch.length === 0) break
        if (!transport.beacon(JSON.stringify(batch))) break
        const sent = new Set(batch.map(e => e.seq))
        queue = queue.filter(e => !sent.has(e.seq as number))
      }
    },
    size: () => queue.length,
  }
}

/** Per-section visible time. A section only accrues time while it is in view
 *  AND the tab is visible. */
export function createDwell(now: () => number) {
  const inView = new Set<string>()
  const since = new Map<string, number>()
  const totals: Record<string, number> = {}
  let pageVisible = true

  const stop = (id: string): number => {
    const s = since.get(id)
    if (s === undefined) return 0
    since.delete(id)
    const ms = now() - s
    totals[id] = (totals[id] ?? 0) + ms
    return ms
  }

  return {
    /** Returns the length of the stint that just ended (0 when entering). */
    setInView(id: string, visible: boolean): number {
      if (visible) {
        inView.add(id)
        if (pageVisible && !since.has(id)) since.set(id, now())
        return 0
      }
      inView.delete(id)
      return stop(id)
    },
    /** Returns the stints closed by the tab going hidden. */
    setPageVisible(visible: boolean): { id: string; ms: number }[] {
      pageVisible = visible
      if (visible) {
        for (const id of inView) if (!since.has(id)) since.set(id, now())
        return []
      }
      return [...since.keys()].map(id => ({ id, ms: stop(id) }))
    },
    totals(): Record<string, number> {
      const out = { ...totals }
      for (const [id, s] of since) out[id] = (out[id] ?? 0) + now() - s
      return out
    },
  }
}

/** A section counts as "being read" when half of it is visible, or — for
 *  sections taller than the screen, which never reach ratio 0.5 — when it
 *  fills at least half the viewport. */
export function isSectionActive(ratio: number, rectHeight: number, viewportHeight: number): boolean {
  return ratio >= 0.5 || rectHeight >= viewportHeight * 0.5
}

export function createHoverTimer(now: () => number) {
  const starts = new Map<string, number>()
  return {
    start(key: string) {
      starts.set(key, now())
    },
    /** Duration if the hover was long enough to count, else null. */
    end(key: string): number | null {
      const s = starts.get(key)
      if (s === undefined) return null
      starts.delete(key)
      const ms = now() - s
      return ms >= HOVER_MIN_MS ? ms : null
    },
  }
}

interface ActiveTracker {
  queue: EventQueue
  hover: ReturnType<typeof createHoverTimer>
}

let active: ActiveTracker | null = null

export function setActiveTracker(tracker: ActiveTracker | null) {
  active = tracker
}

/** Record a deliberate interaction. No-op outside the experiment build. */
export function track(target: string, action: string, detail?: unknown) {
  active?.queue.push('interact', { target, action, detail })
}

export function hoverStart(target: string, detail: unknown) {
  active?.hover.start(`${target}::${String(detail)}`)
}

export function hoverEnd(target: string, detail: unknown) {
  if (!active) return
  const ms = active.hover.end(`${target}::${String(detail)}`)
  if (ms !== null) active.queue.push('interact', { target, action: 'hover', detail, ms })
}
