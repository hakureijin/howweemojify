'use client'
import { useMemo, useState, useEffect, useRef, useCallback, useId } from 'react'
import { scaleLinear } from 'd3-scale'
import { line, area, curveMonotoneX } from 'd3-shape'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import type { Chapter01Data, TimelineNode } from '@/types/chapter-01'

const W = 880
const H = 440
const PAD = { l: 64, r: 24, t: 32, b: 48 }
const HIT_RADIUS = 22 // 44px touch target diameter

// The 1999–2010 stretch only has 2 contributing versions (DoCoMo, Unicode 6.0); a
// linear x-axis gives it ~41% of the chart width and crams every Unicode/Emoji
// version from 2014 onward into the remainder. When the visible range includes
// the pre-2010 segment, we compress it to COMPRESS_PRE_WEIGHT of the width so the
// dense high-growth era can breathe.
const COMPRESS_BREAK_YEAR = 2010
const COMPRESS_PRE_WEIGHT = 0.22

type RangeId = 'all' | 'since-2015' | 'since-2020'

const RANGE_START: Record<RangeId, number> = {
  'all': 1999,
  'since-2015': 2015,
  'since-2020': 2020,
}

export const DEFAULT_FROM_ID = 'emoji-6-0'
export const DEFAULT_TO_ID = 'emoji-17-0'

export interface EnrichedNode {
  node: TimelineNode & { newEmojiCount: number }
  runningTotal: number
  previousTotal: number
  growthPct: number
}

export interface DiffResult {
  fromNode: EnrichedNode
  toNode: EnrichedNode
  yearSpan: number
  versionCount: number
  addedTotal: number
  growthPct: number | null
  sampleEmojis: string[]
  isDraft: boolean
}

export function computeVersionDiff(
  contributingSeries: EnrichedNode[],
  fromId: string,
  toId: string,
): DiffResult | null {
  if (fromId === toId) return null
  const idxA = contributingSeries.findIndex((n) => n.node.id === fromId)
  const idxB = contributingSeries.findIndex((n) => n.node.id === toId)
  if (idxA === -1 || idxB === -1) return null

  const [earlyIdx, lateIdx] = idxA < idxB ? [idxA, idxB] : [idxB, idxA]
  const fromNode = contributingSeries[earlyIdx]
  const toNode = contributingSeries[lateIdx]

  const intermediate = contributingSeries.slice(earlyIdx + 1, lateIdx + 1)
  const addedTotal = intermediate.reduce((acc, n) => acc + n.node.newEmojiCount, 0)
  const growthPct =
    fromNode.runningTotal === 0 ? null : (addedTotal / fromNode.runningTotal) * 100
  const sampleEmojis = intermediate.flatMap((n) => n.node.highlightEmojis)

  return {
    fromNode,
    toNode,
    yearSpan: toNode.node.year - fromNode.node.year,
    versionCount: intermediate.length,
    addedTotal,
    growthPct,
    sampleEmojis,
    isDraft: toNode.node.draft === true,
  }
}

interface ChartPoint extends TimelineNode {
  runningTotal: number
  previousTotal: number
  growthPct: number
  flagship: boolean
  cx: number
  cy: number
}

interface Props {
  data: Chapter01Data
}

