'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { usePrefersReducedMotion } from '@/lib/prefers-reduced-motion'
import type {
  CategoryGroupKey,
  Chapter01VariantData,
  MechanismId,
} from '@/types/chapter-01'

const W = 880
const H = 520
const PAD = { top: 24, right: 12, bottom: 24, left: 12 }
const NODE_WIDTH = 16
const NODE_PADDING = 12

// Sample N points along the cubic Bézier that d3-sankey's sankeyLinkHorizontal
// draws between two nodes. The curve has control points at (midX, y0) and
// (midX, y1) — y interpolates as a smoothstep, x as a cubic. Returns evenly
// spaced points at t = 1/(N+1), 2/(N+1), …, N/(N+1), so the first and last
// beads sit comfortably inside the link rather than on the node edges.
function sampleSankeyCurve(
  link: { source: { x1: number }; target: { x0: number }; y0?: number; y1?: number },
  n: number,
): Array<{ x: number; y: number }> {
  const x0 = link.source.x1
  const x1 = link.target.x0
  const y0 = link.y0 ?? 0
  const y1 = link.y1 ?? 0
  const midX = (x0 + x1) / 2
  const out: Array<{ x: number; y: number }> = []
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1)
    const u = 1 - t
    const x = u * u * u * x0 + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * x1
    const y = y0 + (y1 - y0) * (3 * t * t - 2 * t * t * t)
    out.push({ x, y })
  }
  return out
}

// Bead count grows with log2(value): a flow of ~1600 emoji gets ~9 beads,
// ~100 gets ~6, ~20 gets ~4, single-digit flows get 1–2. Capped at 10 so the
// largest flows don't get visually noisy.
function beadCount(value: number): number {
  return Math.max(1, Math.min(10, Math.round(Math.log2(value + 1) * 0.85)))
}

type NodeKind = 'mechanism' | 'group'
type SelectionId = string // `mech::<id>` | `group::<id>` | `flow::<mech>::<group>`

interface SankeyNodeIn {
  id: string
  kind: NodeKind
  refId: MechanismId | CategoryGroupKey
  label: string
  total: number
  examples: string[]
}

