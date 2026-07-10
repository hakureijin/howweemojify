'use client'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { useTranslations } from 'next-intl'
import { withBasePath } from '@/lib/base-path'
import type { OriginPin } from '@/types/chapter-02'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'

const W = 800
const H = 420
const HIT_RADIUS = 22
const MIN_ZOOM = 1
const MAX_ZOOM = 6
const ZOOM_BUTTON_STEP = 1.6
const WHEEL_STEP = 1.15
const PAN_KEY_STEP = 60

interface PlacedPin extends OriginPin {
  cx: number
  cy: number
}

interface ZoomState { k: number; x: number; y: number }
const IDENTITY: ZoomState = { k: 1, x: 0, y: 0 }

export function OriginMap({ pins }: { pins: OriginPin[] }) {
  const t = useTranslations('ch02.map')
  const labelT = useTranslations()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [features, setFeatures] = useState<FeatureCollection<Geometry> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<ZoomState>(IDENTITY)
  const [dragging, setDragging] = useState(false)
  const justDraggedRef = useRef(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  useEffect(() => {
    fetch(withBasePath('/world-atlas/countries-110m.json'))
      .then(r => {
        if (!r.ok) throw new Error(`world-atlas: HTTP ${r.status}`)
        return r.json()
      })
      .then((topo: Topology) => {
        const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<Geometry>
        setFeatures(fc)
      })
      .catch(err => {
        console.error('OriginMap failed to load world atlas', err)
      })
  }, [])

  const projection = useMemo(() => geoEqualEarth().scale(140).translate([W / 2, H / 2]), [])

  const placed: PlacedPin[] = useMemo(() => {
    return pins
      .map(p => {
        const xy = projection([p.lng, p.lat])
        if (!xy) return null
        return { ...p, cx: xy[0], cy: xy[1] }
      })
      .filter((p): p is PlacedPin => p !== null)
  }, [pins, projection])

  const uniqueCountries = useMemo(() => new Set(pins.map(p => p.country)).size, [pins])

  const clampZoom = useCallback((next: ZoomState): ZoomState => {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.k))
    // Transform scales from origin then translates, so content occupies
    // [0, k·W] × [0, k·H] before translation. Allow tx to reach -(k-1)·W
    // so the right/bottom edges can align with the viewport, plus a 30%
    // overshoot margin on each side for responsive dragging.
    const margin = 0.3
    const minTx = -(k - 1) * W - W * margin
    const maxTx = W * margin
    const minTy = -(k - 1) * H - H * margin
    const maxTy = H * margin
    return {
      k,
      x: Math.max(minTx, Math.min(maxTx, next.x)),
      y: Math.max(minTy, Math.min(maxTy, next.y)),
    }
  }, [])

  const zoomToward = useCallback((factor: number, fx: number, fy: number) => {
    setZoom(prev => {
      const newK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.k * factor))
      if (newK === prev.k) return prev
      const ratio = newK / prev.k
      return clampZoom({
        k: newK,
        x: fx - (fx - prev.x) * ratio,
        y: fy - (fy - prev.y) * ratio,
      })
    })
  }, [clampZoom])

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { x, y } = svgPoint(e.clientX, e.clientY)
      const dir = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP
      zoomToward(dir, x, y)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgPoint, zoomToward])

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const startClientX = e.clientX
    const startClientY = e.clientY
    const start = svgPoint(e.clientX, e.clientY)
    const ox = zoomRef.current.x
    const oy = zoomRef.current.y
    let moved = false

    const onDocMove = (ev: MouseEvent) => {
      const dxClient = ev.clientX - startClientX
      const dyClient = ev.clientY - startClientY
      if (!moved && Math.hypot(dxClient, dyClient) > 3) {
        moved = true
        justDraggedRef.current = true
        setDragging(true)
      }
      if (moved) {
        const pt = svgPoint(ev.clientX, ev.clientY)
        const dx = pt.x - start.x
        const dy = pt.y - start.y
        setZoom(prev => clampZoom({ ...prev, x: ox + dx, y: oy + dy }))
      }
    }

    const onDocUp = () => {
      document.removeEventListener('mousemove', onDocMove)
      document.removeEventListener('mouseup', onDocUp)
      setDragging(false)
      if (moved) {
        setTimeout(() => { justDraggedRef.current = false }, 0)
      } else {
        justDraggedRef.current = false
      }
    }

    document.addEventListener('mousemove', onDocMove)
    document.addEventListener('mouseup', onDocUp)
  }

  const onTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const t0 = e.touches[0]
      const startId = t0.identifier
      const startClientX = t0.clientX
      const startClientY = t0.clientY
      const start = svgPoint(t0.clientX, t0.clientY)
      const ox = zoomRef.current.x
      const oy = zoomRef.current.y
      let moved = false

      const findTouch = (ev: TouchEvent) => {
        for (let i = 0; i < ev.touches.length; i++) {
          if (ev.touches[i].identifier === startId) return ev.touches[i]
        }
        return null
      }

      const onDocMove = (ev: TouchEvent) => {
        const t = findTouch(ev)
        if (!t) return
        if (ev.touches.length >= 2) {
          // upgrade to pinch
          document.removeEventListener('touchmove', onDocMove)
          document.removeEventListener('touchend', onDocEnd)
          document.removeEventListener('touchcancel', onDocEnd)
          startPinch(ev)
          return
        }
        ev.preventDefault()
        const dxClient = t.clientX - startClientX
        const dyClient = t.clientY - startClientY
        if (!moved && Math.hypot(dxClient, dyClient) > 4) {
          moved = true
          justDraggedRef.current = true
          setDragging(true)
        }
        if (moved) {
          const pt = svgPoint(t.clientX, t.clientY)
          const dx = pt.x - start.x
          const dy = pt.y - start.y
          setZoom(prev => clampZoom({ ...prev, x: ox + dx, y: oy + dy }))
        }
      }

      const onDocEnd = () => {
        document.removeEventListener('touchmove', onDocMove)
        document.removeEventListener('touchend', onDocEnd)
        document.removeEventListener('touchcancel', onDocEnd)
        setDragging(false)
        if (moved) {
          setTimeout(() => { justDraggedRef.current = false }, 0)
        } else {
          justDraggedRef.current = false
        }
      }

      document.addEventListener('touchmove', onDocMove, { passive: false })
      document.addEventListener('touchend', onDocEnd)
      document.addEventListener('touchcancel', onDocEnd)
    } else if (e.touches.length === 2) {
      startPinch(e.nativeEvent)
    }
  }

  const startPinch = (initial: TouchEvent) => {
    if (initial.touches.length < 2) return
    const t1 = initial.touches[0]
    const t2 = initial.touches[1]
    const d0 = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const mid = svgPoint((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2)
    const k0 = zoomRef.current.k
    const tx0 = zoomRef.current.x
    const ty0 = zoomRef.current.y

    justDraggedRef.current = true

    const onDocMove = (ev: TouchEvent) => {
      if (ev.touches.length < 2) return
      ev.preventDefault()
      const a = ev.touches[0]
      const b = ev.touches[1]
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      if (d0 <= 0) return
      const targetK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k0 * (d / d0)))
      const ratio = targetK / k0
      setZoom(clampZoom({
        k: targetK,
        x: mid.x - (mid.x - tx0) * ratio,
        y: mid.y - (mid.y - ty0) * ratio,
      }))
    }

    const onDocEnd = () => {
      document.removeEventListener('touchmove', onDocMove)
      document.removeEventListener('touchend', onDocEnd)
      document.removeEventListener('touchcancel', onDocEnd)
      setTimeout(() => { justDraggedRef.current = false }, 0)
    }

    document.addEventListener('touchmove', onDocMove, { passive: false })
    document.addEventListener('touchend', onDocEnd)
    document.addEventListener('touchcancel', onDocEnd)
  }

  const visibleId = pinnedId ?? activeId
  const activePin = placed.find(p => p.id === visibleId) ?? null

  const closeAll = useCallback(() => {
    setActiveId(null)
    setPinnedId(null)
  }, [])

  useEffect(() => {
    if (!pinnedId) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) closeAll()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinnedId, closeAll])

  const onPinActivate = (id: string) => {
    if (justDraggedRef.current) return
    setPinnedId(prev => (prev === id ? null : id))
  }

  const onSvgKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomToward(ZOOM_BUTTON_STEP, W / 2, H / 2)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomToward(1 / ZOOM_BUTTON_STEP, W / 2, H / 2)
    } else if (e.key === '0') {
      e.preventDefault()
      setZoom(IDENTITY)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setZoom(prev => clampZoom({ ...prev, y: prev.y + PAN_KEY_STEP }))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setZoom(prev => clampZoom({ ...prev, y: prev.y - PAN_KEY_STEP }))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setZoom(prev => clampZoom({ ...prev, x: prev.x + PAN_KEY_STEP }))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setZoom(prev => clampZoom({ ...prev, x: prev.x - PAN_KEY_STEP }))
    }
  }

  const screenCoord = (p: PlacedPin) => ({
    cx: p.cx * zoom.k + zoom.x,
    cy: p.cy * zoom.k + zoom.y,
  })

  const inViewport = (sc: { cx: number; cy: number }) =>
    sc.cx > -24 && sc.cx < W + 24 && sc.cy > -24 && sc.cy < H + 24

  const tooltipPlacement = useMemo(() => {
    if (!activePin) return { left: 0, top: 0, flipX: false, flipY: false, hidden: true }
    const cx = activePin.cx * zoom.k + zoom.x
    const cy = activePin.cy * zoom.k + zoom.y
    return {
      left: (cx / W) * 100,
      top: (cy / H) * 100,
      flipX: cx > W * 0.6,
      flipY: cy < H * 0.35,
      hidden: !(cx > -24 && cx < W + 24 && cy > -24 && cy < H + 24),
    }
  }, [activePin, zoom])

  if (!features) {
    return (
      <div className="h-[420px] grid place-items-center text-[color:var(--muted)] text-sm bg-white rounded-2xl border border-[color:var(--line)] mt-6" aria-busy="true">
        {t('loading')}
      </div>
    )
  }

  const path = geoPath(projection)
  const zoomedIn = zoom.k > 1.001
  const atIdentity = zoom.k === 1 && zoom.x === 0 && zoom.y === 0

  return (
    <div className="relative mt-8" ref={containerRef}>
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-sm font-bold mt-0.5">{t('title')}</div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[11px] text-[color:var(--muted)]">{t('hint')}</div>
          <div className="text-[10px] text-[color:var(--muted)] mt-0.5 tabular">{t('regionsCount', { count: placed.length, countries: uniqueCountries })}</div>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full bg-white rounded-2xl border border-[color:var(--line)] select-none overflow-hidden ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          role="img"
          tabIndex={0}
          aria-label={t('ariaLabel', { count: placed.length })}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onKeyDown={onSvgKeyDown}
          style={{ touchAction: 'none' }}
        >
          <defs>
            <clipPath id="origin-map-clip">
              <rect x={0} y={0} width={W} height={H} />
            </clipPath>
          </defs>
          <g clipPath="url(#origin-map-clip)">
            <g transform={`translate(${zoom.x}, ${zoom.y}) scale(${zoom.k})`}>
              {features.features.map((f, i) => (
                <path
                  key={i}
                  d={path(f) || ''}
                  fill="#e8e8ed"
                  stroke="#d2d2d7"
                  strokeWidth={0.4 / zoom.k}
                />
              ))}
            </g>

            <g>
              {placed.map(p => {
                const sc = screenCoord(p)
                if (!inViewport(sc)) return null
                const isActive = p.id === visibleId
                return (
                  <g
                    key={p.id}
                    data-pin="true"
                    role="button"
                    tabIndex={0}
                    aria-label={t('pinAria', { emoji: p.emoji, country: p.country, year: p.year })}
                    aria-expanded={isActive}
                    className="cursor-pointer focus:outline-none"
                    onMouseEnter={() => setActiveId(p.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(p.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={(e) => { e.stopPropagation(); onPinActivate(p.id) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPinActivate(p.id)
                      }
                    }}
                    transform={`translate(${sc.cx}, ${sc.cy})`}
                  >
                    <circle r={HIT_RADIUS} fill="transparent" />
                    <circle
                      r={isActive ? 17 : 14}
                      fill="white"
                      stroke="var(--accent-02)"
                      strokeWidth={isActive ? 3 : 2}
                      style={{ transition: 'r 160ms ease, stroke-width 160ms ease' }}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={isActive ? 16 : 14}
                      style={{ pointerEvents: 'none', transition: 'font-size 160ms ease' }}
                    >
                      {p.emoji}
                    </text>
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

        <div className="absolute top-3 right-3 flex flex-col gap-1 bg-white/95 backdrop-blur rounded-lg shadow-sm ring-1 ring-[color:var(--line)] p-1">
          <button
            type="button"
            aria-label={t('zoomIn')}
            onClick={() => zoomToward(ZOOM_BUTTON_STEP, W / 2, H / 2)}
            disabled={zoom.k >= MAX_ZOOM - 0.001}
            className="w-7 h-7 grid place-items-center text-base font-bold leading-none text-[color:var(--ink)] hover:bg-[color:var(--accent-02)]/10 rounded disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-02)]/50"
          >
            +
          </button>
          <button
            type="button"
            aria-label={t('zoomOut')}
            onClick={() => zoomToward(1 / ZOOM_BUTTON_STEP, W / 2, H / 2)}
            disabled={zoom.k <= MIN_ZOOM + 0.001}
            className="w-7 h-7 grid place-items-center text-base font-bold leading-none text-[color:var(--ink)] hover:bg-[color:var(--accent-02)]/10 rounded disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-02)]/50"
          >
            −
          </button>
          <button
            type="button"
            aria-label={t('reset')}
            onClick={() => setZoom(IDENTITY)}
            disabled={atIdentity}
            className="w-7 h-7 grid place-items-center text-[11px] font-semibold leading-none text-[color:var(--ink)] hover:bg-[color:var(--accent-02)]/10 rounded disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-02)]/50"
          >
            ⟲
          </button>
        </div>

        <div
          className={`absolute bottom-3 left-3 text-[10px] font-bold tabular px-2 py-1 rounded bg-white/90 ring-1 ring-[color:var(--line)] transition-colors ${zoomedIn ? 'text-[color:var(--accent-02)]' : 'text-[color:var(--muted)]'}`}
          aria-live="polite"
        >
          {t('zoomLevel', { level: zoom.k.toFixed(1) })}
        </div>

        {activePin && !tooltipPlacement.hidden && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              className="pointer-events-auto absolute z-10 w-60 rounded-xl bg-white shadow-lg ring-1 ring-[color:var(--line)] p-3"
              style={{
                left: `${tooltipPlacement.left}%`,
                top: `${tooltipPlacement.top}%`,
                transform: `translate(${tooltipPlacement.flipX ? 'calc(-100% - 18px)' : '18px'}, ${tooltipPlacement.flipY ? '18px' : 'calc(-100% - 18px)'})`,
              }}
              role={pinnedId ? 'dialog' : 'tooltip'}
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activePin.emoji}</span>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-02)]">{activePin.country}</div>
                    <div className="text-xs font-bold tabular text-[color:var(--ink)]">{activePin.year}</div>
                  </div>
                </div>
                {pinnedId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeAll() }}
                    className="text-[color:var(--muted)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-02)]/50 rounded -mt-1 -mr-1 w-6 h-6 grid place-items-center text-sm"
                    aria-label={t('close')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-[color:var(--muted)] mt-2.5">
                {labelT(activePin.labelKey as never)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