export function CumulativeChart({ data }: Props) {
  const t = useTranslations('ch01.chart')
  const narrativeT = useTranslations()
  const locale = useLocale() as 'zh' | 'en'
  const containerRef = useRef<HTMLDivElement>(null)
  const clipId = useId()

  const [range, setRange] = useState<RangeId>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [fromId, setFromId] = useState<string>(DEFAULT_FROM_ID)
  const [toId, setToId] = useState<string>(DEFAULT_TO_ID)

  const decadeSet = useMemo(() => new Set(data.decadeIndex), [data.decadeIndex])

  // 1. Compute the full enriched series (every contributing version)
  const fullSeries = useMemo(() => {
    const contributing = data.timeline.filter(
      (n): n is TimelineNode & { newEmojiCount: number } => n.newEmojiCount !== null
    )
    let running = 0
    return contributing.map(n => {
      const previousTotal = running
      running += n.newEmojiCount
      const growthPct = previousTotal === 0 ? 0 : (n.newEmojiCount / previousTotal) * 100
      return { node: n, runningTotal: running, previousTotal, growthPct }
    })
  }, [data.timeline])

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
  const { points, hiddenAnchor, pathLine, pathArea, yTicks, xScale, yScale, xLabels } = useMemo(() => {
    const chartLeft = PAD.l
    const chartRight = W - PAD.r
    const chartWidth = chartRight - chartLeft
    const compressed = rangeStart < COMPRESS_BREAK_YEAR

    let xScale: (year: number) => number
    if (compressed) {
      const breakX = chartLeft + chartWidth * COMPRESS_PRE_WEIGHT
      const leftScale = scaleLinear()
        .domain([rangeStart, COMPRESS_BREAK_YEAR])
        .range([chartLeft, breakX])
      const rightScale = scaleLinear()
        .domain([COMPRESS_BREAK_YEAR, Math.max(fullMaxYear, COMPRESS_BREAK_YEAR + 1)])
        .range([breakX, chartRight])
      xScale = (year: number) =>
        year <= COMPRESS_BREAK_YEAR ? leftScale(year) : rightScale(year)
    } else {
      const linear = scaleLinear()
        .domain([rangeStart, Math.max(fullMaxYear, rangeStart + 1)])
        .range([chartLeft, chartRight])
      xScale = (year: number) => linear(year)
    }

    const yMax = Math.max(...fullSeries.map(d => d.runningTotal), 1) * 1.06
    const yScale = scaleLinear().domain([0, yMax]).nice().range([H - PAD.b, PAD.t])

    // Visible points (interactive markers)
    const visible: ChartPoint[] = fullSeries
      .filter(d => d.node.year >= rangeStart)
      .map(d => ({
        ...d.node,
        runningTotal: d.runningTotal,
        previousTotal: d.previousTotal,
        growthPct: d.growthPct,
        flagship: decadeSet.has(d.node.year),
        cx: xScale(d.node.year),
        cy: yScale(d.runningTotal),
      }))

    // Predecessor anchor: the last point BEFORE the visible range — used so the line/area
    // visually "enters from the left" instead of starting with a triangle wedge.
    const predecessor = fullSeries
      .filter(d => d.node.year < rangeStart)
      .slice(-1)[0]
    const anchor: ChartPoint | null = predecessor
      ? {
          ...predecessor.node,
          runningTotal: predecessor.runningTotal,
          previousTotal: predecessor.previousTotal,
          growthPct: predecessor.growthPct,
          flagship: decadeSet.has(predecessor.node.year),
          cx: xScale(predecessor.node.year), // will be < PAD.l → off-screen, clipped
          cy: yScale(predecessor.runningTotal),
        }
      : null

    const pathPoints = anchor ? [anchor, ...visible] : visible
    const seriesPts = pathPoints.map(p => ({ year: p.year, total: p.runningTotal }))
    const l = line<{ year: number; total: number }>()
      .x(d => xScale(d.year))
      .y(d => yScale(d.total))
      .curve(curveMonotoneX)
    const a = area<{ year: number; total: number }>()
      .x(d => xScale(d.year))
      .y0(yScale(0))
      .y1(d => yScale(d.total))
      .curve(curveMonotoneX)

    const xLabels = Array.from(new Set([rangeStart, ...data.decadeIndex.filter(y => y >= rangeStart), fullMaxYear]))
      .filter(y => y >= rangeStart)
      .sort((a, b) => a - b)

    return {
      points: visible,
      hiddenAnchor: anchor,
      pathLine: l(seriesPts) || '',
      pathArea: a(seriesPts) || '',
      yTicks: yScale.ticks(4),
      xScale,
      yScale,
      xLabels,
    }
  }, [fullSeries, fullMaxYear, rangeStart, decadeSet, data.decadeIndex])

  const visibleId = pinnedId ?? activeId
  const activePoint = points.find(p => p.id === visibleId) ?? null

  const closeAll = useCallback(() => {
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
            onChange={(e) => setFromId(e.target.value)}
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
            onChange={(e) => setToId(e.target.value)}
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

  function VersionDiffCard() {
    if (!diffResult) return null

    const MAX_SAMPLES = 30
    const samples = diffResult.sampleEmojis
    const visibleSamples = samples.slice(0, MAX_SAMPLES)
    const overflow = Math.max(0, samples.length - MAX_SAMPLES)

    const spanText =
      diffResult.yearSpan === 0
        ? t('diff.cardSpanSameYear', { versions: diffResult.versionCount })
        : t('diff.cardSpan', {
            years: diffResult.yearSpan,
            versions: diffResult.versionCount,
          })

    return (
      <div className="mt-3 rounded-xl bg-white p-3.5 border border-[color:var(--accent-01)]/25">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-[color:var(--accent-01)] uppercase">
              {t('diff.cardEyebrow', {
                fromYear: diffResult.fromNode.node.year,
                toYear: diffResult.toNode.node.year,
              })}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
              {t('diff.cardTitle', {
                fromVersion: diffResult.fromNode.node.versionLabel,
                toVersion: diffResult.toNode.node.versionLabel,
              })}
              <span className="ml-2 text-[11px] font-bold text-[color:var(--muted)]">
                · {spanText}
              </span>
            </div>
          </div>
          {diffResult.isDraft && (
            <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--muted)] text-white">
              {t('draftBadge')}
            </span>
          )}
        </div>

        <div
          className="mt-3 grid grid-cols-3 gap-3 text-xs border-t border-[color:var(--line)]/60 pt-3"
          aria-live="polite"
        >
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
              {t('added')}
            </div>
            <div className="text-base font-semibold tabular text-[color:var(--accent-01)] leading-tight">
              +{diffResult.addedTotal.toLocaleString(locale)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
              {t('total')}
            </div>
            <div className="text-base font-semibold tabular leading-tight">
              {diffResult.toNode.runningTotal.toLocaleString(locale)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
              {t('growth')}
            </div>
            <div className="text-base font-semibold tabular text-[color:var(--accent-04)] leading-tight">
              {diffResult.growthPct === null
                ? '—'
                : `+${Math.round(diffResult.growthPct)}%`}
            </div>
          </div>
        </div>

        {visibleSamples.length > 0 && (
          <div className="mt-3 border-t border-[color:var(--line)]/60 pt-3">
            <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold mb-1.5">
              {t('diff.sampleHeader', { versions: diffResult.versionCount })}
            </div>
            <div className="flex flex-wrap gap-1.5 text-base md:text-lg leading-none">
              {visibleSamples.map((e, i) => (
                <span key={i}>{e}</span>
              ))}
              {overflow > 0 && (
                <span className="text-[11px] font-bold text-[color:var(--muted)] self-end">
                  {t('diff.moreCount', { count: overflow })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Title row + headline total */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {t('eyebrow')}
          </div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">
            {t('title', { lastYear: fullMaxYear })}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {fullFinalTotal.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">
            {t('totalBy', { year: fullMaxYear })}
          </div>
        </div>
      </div>

      {/* Range filter buttons */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">{t('rangeLabel')}</span>
        {RANGES.map(r => {
          const active = range === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
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
          <linearGradient id="gradGrowth" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent-01)" />
            <stop offset="100%" stopColor="var(--accent-04)" />
          </linearGradient>
          <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.18)" />
          </filter>
          <clipPath id={clipId}>
            <rect
              x={PAD.l}
              y={PAD.t - 10}
              width={W - PAD.l - PAD.r}
              height={H - PAD.t - PAD.b + 12}
            />
          </clipPath>
        </defs>

        {/* Y-axis title (rotated) */}
        <text
          x={16}
          y={(PAD.t + (H - PAD.b)) / 2}
          fontSize="10"
          fill="var(--muted)"
          textAnchor="middle"
          fontWeight="800"
          letterSpacing="0.1em"
          transform={`rotate(-90 16 ${(PAD.t + (H - PAD.b)) / 2})`}
        >
          {t('yAxis')}
        </text>

        {/* Y-axis gridlines + labels */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--line)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD.l - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--muted)"
              className="tabular"
            >
              {tick.toLocaleString(locale)}
            </text>
          </g>
        ))}

        {/* Area + line (clipped to chart area so off-screen extension doesn't leak) */}
        <g clipPath={`url(#${clipId})`}>
          <path d={pathArea} fill="url(#gradGrowth)" opacity={0.16} />
          <path
            d={pathLine}
            fill="none"
            stroke="url(#gradGrowth)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* X-axis labels (decade markers within visible range) */}
        {xLabels.map(year => (
          <g key={year}>
            <line
              x1={xScale(year)}
              x2={xScale(year)}
              y1={H - PAD.b}
              y2={H - PAD.b + 5}
              stroke="var(--muted)"
              opacity={0.4}
            />
            <text
              x={xScale(year)}
              y={H - PAD.b + 20}
              fontSize="11"
              fill="var(--muted)"
              textAnchor="middle"
              className="tabular"
              fontWeight="700"
            >
              {year}
            </text>
          </g>
        ))}

        {/* Interactive emoji medallions (visible range only) */}
        {points.map(p => {
          const isActive = p.id === visibleId
          const baseR = p.flagship ? 18 : 13
          const r = isActive ? baseR + 4 : baseR
          const fontSize = p.flagship ? (isActive ? 18 : 14) : isActive ? 14 : 11
          const isDraft = p.draft === true
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
              onMouseEnter={() => setActiveId(p.id)}
              onMouseLeave={() => setActiveId(null)}
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
              {/* Medallion background */}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={r}
                fill="white"
                stroke={isDraft ? 'var(--muted)' : 'var(--accent-01)'}
                strokeWidth={isActive ? 3 : p.flagship ? 2.5 : 2}
                strokeDasharray={isDraft ? '3 3' : undefined}
                filter={isActive ? 'url(#markerShadow)' : undefined}
                style={{ transition: 'r 160ms ease, stroke-width 160ms ease' }}
              />
              {/* Highlight emoji */}
              <text
                x={p.cx}
                y={p.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                pointerEvents="none"
                opacity={isDraft ? 0.65 : 1}
                style={{ transition: 'font-size 160ms ease' }}
              >
                {p.highlightEmojis[0] ?? '·'}
              </text>
              {/* Year label below flagship markers */}
              {p.flagship && !isActive && !compareIds.has(p.id) && (
                <text
                  x={p.cx}
                  y={p.cy + baseR + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="800"
                  fill={isDraft ? 'var(--muted)' : 'var(--accent-01)'}
                  className="tabular"
                  pointerEvents="none"
                >
                  {p.year}
                </text>
              )}
              {/* Draft badge — sits on the LEFT of the medallion since the draft
                  point is always at the chart's right edge. dominantBaseline
                  "central" centers the glyphs vertically inside the pill instead
                  of pinning the baseline (which makes the caps poke out the top). */}
              {isDraft && (() => {
                const pillW = 44
                const pillH = 14
                const pillX = p.cx - baseR - pillW
                const pillY = p.cy - baseR - pillH / 2 - 2
                return (
                  <g pointerEvents="none">
                    <rect
                      x={pillX}
                      y={pillY}
                      width={pillW}
                      height={pillH}
                      rx={pillH / 2}
                      fill="var(--muted)"
                    />
                    <text
                      x={pillX + pillW / 2}
                      y={pillY + pillH / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="8"
                      fontWeight="900"
                      fill="white"
                      letterSpacing="0.05em"
                    >
                      DRAFT
                    </text>
                  </g>
                )
              })()}
              {/* Compare A/B annotation */}
              {compareIds.has(p.id) && diffResult && (
                <g pointerEvents="none">
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={r}
                    fill="none"
                    stroke="var(--accent-01)"
                    strokeWidth={4}
                  />
                  <g transform={`translate(${p.cx}, ${p.cy + baseR + 22})`}>
                    <rect x={-9} y={-7} width={18} height={13} rx={3} fill="var(--accent-01)" />
                    <text
                      textAnchor="middle"
                      dy={2}
                      fontSize={9}
                      fontWeight={900}
                      fill="white"
                      letterSpacing="0.05em"
                    >
                      {p.id === diffResult.fromNode.node.id ? 'A' : 'B'}
                    </text>
                  </g>
                </g>
              )}
            </g>
          )
        })}

        {/* Suppress unused-variable warnings for hiddenAnchor (kept for line continuity) */}
        {hiddenAnchor === null ? null : null}
      </svg>

      <DiffControls />
      <VersionDiffCard />

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