interface SankeyLinkIn {
  source: string
  target: string
  value: number
  mechanism: MechanismId
  group: CategoryGroupKey
  examples: string[]
}

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
  const layout = useMemo(() => {
    // Filter mechanisms with count > 0 to avoid empty nodes
    const activeMechanisms = data.mechanisms.filter(m => m.count > 0)
    const activeGroups = data.groupOrder
      .map(g => ({
        g,
        total: data.flows
          .filter(f => f.group === g)
          .reduce((acc, f) => acc + f.count, 0),
      }))
      .filter(x => x.total > 0)

    const nodes: SankeyNodeIn[] = [
      ...activeMechanisms.map(m => ({
        id: `mech::${m.id}`,
        kind: 'mechanism' as const,
        refId: m.id,
        label: t(`mechanisms.${m.id}.label` as never),
        total: m.count,
        examples: m.examples,
      })),
      ...activeGroups.map(({ g, total }) => ({
        id: `group::${g}`,
        kind: 'group' as const,
        refId: g,
        label: groupT(g as never),
        total,
        examples: data.flows
          .filter(f => f.group === g)
          .flatMap(f => f.examples)
          .slice(0, 6),
      })),
    ]

    const links: SankeyLinkIn[] = data.flows.map(f => ({
      source: `mech::${f.mechanism}`,
      target: `group::${f.group}`,
      value: f.count,
      mechanism: f.mechanism,
      group: f.group,
      examples: f.examples,
    }))

    const generator = sankey<SankeyNodeIn, SankeyLinkIn>()
      .nodeId(d => d.id)
      .nodeAlign(node => (node.kind === 'mechanism' ? 0 : 1))
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .extent([
        [PAD.left, PAD.top],
        [W - PAD.right, H - PAD.bottom],
      ])

    const graph = generator({
      nodes: nodes.map(n => ({ ...n })),
      links: links.map(l => ({ ...l })),
    })

    return graph
  }, [data, t, groupT])

  const linkPath = useMemo(() => sankeyLinkHorizontal<SankeyNodeIn, SankeyLinkIn>(), [])

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
      const links = layout.links as Array<{ source: SankeyNodeIn; target: SankeyNodeIn }>
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

  const onActivate = (id: SelectionId) => {
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
      const link = (layout.links as Array<{
        source: SankeyNodeIn
        target: SankeyNodeIn
        y0?: number
        y1?: number
      }>).find(
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
    const node = (layout.nodes as SankeyNodeIn[]).find(n => n.id === visibleId)
    if (!node) return null
    const accentVar =
      node.kind === 'mechanism' ? `--mech-${node.refId}` : `--cat-${node.refId}`
    return {
      kind: 'node' as const,
      x:
        node.kind === 'mechanism'
          ? PAD.left + NODE_WIDTH + 12
          : W - PAD.right - NODE_WIDTH - 12,
      y:
        (((node as unknown as { y0?: number }).y0 ?? 0) +
          ((node as unknown as { y1?: number }).y1 ?? 0)) /
        2,
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {t('eyebrow')}
          </div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">
            {t('title')}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1 max-w-2xl">
            {t('subtitle', {
              version: data.snapshot.versionLabel,
              total: data.snapshot.total.toLocaleString(locale),
            })}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {data.snapshot.total.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">
            {data.snapshot.versionLabel}
          </div>
        </div>
      </div>

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
          {(layout.links as Array<
            SankeyLinkIn & {
              source: SankeyNodeIn & { x1: number }
              target: SankeyNodeIn & { x0: number }
              width: number
              y0: number
              y1: number
            }
          >).map((l, i) => {
            const id: SelectionId = `flow::${l.mechanism}::${l.group}`
            const isActive = visibleId === id
            const visible = isLinkVisible(l.mechanism, l.group)
            // Parent opacity controls overall visibility; ribbon and beads then
            // have their own multiplicative opacity so the emoji glyphs stay
            // crisp while the underlying ribbon is intentionally subtle.
            const groupOpacity = visible ? 1 : 0.18
            const ribbonOpacity = isActive ? 0.7 : 0.42
            // Bead positions + sizing
            const n = beadCount(l.value)
            const positions = sampleSankeyCurve(l, n)
            const beadSize = Math.max(13, Math.min(22, l.width * 0.55))
            const examples = l.examples.length ? l.examples : data.flows.find(f => f.mechanism === l.mechanism && f.group === l.group)?.examples ?? []
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
                onMouseEnter={() => setActiveId(id)}
                onMouseLeave={() => setActiveId(null)}
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
                  d={linkPath(l) ?? ''}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(l.width + 12, 18)}
                />
                {/* Visible ribbon — color-coded by mechanism, intentionally
                    subdued so the emoji beads above can carry the meaning. */}
                <path
                  d={linkPath(l) ?? ''}
                  fill="none"
                  stroke={`var(--mech-${l.mechanism})`}
                  strokeWidth={Math.max(l.width, 0.5)}
                  opacity={ribbonOpacity}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Emoji beads — only rendered while this flow is hovered,
                    focused, or pinned. Keeps the default view clean. */}
                {isActive && positions.map((p, j) => {
                  const glyph = examples[j % Math.max(examples.length, 1)] || ''
                  if (!glyph) return null
                  return (
                    <motion.text
                      key={`b-${j}`}
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={beadSize}
                      pointerEvents="none"
                      aria-hidden="true"
                      style={{ fontVariantEmoji: 'emoji' }}
                      initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: reduced ? 0 : 0.18, delay: reduced ? 0 : j * 0.025, ease: 'easeOut' }}
                    >
                      {glyph}
                    </motion.text>
                  )
                })}
              </motion.g>
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {(layout.nodes as Array<
            SankeyNodeIn & { x0: number; x1: number; y0: number; y1: number; value: number }
          >).map(n => {
            const isActive = visibleId === n.id
            const visible = isNodeVisible(n)
            const accentVar =
              n.kind === 'mechanism' ? `--mech-${n.refId}` : `--cat-${n.refId}`
            const labelX = n.kind === 'mechanism' ? n.x1 + 8 : n.x0 - 8
            const labelAnchor = n.kind === 'mechanism' ? 'start' : 'end'
            const labelY = (n.y0 + n.y1) / 2
            const nodeHeight = n.y1 - n.y0
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
                onMouseEnter={() => setActiveId(n.id)}
                onMouseLeave={() => setActiveId(null)}
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
                <rect
                  x={n.x0}
                  y={n.y0}
                  width={n.x1 - n.x0}
                  height={Math.max(nodeHeight, 1)}
                  rx={3}
                  fill={`var(${accentVar})`}
                  opacity={visible ? (isActive ? 1 : 0.92) : 0.25}
                  stroke={isActive ? 'var(--ink)' : 'none'}
                  strokeWidth={isActive ? 1.5 : 0}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor}
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="800"
                  fill="var(--ink)"
                  opacity={visible ? 1 : 0.35}
                  pointerEvents="none"
                  className="tabular"
                >
                  {n.label}
                  <tspan
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--muted)"
                    dx="6"
                  >
                    {n.total.toLocaleString(locale)}
                  </tspan>
                </text>
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
