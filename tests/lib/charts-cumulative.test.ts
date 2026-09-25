import { describe, it, expect } from 'vitest'
import {
  buildSeries, buildGeometry, computeVersionDiff,
  CUM_W, CUM_PAD, RANGE_START, DEFAULT_FROM_ID, DEFAULT_TO_ID,
} from '@/lib/charts/cumulative'
import ch01 from '@/data/chapter-01.json'
import type { TimelineNode } from '@/types/chapter-01'

const timeline = ch01.timeline as TimelineNode[]
const contributing = timeline.filter(n => n.newEmojiCount !== null)

describe('buildSeries', () => {
  it('keeps only versions with a newEmojiCount and accumulates totals', () => {
    const s = buildSeries(timeline)
    expect(s).toHaveLength(contributing.length)
    expect(s).toHaveLength(15)
    const sum = contributing.reduce((a, n) => a + (n.newEmojiCount ?? 0), 0)
    expect(s[s.length - 1].runningTotal).toBe(sum)
    expect(s[0].previousTotal).toBe(0)
    expect(s[0].growthPct).toBe(0)
    expect(s[1].growthPct).toBeCloseTo((s[1].node.newEmojiCount / s[0].runningTotal) * 100)
  })
})

describe('buildGeometry', () => {
  const s = buildSeries(timeline)

  it('full range: every version is a point and the pre-2010 stretch is compressed', () => {
    const g = buildGeometry(s, ch01.decadeIndex, RANGE_START.all)
    expect(g.points).toHaveLength(15)
    const chartWidth = CUM_W - CUM_PAD.l - CUM_PAD.r
    expect(g.xScale(2010)).toBeCloseTo(CUM_PAD.l + chartWidth * 0.22)
    expect(g.pathLine.startsWith('M')).toBe(true)
    expect(g.maxYear).toBe(Math.max(...contributing.map(n => n.year)))
  })

  it('since-2015: only 2015+ points, first point on the left edge', () => {
    const g = buildGeometry(s, ch01.decadeIndex, RANGE_START['since-2015'])
    expect(g.points.every(p => p.year >= 2015)).toBe(true)
    expect(g.points).toHaveLength(s.filter(d => d.node.year >= 2015).length)
    expect(g.points[0].cx).toBeCloseTo(CUM_PAD.l)
  })

  it('flags decade-anchor years as flagship', () => {
    const g = buildGeometry(s, ch01.decadeIndex, RANGE_START.all)
    for (const p of g.points) expect(p.flagship).toBe(ch01.decadeIndex.includes(p.year))
  })
})

describe('computeVersionDiff default pair', () => {
  it('resolves 6.0 → 17.0', () => {
    const d = computeVersionDiff(buildSeries(timeline), DEFAULT_FROM_ID, DEFAULT_TO_ID)
    expect(d?.fromNode.node.id).toBe('emoji-6-0')
    expect(d?.toNode.node.id).toBe('emoji-17-0')
  })
})
