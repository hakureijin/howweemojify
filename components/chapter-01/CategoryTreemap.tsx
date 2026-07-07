'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { usePrefersReducedMotion } from '@/lib/prefers-reduced-motion'
import type {
  CategoryFrame,
  CategoryGroupKey,
  Chapter01CategoryData,
} from '@/types/chapter-01'

const W = 880
const H = 460
const ANIM_MS = 600
const PLAY_STEP_MS = 1600
const TICK_LABEL_YEARS = new Set([2010, 2015, 2020, 2025])

interface Props {
  data: Chapter01CategoryData
}

interface TileNode {
  key: CategoryGroupKey
  count: number
  x: number
  y: number
  w: number
  h: number
}

export interface FrameLookup {
  frame: CategoryFrame
  index: number
}

/** Pure helper: pick the frame whose year is closest to (but not exceeding) the
 *  requested year. Used both by the slider and by the test suite. */
export function frameAt(frames: CategoryFrame[], year: number): FrameLookup {
  let idx = 0
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].year <= year) idx = i
  }
  return { frame: frames[idx], index: idx }
}

export function CategoryTreemap({ data }: Props) {
  const t = useTranslations('ch01.categoryTreemap')
  const locale = useLocale() as 'zh' | 'en'
  const reduced = usePrefersReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)

  const frames = data.frames
  const [frameIdx, setFrameIdx] = useState(frames.length - 1)
  const [playing, setPlaying] = useState(false)
  const [activeId, setActiveId] = useState<CategoryGroupKey | null>(null)
  const [pinnedId, setPinnedId] = useState<CategoryGroupKey | null>(null)

  const frame = frames[frameIdx]

  // Treemap layout for current frame
  const tiles: TileNode[] = useMemo(() => {
    const root = hierarchy<{ key?: CategoryGroupKey; value?: number; children?: { key: CategoryGroupKey; value: number }[] }>(
      {
        children: data.groupOrder.map(key => ({ key, value: frame.counts[key] })),
      },
    )
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const layout = treemap<typeof root.data>()
      .size([W, H])
      .tile(treemapSquarify.ratio(1.3))
      .paddingInner(3)
      .round(true)

    layout(root)
    return (root.leaves() as Array<typeof root & { x0: number; y0: number; x1: number; y1: number; data: { key: CategoryGroupKey; value: number } }>)
      .map(leaf => ({
        key: leaf.data.key,
        count: leaf.value ?? 0,
        x: leaf.x0,
        y: leaf.y0,
        w: leaf.x1 - leaf.x0,
        h: leaf.y1 - leaf.y0,
      }))
  }, [frame, data.groupOrder])

  // Auto-play stepping
  useEffect(() => {
    if (!playing || reduced) return
    const id = window.setInterval(() => {
      setFrameIdx(prev => {
        const next = prev + 1
        if (next >= frames.length) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, PLAY_STEP_MS)
    return () => window.clearInterval(id)
  }, [playing, reduced, frames.length])

  const closeAll = useCallback(() => {
    setActiveId(null)
    setPinnedId(null)
  }, [])

  // Outside-click + Escape unpins
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

  const onTileActivate = (key: CategoryGroupKey) => {
    setPinnedId(prev => (prev === key ? null : key))
  }

  const visibleId = pinnedId ?? activeId
  const activeTile = tiles.find(t => t.key === visibleId) ?? null

  // Slider position 0..frames.length-1
  const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value)
    setFrameIdx(next)
    closeAll()
  }

  const onSliderKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') {
      e.preventDefault()
      setPlaying(p => !p)
    }
    // Home/End already handled by native range input
  }

  const tickFrames = useMemo(
    () => frames
      .map((f, i) => ({ ...f, idx: i }))
      .filter(f => TICK_LABEL_YEARS.has(f.year)),
    [frames],
  )

  const ariaValueText = t('sliderAriaText', {
    year: frame.year,
    version: frame.versionLabel,
    total: frame.total,
  })

  return (
    <div className="relative" ref={containerRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {t('eyebrow')}
          </div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">
            {t('title')}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1 max-w-xl">
            {t('subtitle')}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {frame.total.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">
            {t('totalBy', { version: frame.versionLabel })}
          </div>
        </div>
      </div>

      {/* Slider row */}
      <div className="flex items-center gap-3 mb-2">
        {!reduced && (
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? t('pauseAria') : t('playAria')}
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[color:var(--accent-01)] text-white text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-01)]/50"
          >
            {playing ? '❚❚' : '▶'}
          </button>
        )}
        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            value={frameIdx}
            onChange={onSliderChange}
            onKeyDown={onSliderKey}
            aria-label={t('sliderLabel')}
            aria-valuemin={frames[0].year}
            aria-valuemax={frames[frames.length - 1].year}
            aria-valuenow={frame.year}
            aria-valuetext={ariaValueText}
            className="w-full accent-[color:var(--accent-01)]"
          />
          <div className="relative h-4 mt-0.5">
            {tickFrames.map(tf => {
              // Anchor first/last labels to their edges so they don't spill
              // outside the slider container (which causes ~14px right-edge
              // overflow when -translate-x-1/2 is applied at left:100%).
              const pct = (tf.idx / (frames.length - 1)) * 100
              const isFirst = tf.idx === 0
              const isLast  = tf.idx === frames.length - 1
              const xform = isFirst ? 'translate-x-0'
                         : isLast  ? '-translate-x-full'
                         : '-translate-x-1/2'
              return (
                <span
                  key={tf.versionId}
                  className={`absolute text-[10px] tabular font-bold text-[color:var(--muted)] ${xform}`}
                  style={{ left: `${pct}%` }}
                >
                  {tf.year}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Treemap */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label={t('ariaLabel', { year: frame.year, version: frame.versionLabel, total: frame.total })}
      >
        {tiles.map(tile => {
          const isActive = tile.key === visibleId
          const percent = (tile.count / frame.total) * 100
          const groupLabel = t(`groups.${tile.key}` as never)
          const glyph = frame.samples[tile.key]?.[0] ?? ''
          const hasText = tile.w >= 96 && tile.h >= 64
          // Approx label width: CJK glyphs are ~1em wide, Latin uppercase
          // bold + tracking averages ~0.95em per char. We use this to hide
          // the label (keeping just the count) when the tile is so narrow
          // the label would overflow horizontally.
          const isCJK = /[一-鿿]/.test(groupLabel)
          const labelEstWidth = isCJK
            ? groupLabel.length * 11
            : groupLabel.length * 9.5
          const canShowLabel = hasText && tile.w >= labelEstWidth + 16
          // Three layout tiers:
          //   - Wide (>= 200px AND label fits): single row, label left + count right
          //   - Narrow but label fits: stack label-on-top, count-below
          //   - Label can't fit: just count, centered
          const isWide = tile.w >= 200 && canShowLabel
          const isStacked = canShowLabel && !isWide
          const textBandH = !hasText ? 0 : isStacked ? 42 : 32
          // Emoji "stage" — the area above the text band that holds the glyph
          const stageH = Math.max(0, tile.h - textBandH)
          const stageCy = tile.y + stageH / 2 + (hasText ? -2 : 0)
          // Single hero glyph, auto-sized to whichever axis is tightest.
          const emojiSize = Math.max(
            18,
            Math.min(96, Math.floor(Math.min(stageH * 0.78, tile.w - 24))),
          )
          return (
            <motion.g
              key={tile.key}
              role="button"
              tabIndex={0}
              aria-label={t('tileAria', {
                group: groupLabel,
                count: tile.count,
                percent: percent.toFixed(1),
                version: frame.versionLabel,
              })}
              aria-expanded={isActive}
              className="cursor-pointer focus:outline-none"
              onMouseEnter={() => setActiveId(tile.key)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(tile.key)}
              onBlur={() => setActiveId(null)}
              onClick={(e) => {
                e.stopPropagation()
                onTileActivate(tile.key)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onTileActivate(tile.key)
                }
              }}
            >
              <motion.rect
                animate={{ x: tile.x, y: tile.y, width: tile.w, height: tile.h }}
                transition={{ duration: reduced ? 0 : ANIM_MS / 1000, ease: 'easeInOut' }}
                fill={`var(--cat-${tile.key})`}
                opacity={isActive ? 1 : 0.9}
                stroke={isActive ? 'var(--ink)' : 'transparent'}
                strokeWidth={isActive ? 2 : 0}
                rx={12}
              />
              {/* Single hero emoji */}
              {glyph && (
                <motion.text
                  animate={{ x: tile.x + tile.w / 2, y: stageCy }}
                  transition={{ duration: reduced ? 0 : ANIM_MS / 1000, ease: 'easeInOut' }}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={emojiSize}
                  pointerEvents="none"
                  aria-hidden="true"
                  style={{ fontVariantEmoji: 'emoji' }}
                >
                  {glyph}
                </motion.text>
              )}
              {hasText && (
                <>
                  {/* Subtle dark scrim under the text band for legibility */}
                  <motion.rect
                    animate={{
                      x: tile.x,
                      y: tile.y + tile.h - textBandH,
                      width: tile.w,
                      height: textBandH,
                    }}
                    transition={{ duration: reduced ? 0 : ANIM_MS / 1000, ease: 'easeInOut' }}
                    fill="black"
                    opacity={0.08}
                    pointerEvents="none"
                  />
                  {canShowLabel && (
                    <motion.text
                      animate={{
                        x: isStacked ? tile.x + tile.w / 2 : tile.x + 12,
                        y: tile.y + tile.h - (isStacked ? 26 : 11),
                      }}
                      transition={{ duration: reduced ? 0 : ANIM_MS / 1000, ease: 'easeInOut' }}
                      textAnchor={isStacked ? 'middle' : 'start'}
                      fontSize="10"
                      fontWeight="800"
                      letterSpacing="0.06em"
                      fill="#1a1a1a"
                      pointerEvents="none"
                      style={{ textTransform: 'uppercase' }}
                    >
                      {groupLabel}
                    </motion.text>
                  )}
                  <motion.text
                    animate={{
                      x: canShowLabel && isWide
                        ? tile.x + tile.w - 12
                        : tile.x + tile.w / 2,
                      y: tile.y + tile.h - (isStacked ? 9 : 11),
                    }}
                    transition={{ duration: reduced ? 0 : ANIM_MS / 1000, ease: 'easeInOut' }}
                    textAnchor={canShowLabel && isWide ? 'end' : 'middle'}
                    fontSize="12"
                    fontWeight="900"
                    className="tabular"
                    fill="#1a1a1a"
                    pointerEvents="none"
                  >
                    {tile.count.toLocaleString(locale)}
                    <tspan className="font-bold" fill="#3a3a3a" dx="6" fontSize="10">
                      {percent.toFixed(1)}%
                    </tspan>
                  </motion.text>
                </>
              )}
            </motion.g>
          )
        })}
      </svg>

      {/* Tooltip overlay */}
      {activeTile && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="pointer-events-auto absolute z-10 w-64 rounded-xl bg-white shadow-lg ring-1 ring-[color:var(--line)] p-3.5"
            style={{
              left: `${((activeTile.x + activeTile.w / 2) / W) * 100}%`,
              top: `${((activeTile.y + activeTile.h / 2) / H) * 100}%`,
              transform: `translate(${activeTile.x + activeTile.w / 2 > W * 0.6 ? 'calc(-100% - 12px)' : '12px'}, ${activeTile.y + activeTile.h / 2 < H * 0.4 ? '12px' : 'calc(-100% - 12px)'})`,
            }}
            role={pinnedId ? 'dialog' : 'tooltip'}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className="text-[10px] font-semibold tracking-wider uppercase"
                  style={{ color: `var(--cat-${activeTile.key})` }}
                >
                  {frame.versionLabel} · {frame.year}
                </div>
                <div className="text-sm font-semibold mt-0.5 text-[color:var(--ink)]">
                  {t(`groups.${activeTile.key}` as never)}
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
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
                  {t('tooltipCount')}
                </div>
                <div className="text-base font-semibold tabular text-[color:var(--ink)] leading-tight">
                  {activeTile.count.toLocaleString(locale)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
                  {t('tooltipPercent')}
                </div>
                <div
                  className="text-base font-semibold tabular leading-tight"
                  style={{ color: `var(--cat-${activeTile.key})` }}
                >
                  {((activeTile.count / frame.total) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5 text-lg leading-none">
              {frame.samples[activeTile.key]?.slice(0, 6).map((e, i) => (
                <span key={i}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] text-[color:var(--muted)]">
        <span>{t('caption')}</span>
        <Citation source={data.source} locale={locale} />
      </div>

      {/* Screen-reader summary of the current frame */}
      <details className="sr-only">
        <summary>{t('a11ySummary', { version: frame.versionLabel })}</summary>
        <ul>
          {data.groupOrder.map(k => (
            <li key={k}>
              {t(`groups.${k}` as never)}: {frame.counts[k].toLocaleString(locale)} ({((frame.counts[k] / frame.total) * 100).toFixed(1)}%)
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
