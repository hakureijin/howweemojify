'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
import { SankeyNodeVisual } from '@/components/chapter-01/SankeyNodeVisual'
import { usePrefersReducedMotion } from '@/lib/prefers-reduced-motion'
import { track, hoverStart, hoverEnd } from '@/lib/tracking'
import type {
  CategoryGroupKey,
  Chapter01VariantData,
  MechanismId,
} from '@/types/chapter-01'
import {
  buildSankey, beadGlyphs, beadSize, sankeyPath,
  SANKEY_W as W, SANKEY_H as H, SANKEY_PAD as PAD, NODE_WIDTH,
  type LaidLink, type LaidNode, type SankeyNodeIn,
} from '@/lib/charts/sankey'

type SelectionId = string // `mech::<id>` | `group::<id>` | `flow::<mech>::<group>`

interface Props {
  data: Chapter01VariantData
}

export function VariantSankey({ data }: Props) {
  const t = useTranslations('ch01.variantSankey')
  const groupT = useTranslations('ch01.categoryTreemap.groups')
  const locale = useLocale() as 'zh' | 'en'
  const reduced = usePrefersReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeId, setActiveId] = useState<SelectionId | null>(null)
  const [pinnedId, setPinnedId] = useState<SelectionId | null>(null)

  // Sankey nodes + links
  const layout = useMemo(
    () => buildSankey(data, id => t(`mechanisms.${id}.label` as never), g => groupT(g as never)),
    [data, t, groupT],
  )

  const visibleId = pinnedId ?? activeId

  const isLinkVisible = useCallback(
    (mech: MechanismId, group: CategoryGroupKey) => {
      if (!visibleId) return true
      if (visibleId === `mech::${mech}`) return true
      if (visibleId === `group::${group}`) return true
      if (visibleId === `flow::${mech}::${group}`) return true
      return false
    },
    [visibleId],
  )

  const isNodeVisible = useCallback(
    (node: SankeyNodeIn) => {
      if (!visibleId) return true
      if (visibleId === node.id) return true
      if (visibleId.startsWith('flow::')) {
        const [, mech, group] = visibleId.split('::')
        return node.id === `mech::${mech}` || node.id === `group::${group}`
      }
      // When a node is selected on one side, the opposite side dims unless connected
      const links = layout.links
      if (visibleId.startsWith('mech::')) {
        const reachable = new Set<string>()
        for (const l of links) {
          if (l.source.id === visibleId) reachable.add(l.target.id)
        }
        return node.id === visibleId || reachable.has(node.id)
      }
      if (visibleId.startsWith('group::')) {
        const reachable = new Set<string>()
        for (const l of links) {
          if (l.target.id === visibleId) reachable.add(l.source.id)
        }
        return node.id === visibleId || reachable.has(node.id)
      }
      return true
    },
    [visibleId, layout.links],
  )

  // Mirrors pinnedId so closeAll (stable, used by effects) can tell whether anything was open.
  const pinnedRef = useRef(pinnedId)
  useEffect(() => { pinnedRef.current = pinnedId }, [pinnedId])
  const closeAll = useCallback(() => {
    if (pinnedRef.current !== null) track('sankey', 'close')
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

  const onActivate = (id: SelectionId) => {
    track('sankey', pinnedId === id ? 'unpin' : 'pin', id)
    setPinnedId(prev => (prev === id ? null : id))
  }

  // Build tooltip data
  const tooltipData = useMemo(() => {
    if (!visibleId) return null
    if (visibleId.startsWith('flow::')) {
      const [, mech, group] = visibleId.split('::') as [string, MechanismId, CategoryGroupKey]
      const flow = data.flows.find(f => f.mechanism === mech && f.group === group)
      if (!flow) return null
      const mechMeta = data.mechanisms.find(m => m.id === mech)
      const link = layout.links.find(
        l => l.source.id === `mech::${mech}` && l.target.id === `group::${group}`,
      )
      const cy = link && link.y0 !== undefined && link.y1 !== undefined ? (link.y0 + link.y1) / 2 : H / 2
      return {
        kind: 'flow' as const,
        x: W / 2,
        y: cy,
        title: `${t(`mechanisms.${mech}.label` as never)} → ${groupT(group as never)}`,
        accentVar: `--mech-${mech}`,
        count: flow.count,
        share: flow.count / data.snapshot.total,
        shareOfMech: mechMeta ? flow.count / mechMeta.count : 0,
        examples: flow.examples,
        flipX: false,
      }
    }
    const node = layout.nodes.find(n => n.id === visibleId)
    if (!node) return null
    const accentVar =
      node.kind === 'mechanism' ? `--mech-${node.refId}` : `--cat-${node.refId}`
    return {
      kind: 'node' as const,
      x:
        node.kind === 'mechanism'
          ? PAD.left + NODE_WIDTH + 12
          : W - PAD.right - NODE_WIDTH - 12,
      y: (node.y0 + node.y1) / 2,
      title: node.label,
      accentVar,
      count: node.total,
      share: node.total / data.snapshot.total,
      shareOfMech: 0,
      examples: node.examples,
      flipX: node.kind === 'group',
    }
  }, [visibleId, layout, data, t, groupT])

  const closeTooltip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    closeAll()
  }, [closeAll])

  return (
    <div className="relative" ref={containerRef}>
      {/* Header */}
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle', {
          version: data.snapshot.versionLabel,
          total: data.snapshot.total.toLocaleString(locale),
        })}
        subtitleClassName="max-w-2xl"
        total={data.snapshot.total.toLocaleString(locale)}
        totalLabel={data.snapshot.versionLabel}
      />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label={t('ariaLabel', {
          total: data.snapshot.total,
          version: data.snapshot.versionLabel,
        })}
      >
        {/* Links */}
        <g>
          {layout.links.map((l: LaidLink, i) => {
            const id: SelectionId = `flow::${l.mechanism}::${l.group}`
            const isActive = visibleId === id
            const visible = isLinkVisible(l.mechanism, l.group)
            // Parent opacity controls overall visibility; ribbon and beads then
            // have their own multiplicative opacity so the emoji glyphs stay
            // crisp while the underlying ribbon is intentionally subtle.
            const groupOpacity = visible ? 1 : 0.18
            const ribbonOpacity = isActive ? 0.7 : 0.42
            return (
              <motion.g
                key={`l-${i}`}
                role="button"
                tabIndex={0}
                aria-label={t('flowAria', {
                  mechanism: t(`mechanisms.${l.mechanism}.label` as never),
                  group: groupT(l.group as never),
                  count: l.value,
                  percent: ((l.value / data.snapshot.total) * 100).toFixed(1),
                })}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => { setActiveId(id); hoverStart('sankey', id) }}
                onMouseLeave={() => { setActiveId(null); hoverEnd('sankey', id) }}
                onFocus={() => setActiveId(id)}
                onBlur={() => setActiveId(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(id)
                  }
                }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: groupOpacity }}
                transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : Math.min(i * 0.012, 0.6) }}
              >
                {/* Invisible hit overlay (twice the link thickness for easier targeting) */}
                <path
                  d={sankeyPath(l)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(l.width + 12, 18)}
                />
                {/* Visible ribbon — color-coded by mechanism, intentionally
                    subdued so the emoji beads above can carry the meaning. */}
                <path
                  d={sankeyPath(l)}
                  fill="none"
                  stroke={`var(--mech-${l.mechanism})`}
                  strokeWidth={Math.max(l.width, 0.5)}
                  opacity={ribbonOpacity}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Emoji beads — only rendered while this flow is hovered,
                    focused, or pinned. Keeps the default view clean. */}
                {isActive && beadGlyphs(l, data).map((b, j) => (
                  <motion.text
                    key={`b-${j}`}
                    x={b.x}
                    y={b.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={beadSize(l.width)}
                    pointerEvents="none"
                    aria-hidden="true"
                    style={{ fontVariantEmoji: 'emoji' }}
                    initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduced ? 0 : 0.18, delay: reduced ? 0 : j * 0.025, ease: 'easeOut' }}
                  >
                    {b.glyph}
                  </motion.text>
                ))}
              </motion.g>
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {layout.nodes.map((n: LaidNode) => {
            const isActive = visibleId === n.id
            const visible = isNodeVisible(n)
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={t('nodeAria', {
                  label: n.label,
                  count: n.total,
                  percent: ((n.total / data.snapshot.total) * 100).toFixed(1),
                })}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => { setActiveId(n.id); hoverStart('sankey', n.id) }}
                onMouseLeave={() => { setActiveId(null); hoverEnd('sankey', n.id) }}
                onFocus={() => setActiveId(n.id)}
                onBlur={() => setActiveId(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(n.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(n.id)
                  }
                }}
              >
                {/* Invisible 44 px hit area centered on node */}
                <rect
                  x={n.x0 - 8}
                  y={n.y0 - 4}
                  width={n.x1 - n.x0 + 16}
                  height={n.y1 - n.y0 + 8}
                  fill="transparent"
                />
                <SankeyNodeVisual
                  n={n}
                  locale={locale}
                  rectOpacity={visible ? (isActive ? 1 : 0.92) : 0.25}
                  labelOpacity={visible ? 1 : 0.35}
                  active={isActive}
                />
              </g>
            )
          })}
        </g>

        {/* Column headers (top-of-svg labels) */}
        <text
          x={PAD.left}
          y={12}
          fontSize="9"
          fontWeight="800"
          letterSpacing="0.15em"
          fill="var(--muted)"
        >
          {t('columnLeft')}
        </text>
        <text
          x={W - PAD.right}
          y={12}
          textAnchor="end"
          fontSize="9"
          fontWeight="800"
          letterSpacing="0.15em"
          fill="var(--muted)"
        >
          {t('columnRight')}
        </text>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="pointer-events-auto absolute z-10 w-72 rounded-xl bg-white shadow-lg ring-1 ring-[color:var(--line)] p-3.5"
            style={{
              left: `${(tooltipData.x / W) * 100}%`,
              top: `${(tooltipData.y / H) * 100}%`,
              transform: `translate(${tooltipData.flipX ? 'calc(-100% - 14px)' : '14px'}, calc(-50%))`,
            }}
            role={pinnedId ? 'dialog' : 'tooltip'}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className="text-[10px] font-semibold tracking-wider uppercase"
                  style={{ color: `var(${tooltipData.accentVar})` }}
                >
                  {tooltipData.kind === 'flow' ? t('flowEyebrow') : t('nodeEyebrow')}
                </div>
                <div className="text-sm font-semibold mt-0.5 text-[color:var(--ink)]">
                  {tooltipData.title}
                </div>
              </div>
              {pinnedId && (
                <button
                  onClick={closeTooltip}
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
                  {tooltipData.count.toLocaleString(locale)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">
                  {t('tooltipShare')}
                </div>
                <div
                  className="text-base font-semibold tabular leading-tight"
                  style={{ color: `var(${tooltipData.accentVar})` }}
                >
                  {(tooltipData.share * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            {tooltipData.kind === 'flow' && tooltipData.shareOfMech > 0 && (
              <div className="mt-2 text-[10px] text-[color:var(--muted)]">
                {t('tooltipShareOfMech', { percent: (tooltipData.shareOfMech * 100).toFixed(1) })}
              </div>
            )}
            {tooltipData.examples.length > 0 && (
              <div className="mt-3 flex gap-1.5 text-lg leading-none">
                {tooltipData.examples.slice(0, 6).map((e, i) => (
                  <span key={i}>{e}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] text-[color:var(--muted)]">
        <span className="max-w-2xl">{t('caption')}</span>
        <Citation source={data.source} locale={locale} />
      </div>

      <details className="sr-only">
        <summary>{t('a11ySummary', { version: data.snapshot.versionLabel })}</summary>
        <ul>
          {data.mechanisms.map(m => (
            <li key={m.id}>
              {t(`mechanisms.${m.id}.label` as never)}: {m.count.toLocaleString(locale)} ({(m.share * 100).toFixed(1)}%)
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
