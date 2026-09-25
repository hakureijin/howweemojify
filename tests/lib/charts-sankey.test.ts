import { describe, it, expect } from 'vitest'
import { buildSankey, beadCount, beadSize, beadGlyphs, sampleSankeyCurve, sankeyPath } from '@/lib/charts/sankey'
import v from '@/data/chapter-01-variants.json'
import type { Chapter01VariantData } from '@/types/chapter-01'

const data = v as Chapter01VariantData
const layout = buildSankey(data, id => id, g => g)

describe('buildSankey', () => {
  it('lays out 8 mechanisms + 9 groups and every flow', () => {
    expect(layout.nodes).toHaveLength(17)
    expect(layout.links).toHaveLength(data.flows.length)
    expect(layout.links).toHaveLength(22)
    for (const l of layout.links) {
      expect(l.width).toBeGreaterThan(0)
      expect(sankeyPath(l).startsWith('M')).toBe(true)
    }
  })
})

describe('beads', () => {
  it('beadCount grows with log2 and is clamped to [1, 10]', () => {
    expect(beadCount(0)).toBe(1)
    expect(beadCount(1600)).toBe(9)
    expect(beadCount(1e9)).toBe(10)
  })
  it('beadSize is clamped to [13, 22]', () => {
    expect(beadSize(1)).toBe(13)
    expect(beadSize(100)).toBe(22)
  })
  it('sampleSankeyCurve returns n points strictly between the nodes', () => {
    const l = layout.links[0]
    const pts = sampleSankeyCurve(l, 4)
    expect(pts).toHaveLength(4)
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(l.source.x1)
      expect(p.x).toBeLessThan(l.target.x0)
    }
  })
  it('beadGlyphs yields beadCount glyphs cycled from the flow examples', () => {
    for (const l of layout.links) {
      const beads = beadGlyphs(l, data)
      if (l.examples.length === 0) continue
      expect(beads).toHaveLength(beadCount(l.value))
      expect(beads[0].glyph).toBe(l.examples[0])
    }
  })
})
