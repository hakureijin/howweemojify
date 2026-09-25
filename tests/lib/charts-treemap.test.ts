import { describe, it, expect } from 'vitest'
import { layoutTreemap, tileTextLayout, sampleRuns, TREEMAP_W, TREEMAP_H } from '@/lib/charts/treemap'
import cat from '@/data/chapter-01-categories.json'
import type { Chapter01CategoryData } from '@/types/chapter-01'

const data = cat as Chapter01CategoryData
const latest = data.frames[data.frames.length - 1]

describe('layoutTreemap', () => {
  it('returns one tile per group inside the requested box', () => {
    const tiles = layoutTreemap(latest, data.groupOrder)
    expect(tiles).toHaveLength(9)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x + t.w).toBeLessThanOrEqual(TREEMAP_W)
      expect(t.y + t.h).toBeLessThanOrEqual(TREEMAP_H)
      expect(t.count).toBe(latest.counts[t.key])
    }
  })
  it('honours a custom size', () => {
    const tiles = layoutTreemap(latest, data.groupOrder, 280, 146)
    expect(Math.max(...tiles.map(t => t.x + t.w))).toBeLessThanOrEqual(280)
  })
})

describe('tileTextLayout tiers', () => {
  const tile = (w: number, h: number) => ({ key: 'objects' as const, count: 1, x: 0, y: 0, w, h })
  it('wide tile with fitting label → single row', () => {
    const L = tileTextLayout(tile(300, 200), 'Objects')
    expect(L.isWide).toBe(true)
    expect(L.countAnchor).toBe('end')
  })
  it('narrow tile with fitting label → stacked', () => {
    const L = tileTextLayout(tile(150, 100), '物品')
    expect(L.isStacked).toBe(true)
    expect(L.textBandH).toBe(42)
  })
  it('label too long → count only', () => {
    const L = tileTextLayout(tile(122, 100), 'Smileys & Emotion')
    expect(L.hasText).toBe(true)
    expect(L.canShowLabel).toBe(false)
    expect(L.countAnchor).toBe('middle')
  })
  it('tiny tile → no text band', () => {
    expect(tileTextLayout(tile(80, 50), 'Flags').hasText).toBe(false)
  })
})

describe('sampleRuns', () => {
  it('merges consecutive frames with identical sample sets', () => {
    const runs = sampleRuns(data.frames, 'smileys-emotion')
    expect(runs).toHaveLength(2)
    expect(runs[0]).toMatchObject({ fromLabel: 'Unicode 6.0', toLabel: 'Unicode 7.0' })
    expect(runs[1]).toMatchObject({ fromLabel: 'Unicode 8.0', toLabel: latest.versionLabel })
    expect(runs[1].samples).toHaveLength(6)
  })
  it('covers every frame exactly once', () => {
    for (const key of data.groupOrder) {
      const runs = sampleRuns(data.frames, key)
      expect(runs[0].fromLabel).toBe(data.frames[0].versionLabel)
      expect(runs[runs.length - 1].toLabel).toBe(latest.versionLabel)
    }
  })
})
