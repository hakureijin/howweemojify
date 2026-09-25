'use client'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from './ChartHeader'
import { CumulativeAxes } from './CumulativeAxes'
import { CumulativeMarker } from './CumulativeMarker'
import { VersionDiffCard } from './VersionDiffCard'
import { track, hoverStart, hoverEnd } from '@/lib/tracking'
import {
  buildGeometry, buildSeries, computeVersionDiff,
  CUM_W as W, CUM_H as H, DEFAULT_FROM_ID, DEFAULT_TO_ID, RANGE_START,
  type RangeId,
} from '@/lib/charts/cumulative'
import type { Chapter01Data } from '@/types/chapter-01'

// Re-exported for tests/logic/version-diff.test.ts, which imports from this file.
export { computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID }
export type { EnrichedNode, DiffResult } from '@/lib/charts/cumulative'

const HIT_RADIUS = 22 // 44px touch target diameter

interface Props {
  data: Chapter01Data
}

export function CumulativeChart({ data }: Props) {
  const t = useTranslations('ch01.chart')
  const narrativeT = useTranslations()
  const locale = useLocale() as 'zh' | 'en'
  const containerRef = useRef<HTMLDivElement>(null)

  const [range, setRange] = useState<RangeId>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [fromId, setFromId] = useState<string>(DEFAULT_FROM_ID)
  const [toId, setToId] = useState<string>(DEFAULT_TO_ID)

  // 1. Compute the full enriched series (every contributing version)
  const fullSeries = useMemo(() => buildSeries(data.timeline), [data.timeline])

  const rangeStart = RANGE_START[range]
  const fullMaxYear = useMemo(() => Math.max(...fullSeries.map(d => d.node.year)), [fullSeries])
  const fullFinalTotal = fullSeries[fullSeries.length - 1]?.runningTotal ?? 0

  const diffResult = useMemo(
    () => computeVersionDiff(fullSeries, fromId, toId),
    [fullSeries, fromId, toId],
  )

  const compareIds = useMemo(() => {
    if (!diffResult) return new Set<string>()
    return new Set<string>([diffResult.fromNode.node.id, diffResult.toNode.node.id])
  }, [diffResult])

  // 2. Build scales and paths
  const geometry = useMemo(
    () => buildGeometry(fullSeries, data.decadeIndex, rangeStart),
    [fullSeries, data.decadeIndex, rangeStart],
  )
  const { points } = geometry

  const visibleId = pinnedId ?? activeId
  const activePoint = points.find(p => p.id === visibleId) ?? null

  // Mirrors pinnedId so closeAll (stable, used by effects) can tell whether anything was open.
  const pinnedRef = useRef(pinnedId)
  useEffect(() => { pinnedRef.current = pinnedId }, [pinnedId])
  const closeAll = useCallback(() => {
    if (pinnedRef.current !== null) track('cumulative', 'close')
    setActiveId(null)
    setPinnedId(null)
  }, [])

  // Reset active/pinned state when range changes (the marker may have left the visible window)
  useEffect(() => { closeAll() }, [range, closeAll])

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

  const onMarkerActivate = (id: string) => {
    track('cumulative', pinnedId === id ? 'unpin' : 'pin', id)
    setPinnedId(prev => (prev === id ? null : id))
  }

  const tooltipPlacement = useMemo(() => {
    if (!activePoint) return { left: 0, top: 0, flipX: false, flipY: false }
    return {
      left: (activePoint.cx / W) * 100,
      top: (activePoint.cy / H) * 100,
      flipX: activePoint.cx > W * 0.6,
      flipY: activePoint.cy < H * 0.35,
    }
  }, [activePoint])

  const RANGES: { id: RangeId; labelKey: string }[] = [
    { id: 'all', labelKey: 'rangeAll' },
    { id: 'since-2015', labelKey: 'range2015' },
    { id: 'since-2020', labelKey: 'range2020' },
  ]

  function DiffControls() {
    return (
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
          {t('diff.eyebrow')}
        </span>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--muted)]">
          {t('diff.from')}
          <select
            value={fromId}
            onChange={(e) => { track('cumulative', 'diff', `${e.target.value}→${toId}`); setFromId(e.target.value) }}
            aria-label={t('diff.fromAria')}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-[color:var(--line)] text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-01)]/50"
          >
            {fullSeries.map((n) => (
              <option key={n.node.id} value={n.node.id}>
                {t('diff.optionLabel', { version: n.node.versionLabel, year: n.node.year })}
                {n.node.draft ? t('diff.draftSuffix') : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--muted)]">
          {t('diff.to')}
          <select
            value={toId}
            onChange={(e) => { track('cumulative', 'diff', `${fromId}→${e.target.value}`); setToId(e.target.value) }}
            aria-label={t('diff.toAria')}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-[color:var(--line)] text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-01)]/50"
          >
            {fullSeries.map((n) => (
              <option key={n.node.id} value={n.node.id}>
                {t('diff.optionLabel', { version: n.node.versionLabel, year: n.node.year })}
                {n.node.draft ? t('diff.draftSuffix') : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Title row + headline total */}
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title', { lastYear: fullMaxYear })}
        total={fullFinalTotal.toLocaleString(locale)}
        totalLabel={t('totalBy', { year: fullMaxYear })}
      />

      {/* Range filter buttons */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">{t('rangeLabel')}</span>
        {RANGES.map(r => {
          const active = range === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => { track('cumulative', 'range', r.id); setRange(r.id) }}
              aria-pressed={active}
              className={`text-[11px] font-bold px-3 py-1 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-01)]/50 ${
                active
                  ? 'bg-[color:var(--accent-01)] text-white'
                  : 'bg-white text-[color:var(--muted)] border border-[color:var(--line)] hover:text-[color:var(--ink)] hover:border-[color:var(--ink)]/30'
              }`}
            >
              {t(r.labelKey as never)}
            </button>
          )
        })}
        <span className="text-[10px] text-[color:var(--muted)] hidden md:block ml-auto">
          {t('hint')}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label={t('ariaLabel', { count: points.length })}
      >
        <defs>
          <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.18)" />
          </filter>
        </defs>

        <CumulativeAxes geometry={geometry} locale={locale} yAxisLabel={t('yAxis')} />

        {/* Interactive emoji medallions (visible range only) */}
        {points.map(p => {
          const isActive = p.id === visibleId
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${t('markerAria', {
                year: p.year,
                version: p.versionLabel,
                added: p.newEmojiCount ?? 0,
                total: p.runningTotal,
              })}${
                compareIds.has(p.id) && diffResult
                  ? ` · ${p.id === diffResult.fromNode.node.id ? t('diff.markerAriaA') : t('diff.markerAriaB')}`
                  : ''
              }`}
              aria-expanded={isActive}
              className="cursor-pointer focus:outline-none"
              onMouseEnter={() => { setActiveId(p.id); hoverStart('cumulative', p.id) }}
              onMouseLeave={() => { setActiveId(null); hoverEnd('cumulative', p.id) }}
              onFocus={() => setActiveId(p.id)}
              onBlur={() => setActiveId(null)}
              onClick={(e) => {
                e.stopPropagation()
                onMarkerActivate(p.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onMarkerActivate(p.id)
                }
              }}
            >
              {/* Invisible hit area */}
              <circle cx={p.cx} cy={p.cy} r={HIT_RADIUS} fill="transparent" />
              <CumulativeMarker
                p={p}
                isActive={isActive}
                compare={compareIds.has(p.id) && diffResult ? (p.id === diffResult.fromNode.node.id ? 'A' : 'B') : null}
              />
            </g>
          )
        })}
      </svg>

      <DiffControls />
      {diffResult && <VersionDiffCard diff={diffResult} />}

      {/* HTML tooltip overlay */}
      {activePoint && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className={`pointer-events-auto absolute z-10 w-72 rounded-xl bg-white shadow-lg ring-1 ring-[color:var(--line)] p-3.5 ${pinnedId ? 'shadow-xl' : ''}`}
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
                <span className="text-2xl leading-none">{activePoint.highlightEmojis[0]}</span>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-[color:var(--accent-01)] uppercase">
                    {activePoint.year} · {activePoint.versionLabel}
                  </div>
                  <div className="flex gap-1.5 mt-0.5">
                    {activePoint.flagship && (
                      <span className="text-[9px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                        {t('milestone')}
                      </span>
                    )}
                    {activePoint.draft && (
                      <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--muted)] text-white">
                        {t('draftBadge')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {pinnedId && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeAll() }}
                  className="text-[color:var(--muted)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-01)]/50 rounded -mt-1 -mr-1 w-6 h-6 grid place-items-center text-sm"
                  aria-label={t('close')}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('added')}</div>
                <div className="text-base font-semibold tabular text-[color:var(--accent-01)] leading-tight">+{(activePoint.newEmojiCount ?? 0).toLocaleString(locale)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('total')}</div>
                <div className="text-base font-semibold tabular leading-tight">{activePoint.runningTotal.toLocaleString(locale)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('growth')}</div>
                <div className="text-base font-semibold tabular text-[color:var(--accent-04)] leading-tight">
                  {activePoint.previousTotal === 0
                    ? '—'
                    : `+${Math.round(activePoint.growthPct)}%`}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] leading-relaxed text-[color:var(--muted)]">
              {narrativeT(activePoint.narrativeKey as never)}
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex gap-1.5">
                {activePoint.highlightEmojis.slice(0, 5).map((e, i) => (
                  <span key={i} className="text-sm">{e}</span>
                ))}
              </div>
              <Citation source={activePoint.source} locale={locale} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
