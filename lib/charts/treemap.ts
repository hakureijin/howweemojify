import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import type { CategoryFrame, CategoryGroupKey } from '@/types/chapter-01'

export const TREEMAP_W = 880
export const TREEMAP_H = 460

export interface TileNode {
  key: CategoryGroupKey
  count: number
  x: number
  y: number
  w: number
  h: number
}

export function layoutTreemap(
  frame: CategoryFrame,
  groupOrder: CategoryGroupKey[],
  w: number = TREEMAP_W,
  h: number = TREEMAP_H,
): TileNode[] {
  const root = hierarchy<{ key?: CategoryGroupKey; value?: number; children?: { key: CategoryGroupKey; value: number }[] }>(
    { children: groupOrder.map(key => ({ key, value: frame.counts[key] })) },
  )
    .sum(d => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  treemap<typeof root.data>().size([w, h]).tile(treemapSquarify.ratio(1.3)).paddingInner(3).round(true)(root)

  return (root.leaves() as Array<typeof root & { x0: number; y0: number; x1: number; y1: number; data: { key: CategoryGroupKey; value: number } }>)
    .map(leaf => ({
      key: leaf.data.key,
      count: leaf.value ?? 0,
      x: leaf.x0,
      y: leaf.y0,
      w: leaf.x1 - leaf.x0,
      h: leaf.y1 - leaf.y0,
    }))
}

export interface TileText {
  hasText: boolean
  canShowLabel: boolean
  isWide: boolean
  isStacked: boolean
  textBandH: number
  stageCy: number
  emojiSize: number
  labelX: number
  labelY: number
  labelAnchor: 'start' | 'middle'
  countX: number
  countY: number
  countAnchor: 'end' | 'middle'
}

/** Where the hero glyph, group label and count go inside one tile. */
export function tileTextLayout(tile: TileNode, groupLabel: string): TileText {
  const hasText = tile.w >= 96 && tile.h >= 64
  // Approx label width: CJK glyphs are ~1em wide, Latin uppercase bold +
  // tracking averages ~0.95em per char. Used to hide the label (keeping just
  // the count) when the tile is so narrow the label would overflow.
  const isCJK = /[一-鿿]/.test(groupLabel)
  const labelEstWidth = isCJK ? groupLabel.length * 11 : groupLabel.length * 9.5
  const canShowLabel = hasText && tile.w >= labelEstWidth + 16
  // Three layout tiers:
  //   - Wide (>= 200px AND label fits): single row, label left + count right
  //   - Narrow but label fits: stack label-on-top, count-below
  //   - Label can't fit: just count, centered
  const isWide = tile.w >= 200 && canShowLabel
  const isStacked = canShowLabel && !isWide
  const textBandH = !hasText ? 0 : isStacked ? 42 : 32
  const stageH = Math.max(0, tile.h - textBandH)
  const stageCy = tile.y + stageH / 2 + (hasText ? -2 : 0)
  const emojiSize = Math.max(18, Math.min(96, Math.floor(Math.min(stageH * 0.78, tile.w - 24))))
  return {
    hasText,
    canShowLabel,
    isWide,
    isStacked,
    textBandH,
    stageCy,
    emojiSize,
    labelX: isStacked ? tile.x + tile.w / 2 : tile.x + 12,
    labelY: tile.y + tile.h - (isStacked ? 26 : 11),
    labelAnchor: isStacked ? 'middle' : 'start',
    countX: isWide ? tile.x + tile.w - 12 : tile.x + tile.w / 2,
    countY: tile.y + tile.h - (isStacked ? 9 : 11),
    countAnchor: isWide ? 'end' : 'middle',
  }
}

export interface FrameLookup {
  frame: CategoryFrame
  index: number
}

/** Pick the frame whose year is closest to (but not exceeding) the requested year. */
export function frameAt(frames: CategoryFrame[], year: number): FrameLookup {
  let idx = 0
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].year <= year) idx = i
  }
  return { frame: frames[idx], index: idx }
}

export interface SampleRun {
  fromLabel: string
  toLabel: string
  samples: string[]
}

/** Lossless compaction of the per-frame tooltip samples: consecutive frames
 *  showing the same first-n samples collapse into one version range. */
export function sampleRuns(frames: CategoryFrame[], key: CategoryGroupKey, n = 6): SampleRun[] {
  const runs: SampleRun[] = []
  for (const f of frames) {
    const samples = (f.samples[key] ?? []).slice(0, n)
    const last = runs[runs.length - 1]
    if (last && last.samples.join('\u0000') === samples.join('\u0000')) last.toLabel = f.versionLabel
    else runs.push({ fromLabel: f.versionLabel, toLabel: f.versionLabel, samples })
  }
  return runs
}
