import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import type { CategoryGroupKey, Chapter01VariantData, MechanismId } from '@/types/chapter-01'

export const SANKEY_W = 880
export const SANKEY_H = 520
export const SANKEY_PAD = { top: 24, right: 12, bottom: 24, left: 12 }
export const NODE_WIDTH = 16
const NODE_PADDING = 12

export type NodeKind = 'mechanism' | 'group'

export interface SankeyNodeIn {
  id: string
  kind: NodeKind
  refId: MechanismId | CategoryGroupKey
  label: string
  total: number
  examples: string[]
}

export interface SankeyLinkIn {
  source: string
  target: string
  value: number
  mechanism: MechanismId
  group: CategoryGroupKey
  examples: string[]
}

export type LaidNode = SankeyNodeIn & { x0: number; x1: number; y0: number; y1: number; value: number }
export type LaidLink = Omit<SankeyLinkIn, 'source' | 'target'> & {
  source: LaidNode
  target: LaidNode
  width: number
  y0: number
  y1: number
}

export function buildSankey(
  data: Chapter01VariantData,
  mechLabel: (id: MechanismId) => string,
  groupLabel: (g: CategoryGroupKey) => string,
): { nodes: LaidNode[]; links: LaidLink[] } {
  // Filter mechanisms / groups with count > 0 to avoid empty nodes
  const activeMechanisms = data.mechanisms.filter(m => m.count > 0)
  const activeGroups = data.groupOrder
    .map(g => ({ g, total: data.flows.filter(f => f.group === g).reduce((acc, f) => acc + f.count, 0) }))
    .filter(x => x.total > 0)

  const nodes: SankeyNodeIn[] = [
    ...activeMechanisms.map(m => ({
      id: `mech::${m.id}`,
      kind: 'mechanism' as const,
      refId: m.id,
      label: mechLabel(m.id),
      total: m.count,
      examples: m.examples,
    })),
    ...activeGroups.map(({ g, total }) => ({
      id: `group::${g}`,
      kind: 'group' as const,
      refId: g,
      label: groupLabel(g),
      total,
      examples: data.flows.filter(f => f.group === g).flatMap(f => f.examples).slice(0, 6),
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

  const graph = sankey<SankeyNodeIn, SankeyLinkIn>()
    .nodeId(d => d.id)
    .nodeAlign(node => (node.kind === 'mechanism' ? 0 : 1))
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .extent([
      [SANKEY_PAD.left, SANKEY_PAD.top],
      [SANKEY_W - SANKEY_PAD.right, SANKEY_H - SANKEY_PAD.bottom],
    ])({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) })

  return { nodes: graph.nodes as unknown as LaidNode[], links: graph.links as unknown as LaidLink[] }
}

const linkHorizontal = sankeyLinkHorizontal()

export function sankeyPath(l: LaidLink): string {
  return linkHorizontal(l as never) ?? ''
}

// Sample N points along the cubic Bézier that d3-sankey's sankeyLinkHorizontal
// draws between two nodes. The curve has control points at (midX, y0) and
// (midX, y1) — y interpolates as a smoothstep, x as a cubic. Returns evenly
// spaced points at t = 1/(N+1), 2/(N+1), …, N/(N+1), so the first and last
// beads sit comfortably inside the link rather than on the node edges.
export function sampleSankeyCurve(
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
export function beadCount(value: number): number {
  return Math.max(1, Math.min(10, Math.round(Math.log2(value + 1) * 0.85)))
}

export function beadSize(width: number): number {
  return Math.max(13, Math.min(22, width * 0.55))
}

/** Bead positions along a flow, with glyphs cycled from its examples. */
export function beadGlyphs(link: LaidLink, data: Chapter01VariantData): Array<{ x: number; y: number; glyph: string }> {
  const examples = link.examples.length
    ? link.examples
    : data.flows.find(f => f.mechanism === link.mechanism && f.group === link.group)?.examples ?? []
  if (examples.length === 0) return []
  return sampleSankeyCurve(link, beadCount(link.value)).map((p, j) => ({ ...p, glyph: examples[j % examples.length] }))
}
