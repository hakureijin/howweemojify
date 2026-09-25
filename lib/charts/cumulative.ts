import { scaleLinear, type ScaleLinear } from 'd3-scale'
import { line, area, curveMonotoneX } from 'd3-shape'
import type { TimelineNode } from '@/types/chapter-01'

export const CUM_W = 880
export const CUM_H = 440
export const CUM_PAD = { l: 64, r: 24, t: 32, b: 48 }

// The 1999–2010 stretch only has 2 contributing versions (DoCoMo, Unicode 6.0); a
// linear x-axis gives it ~41% of the chart width and crams every Unicode/Emoji
// version from 2014 onward into the remainder. When the visible range includes
// the pre-2010 segment, we compress it to COMPRESS_PRE_WEIGHT of the width so the
// dense high-growth era can breathe.
const COMPRESS_BREAK_YEAR = 2010
const COMPRESS_PRE_WEIGHT = 0.22

export type RangeId = 'all' | 'since-2015' | 'since-2020'

export const RANGE_START: Record<RangeId, number> = {
  'all': 1999,
  'since-2015': 2015,
  'since-2020': 2020,
}

export const DEFAULT_FROM_ID = 'emoji-6-0'
export const DEFAULT_TO_ID = 'emoji-17-0'

export type ContributingNode = TimelineNode & { newEmojiCount: number }

export interface EnrichedNode {
  node: ContributingNode
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

export interface ChartPoint extends ContributingNode {
  runningTotal: number
  previousTotal: number
  growthPct: number
  flagship: boolean
  cx: number
  cy: number
}

export interface CumulativeGeometry {
  points: ChartPoint[]
  pathLine: string
  pathArea: string
  yTicks: number[]
  xScale: (year: number) => number
  yScale: ScaleLinear<number, number>
  xLabels: number[]
  maxYear: number
}

/** Every version that contributed new emoji, with running totals. */
export function buildSeries(timeline: TimelineNode[]): EnrichedNode[] {
  const contributing = timeline.filter((n): n is ContributingNode => n.newEmojiCount !== null)
  let running = 0
  return contributing.map(n => {
    const previousTotal = running
    running += n.newEmojiCount
    const growthPct = previousTotal === 0 ? 0 : (n.newEmojiCount / previousTotal) * 100
    return { node: n, runningTotal: running, previousTotal, growthPct }
  })
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

export function buildGeometry(
  series: EnrichedNode[],
  decadeIndex: number[],
  rangeStart: number,
): CumulativeGeometry {
  const decadeSet = new Set(decadeIndex)
  const maxYear = Math.max(...series.map(d => d.node.year))
  const chartLeft = CUM_PAD.l
  const chartRight = CUM_W - CUM_PAD.r
  const chartWidth = chartRight - chartLeft

  let xScale: (year: number) => number
  if (rangeStart < COMPRESS_BREAK_YEAR) {
    const breakX = chartLeft + chartWidth * COMPRESS_PRE_WEIGHT
    const leftScale = scaleLinear().domain([rangeStart, COMPRESS_BREAK_YEAR]).range([chartLeft, breakX])
    const rightScale = scaleLinear()
      .domain([COMPRESS_BREAK_YEAR, Math.max(maxYear, COMPRESS_BREAK_YEAR + 1)])
      .range([breakX, chartRight])
    xScale = (year: number) => (year <= COMPRESS_BREAK_YEAR ? leftScale(year) : rightScale(year))
  } else {
    const linear = scaleLinear().domain([rangeStart, Math.max(maxYear, rangeStart + 1)]).range([chartLeft, chartRight])
    xScale = (year: number) => linear(year)
  }

  const yMax = Math.max(...series.map(d => d.runningTotal), 1) * 1.06
  const yScale = scaleLinear().domain([0, yMax]).nice().range([CUM_H - CUM_PAD.b, CUM_PAD.t])

  const toPoint = (d: EnrichedNode): ChartPoint => ({
    ...d.node,
    runningTotal: d.runningTotal,
    previousTotal: d.previousTotal,
    growthPct: d.growthPct,
    flagship: decadeSet.has(d.node.year),
    cx: xScale(d.node.year),
    cy: yScale(d.runningTotal),
  })

  const points = series.filter(d => d.node.year >= rangeStart).map(toPoint)

  // Predecessor anchor: the last point BEFORE the visible range — used so the line/area
  // visually "enters from the left" instead of starting with a triangle wedge.
  const predecessor = series.filter(d => d.node.year < rangeStart).slice(-1)[0]
  const pathPoints = predecessor ? [toPoint(predecessor), ...points] : points
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

  const xLabels = Array.from(new Set([rangeStart, ...decadeIndex.filter(y => y >= rangeStart), maxYear]))
    .filter(y => y >= rangeStart)
    .sort((x, y) => x - y)

  return {
    points,
    pathLine: l(seriesPts) || '',
    pathArea: a(seriesPts) || '',
    yTicks: yScale.ticks(4),
    xScale,
    yScale,
    xLabels,
    maxYear,
  }
}
