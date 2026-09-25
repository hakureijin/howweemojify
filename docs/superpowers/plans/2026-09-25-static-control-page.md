# 静态对照页 + 实验行为记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/{zh,en}/static/` 静态对照页（与交互版信息严格对等、无交互、无动画），并加入仅在实验构建中启用的行为记录与一个零依赖的 Node 实验服务器。

**Architecture:** 先把四张交互图里的纯计算（比例尺、布局、标签分档、投影）抽到 `lib/charts/*`，交互版改为调用它们（纯重构）；静态组件放在 `components/static/`，复用同一套几何与部分展示组件，把 tooltip/滑块/缩放背后的信息摊成标注、小多图、局部放大图与表格。行为记录是 `lib/tracking*.ts` + `<TrackingRoot>`，由构建期变量 `NEXT_PUBLIC_EXPERIMENT=1` 开启；`scripts/experiment-server.mjs` 托管 `out/` 并把 `POST /api/log` 追加写入 JSONL。

**Tech Stack:** Next.js 15（`output: 'export'`）· React 19 · next-intl 4 · d3-scale/shape/hierarchy/sankey/geo · Framer Motion · GSAP · Vitest + Testing Library（jsdom）· Node 22 内置 `http`/`fs` · Python Playwright（仅冒烟脚本）

**Spec:** `docs/superpowers/specs/2026-09-25-static-control-page-design.md`

## Global Constraints

- 严格对等：静态版与交互版配色、字体、图表形态、章节顺序、文案一致；只把"需要操作才看得到"的信息摊开，不增不减。
- 静态版无任何动画、无可操作控件。允许的元素只有：导航章节锚点、参考文献/来源外链、公开构建中的语言切换按钮。
- 操作提示类文案在静态版用 `static.*` 下去掉操作指引的版本替代（见 spec）。
- 静态版路由 `app/[locale]/static/page.tsx` → `out/{zh,en}/static/index.html`；两版互不链接；根路径跳转不变。
- 实验构建：`NEXT_PUBLIC_EXPERIMENT=1`，不设 `GITHUB_PAGES`（无 basePath）。公开构建中 `track()` 等为空操作，不发任何请求。
- 实验构建下两版都去掉语言切换；公开构建两版都保留。
- 地图 topojson 必须经 `withBasePath()` 请求（basePath 下漏前缀会静默塌成空白地图）。
- 统一区块 ID：`hero`、`ch01-cumulative`、`ch01-treemap`、`ch01-sankey`、`ch02-pipeline`、`ch02-criteria`、`ch02-cases`、`ch02-map`、`footer`。
- 服务器：仅 Node 内置模块；`POST /api/log` 请求体须为 JSON 对象数组、≤ 100 条、≤ 64 KB，否则 400；写入 `logs/events-YYYY-MM-DD.jsonl`（UTC 日期）；`GET /api/health` → `200 ok`；监听 `0.0.0.0:${PORT ?? 7777}`；`LOG_DIR` 可覆盖日志目录；`logs/` 不入库。
- 新增 i18n 键 zh/en 必须成对（`tests/i18n/message-keys.test.ts` 会检查）。
- **不要在 `next dev` 运行时执行 `next build`**（共享 `.next/`，会让 dev 500）。构建前先确认没有 dev 在跑；若有，停掉它（不要用 `pkill -f "next dev"`，会杀掉自己的 shell——用 `ps` 找 PID 再 `kill <pid>`）。

## Review Focus

1. **局域网 http 访问（非安全上下文）**：被试用 `http://192.168.x.x:7777` 打开时 `crypto.randomUUID` 不存在，会话 ID 生成必须仍然成功 → Task 11 `makeId` 只用 `crypto.getRandomValues`，有测试。
2. **比视口高的区块**：静态版 treemap/地图区块远高于一屏，IntersectionObserver 的 `intersectionRatio` 永远到不了 0.5，停留时间会恒为 0 → Task 11 `isSectionActive` 同时接受"占视口一半以上"，有测试。
3. **收集端临时不可用**：实验中服务器重启或网络抖动，事件应保留在队列、恢复后补发，且不重复删除后来的事件 → Task 11 队列用 `seq` 确认，有测试。
4. **被试手输链接漏掉结尾斜杠**：`/zh/static?pid=P1` 必须 301 到 `/zh/static/?pid=P1` 且保留 `pid` → Task 14 有测试。
5. **恶意/畸形路径**：`/a%2F..%2F..%2Fpackage.json` 不能读出 `out/` 之外的文件，`/%E0%A4%A` 不能让进程崩溃 → Task 14 有测试（403 / 400）。

---

## File Structure

**新建**
- `lib/charts/cumulative.ts` — 累计图常量、序列、版本对比、几何
- `lib/charts/treemap.ts` — treemap 布局、瓦片文字分档、`frameAt`、样例区间合并
- `lib/charts/sankey.ts` — Sankey 布局、曲线采样、珠数/珠径、路径
- `lib/charts/origin-map.ts` — 地图尺寸、投影、放置、局部放大区
- `lib/use-world-features.ts` — 加载 world-atlas 的共享 hook
- `lib/experiment.ts` — `isExperiment()`
- `lib/tracking.ts` — 队列/停留/悬停计时 + 单例 `track`/`hoverStart`/`hoverEnd`
- `lib/tracking-session.ts` — 浏览器接线 `initTracking()`
- `components/TrackingRoot.tsx`
- `components/chapter-01/CumulativeAxes.tsx`、`CumulativeMarker.tsx`、`VersionDiffCard.tsx` — 两版共用的累计图展示件
- `components/static/StaticSection.tsx`、`StaticTable.tsx`、`StaticHero.tsx`、`StaticCumulative.tsx`、`StaticTreemap.tsx`、`StaticSankey.tsx`、`StaticOriginMap.tsx`、`StaticWhoGetsIn.tsx`、`StaticStory.tsx`
- `app/[locale]/static/page.tsx`
- `scripts/experiment-server.mjs`、`scripts/experiment_smoke.py`
- 测试：`tests/helpers/intl.tsx`、`tests/lib/charts-*.test.ts`、`tests/lib/use-world-features.test.tsx`、`tests/lib/tracking*.test.ts`、`tests/lib/track-sections.test.ts`、`tests/ui/CumulativeChart.test.tsx`、`tests/ui/TopNav.test.tsx`、`tests/ui/interact-tracking.test.tsx`、`tests/static/*.test.tsx`、`tests/scripts/experiment-server.test.ts`

**修改**
- `components/chapter-01/CumulativeChart.tsx`、`CategoryTreemap.tsx`、`VariantSankey.tsx`、`components/chapter-02/OriginMap.tsx` — 改用 lib；插入 `track`
- `components/chapter-02/Pipeline.tsx`、`CriteriaCards.tsx`、`CaseCards.tsx` — `isStatic` 属性
- `components/chapter-02/WhoGetsIn.tsx`、`components/Hero.tsx`、`components/Footer.tsx`、`app/[locale]/page.tsx` — `data-track-section`、`TrackingRoot`
- `components/hero/EmojiField.tsx`、`lib/hero-emoji-layout.ts` — `pickProfile` 挪到 lib；`track`
- `components/TopNav.tsx` — 实验构建隐藏语言切换
- `app/[locale]/globals.css` — `.hero-emoji-static`
- `messages/zh.json`、`messages/en.json` — `static.*`
- `package.json`、`.gitignore`、`README.md`

---

### Task 1: 抽取累计图几何与共用展示件

**Files:**
- Create: `lib/charts/cumulative.ts`, `components/chapter-01/CumulativeAxes.tsx`, `components/chapter-01/CumulativeMarker.tsx`, `components/chapter-01/VersionDiffCard.tsx`, `tests/helpers/intl.tsx`, `tests/lib/charts-cumulative.test.ts`, `tests/ui/CumulativeChart.test.tsx`
- Modify: `components/chapter-01/CumulativeChart.tsx`

**Interfaces:**
- Produces（`lib/charts/cumulative.ts`）：`CUM_W=880`、`CUM_H=440`、`CUM_PAD`、`RangeId`、`RANGE_START`、`DEFAULT_FROM_ID`、`DEFAULT_TO_ID`、`type ContributingNode`、`interface EnrichedNode`、`interface DiffResult`、`interface ChartPoint`、`interface CumulativeGeometry { points; pathLine; pathArea; yTicks; xScale; yScale; xLabels; maxYear }`、`buildSeries(timeline: TimelineNode[]): EnrichedNode[]`、`computeVersionDiff(series, fromId, toId): DiffResult | null`、`buildGeometry(series, decadeIndex: number[], rangeStart: number): CumulativeGeometry`
- Produces（组件）：`<CumulativeAxes geometry locale yAxisLabel />`（渲染 `<defs>` 渐变+裁剪、Y 轴标题、网格、面积+折线、X 轴标签，放在 `<svg>` 内）；`<CumulativeMarker p isActive compare />`（`compare: 'A' | 'B' | null`）与 `markerBaseRadius(p): number`；`<VersionDiffCard diff />`
- Produces（测试辅助 `tests/helpers/intl.tsx`）：`renderIntl(ui, locale?)`、`msg(locale, dottedKey): string`

- [ ] **Step 1: 写测试辅助**

`tests/helpers/intl.tsx`:

```tsx
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import zh from '@/messages/zh.json'
import en from '@/messages/en.json'

const MESSAGES = { zh, en }

export function renderIntl(ui: ReactElement, locale: 'zh' | 'en' = 'zh') {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  )
}

/** 读取原始文案（不做 ICU 插值），用于断言无参数的文案出现在页面上。 */
export function msg(locale: 'zh' | 'en', key: string): string {
  let node: unknown = MESSAGES[locale]
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
  if (typeof node !== 'string') throw new Error(`no message at ${key}`)
  return node
}
```

- [ ] **Step 2: 写失败的几何测试**

`tests/lib/charts-cumulative.test.ts`:

```ts
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
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/lib/charts-cumulative.test.ts`
Expected: FAIL，`Failed to resolve import "@/lib/charts/cumulative"`

- [ ] **Step 4: 实现 `lib/charts/cumulative.ts`**

```ts
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
```

- [ ] **Step 5: 运行几何测试确认通过**

Run: `npx vitest run tests/lib/charts-cumulative.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 6: 写交互版回归测试（重构前先钉住现有行为）**

`tests/ui/CumulativeChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderIntl } from '../helpers/intl'
import { CumulativeChart } from '@/components/chapter-01/CumulativeChart'
import { buildSeries, computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID } from '@/lib/charts/cumulative'
import ch01 from '@/data/chapter-01.json'
import type { Chapter01Data } from '@/types/chapter-01'

const data = ch01 as Chapter01Data

describe('<CumulativeChart> (interactive)', () => {
  it('renders one focusable medallion per contributing version', () => {
    const { container } = renderIntl(<CumulativeChart data={data} />)
    expect(container.querySelectorAll('svg [role="button"]')).toHaveLength(15)
  })

  it('shows the default 6.0 → 17.0 diff card and A/B chips', () => {
    const { container } = renderIntl(<CumulativeChart data={data} />)
    const diff = computeVersionDiff(buildSeries(data.timeline), DEFAULT_FROM_ID, DEFAULT_TO_ID)!
    expect(screen.getByText(`+${diff.addedTotal.toLocaleString('zh')}`)).toBeInTheDocument()
    const svg = container.querySelector('svg')!
    expect(within(svg as unknown as HTMLElement).getByText('A')).toBeInTheDocument()
    expect(within(svg as unknown as HTMLElement).getByText('B')).toBeInTheDocument()
  })
})
```

Run: `npx vitest run tests/ui/CumulativeChart.test.tsx`
Expected: PASS（重构前现有组件就应通过；若失败，先修测试选择器，不要改组件）

- [ ] **Step 7: 新建 `components/chapter-01/CumulativeAxes.tsx`**

内容逐字取自 `CumulativeChart.tsx` 现有的 Y 轴标题 / 网格 / 面积折线 / X 轴标签 JSX（第 483–558 行），渐变与裁剪 ID 改用 `useId`：

```tsx
'use client'
import { useId } from 'react'
import { CUM_W as W, CUM_H as H, CUM_PAD as PAD, type CumulativeGeometry } from '@/lib/charts/cumulative'

interface Props {
  geometry: CumulativeGeometry
  locale: string
  yAxisLabel: string
}

/** Axes, gridlines, area and line of the cumulative chart. Rendered inside an
 *  `<svg viewBox="0 0 880 440">` by both the interactive and the static chart. */
export function CumulativeAxes({ geometry, locale, yAxisLabel }: Props) {
  const uid = useId()
  const gradId = `${uid}-grad`
  const clipId = `${uid}-clip`
  const { yTicks, yScale, xScale, xLabels, pathArea, pathLine } = geometry
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0%" stopColor="var(--accent-01)" />
          <stop offset="100%" stopColor="var(--accent-04)" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={PAD.l} y={PAD.t - 10} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b + 12} />
        </clipPath>
      </defs>

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
        {yAxisLabel}
      </text>

      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={PAD.l - 10} y={yScale(tick)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--muted)" className="tabular">
            {tick.toLocaleString(locale)}
          </text>
        </g>
      ))}

      <g clipPath={`url(#${clipId})`}>
        <path d={pathArea} fill={`url(#${gradId})`} opacity={0.16} />
        <path d={pathLine} fill="none" stroke={`url(#${gradId})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {xLabels.map(year => (
        <g key={year}>
          <line x1={xScale(year)} x2={xScale(year)} y1={H - PAD.b} y2={H - PAD.b + 5} stroke="var(--muted)" opacity={0.4} />
          <text x={xScale(year)} y={H - PAD.b + 20} fontSize="11" fill="var(--muted)" textAnchor="middle" className="tabular" fontWeight="700">
            {year}
          </text>
        </g>
      ))}
    </>
  )
}
```

- [ ] **Step 8: 新建 `components/chapter-01/CumulativeMarker.tsx`**

视觉部分逐字取自现有第 601–700 行（不含透明命中圆和事件）：

```tsx
import type { ChartPoint } from '@/lib/charts/cumulative'

export function markerBaseRadius(p: ChartPoint): number {
  return p.flagship ? 18 : 13
}

interface Props {
  p: ChartPoint
  isActive: boolean
  compare: 'A' | 'B' | null
}

/** Visual medallion for one version (circle, emoji, year label, draft pill,
 *  compare chip). No hit area, no handlers — callers wrap it. */
export function CumulativeMarker({ p, isActive, compare }: Props) {
  const baseR = markerBaseRadius(p)
  const r = isActive ? baseR + 4 : baseR
  const fontSize = p.flagship ? (isActive ? 18 : 14) : isActive ? 14 : 11
  const isDraft = p.draft === true
  return (
    <>
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
      {p.flagship && !isActive && !compare && (
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
          point is always at the chart's right edge. */}
      {isDraft && (() => {
        const pillW = 44
        const pillH = 14
        const pillX = p.cx - baseR - pillW
        const pillY = p.cy - baseR - pillH / 2 - 2
        return (
          <g pointerEvents="none">
            <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={pillH / 2} fill="var(--muted)" />
            <text x={pillX + pillW / 2} y={pillY + pillH / 2} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="900" fill="white" letterSpacing="0.05em">
              DRAFT
            </text>
          </g>
        )
      })()}
      {compare && (
        <g pointerEvents="none">
          <circle cx={p.cx} cy={p.cy} r={r} fill="none" stroke="var(--accent-01)" strokeWidth={4} />
          <g transform={`translate(${p.cx}, ${p.cy + baseR + 22})`}>
            <rect x={-9} y={-7} width={18} height={13} rx={3} fill="var(--accent-01)" />
            <text textAnchor="middle" dy={2} fontSize={9} fontWeight={900} fill="white" letterSpacing="0.05em">
              {compare}
            </text>
          </g>
        </g>
      )}
    </>
  )
}
```

- [ ] **Step 9: 新建 `components/chapter-01/VersionDiffCard.tsx`**

逐字取自现有内部函数 `VersionDiffCard`（第 315–409 行），改为接收 `diff` 属性：

```tsx
'use client'
import { useLocale, useTranslations } from 'next-intl'
import type { DiffResult } from '@/lib/charts/cumulative'

const MAX_SAMPLES = 30

export function VersionDiffCard({ diff }: { diff: DiffResult }) {
  const t = useTranslations('ch01.chart')
  const locale = useLocale() as 'zh' | 'en'
  const samples = diff.sampleEmojis
  const visibleSamples = samples.slice(0, MAX_SAMPLES)
  const overflow = Math.max(0, samples.length - MAX_SAMPLES)
  const spanText =
    diff.yearSpan === 0
      ? t('diff.cardSpanSameYear', { versions: diff.versionCount })
      : t('diff.cardSpan', { years: diff.yearSpan, versions: diff.versionCount })

  return (
    <div className="mt-3 rounded-xl bg-white p-3.5 border border-[color:var(--accent-01)]/25">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-[color:var(--accent-01)] uppercase">
            {t('diff.cardEyebrow', { fromYear: diff.fromNode.node.year, toYear: diff.toNode.node.year })}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
            {t('diff.cardTitle', { fromVersion: diff.fromNode.node.versionLabel, toVersion: diff.toNode.node.versionLabel })}
            <span className="ml-2 text-[11px] font-bold text-[color:var(--muted)]">· {spanText}</span>
          </div>
        </div>
        {diff.isDraft && (
          <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--muted)] text-white">
            {t('draftBadge')}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs border-t border-[color:var(--line)]/60 pt-3" aria-live="polite">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('added')}</div>
          <div className="text-base font-semibold tabular text-[color:var(--accent-01)] leading-tight">
            +{diff.addedTotal.toLocaleString(locale)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('total')}</div>
          <div className="text-base font-semibold tabular leading-tight">{diff.toNode.runningTotal.toLocaleString(locale)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('growth')}</div>
          <div className="text-base font-semibold tabular text-[color:var(--accent-04)] leading-tight">
            {diff.growthPct === null ? '—' : `+${Math.round(diff.growthPct)}%`}
          </div>
        </div>
      </div>

      {visibleSamples.length > 0 && (
        <div className="mt-3 border-t border-[color:var(--line)]/60 pt-3">
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold mb-1.5">
            {t('diff.sampleHeader', { versions: diff.versionCount })}
          </div>
          <div className="flex flex-wrap gap-1.5 text-base md:text-lg leading-none">
            {visibleSamples.map((e, i) => (<span key={i}>{e}</span>))}
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
```

- [ ] **Step 10: 改 `CumulativeChart.tsx` 使用这些件**

1. 删除第 3–4 行 d3 import、第 9–81 行（常量、类型、`computeVersionDiff`）、第 83–90 行 `ChartPoint`。在 import 区加入：

```tsx
import { CumulativeAxes } from './CumulativeAxes'
import { CumulativeMarker } from './CumulativeMarker'
import { VersionDiffCard } from './VersionDiffCard'
import {
  buildGeometry, buildSeries, computeVersionDiff,
  CUM_W as W, CUM_H as H, DEFAULT_FROM_ID, DEFAULT_TO_ID, RANGE_START,
  type RangeId,
} from '@/lib/charts/cumulative'

// Re-exported for tests/logic/version-diff.test.ts, which imports from this file.
export { computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID }
export type { EnrichedNode, DiffResult } from '@/lib/charts/cumulative'

const HIT_RADIUS = 22 // 44px touch target diameter
```

2. 删除 `clipId = useId()`（及 `useId` import）和 `decadeSet`。把 `fullSeries` memo 换成 `const fullSeries = useMemo(() => buildSeries(data.timeline), [data.timeline])`；把 `fullMaxYear` 换成 `const fullMaxYear = useMemo(() => Math.max(...fullSeries.map(d => d.node.year)), [fullSeries])` 保持不变即可。
3. 把第 140–223 行整个 geometry `useMemo` 换成：

```tsx
  const geometry = useMemo(
    () => buildGeometry(fullSeries, data.decadeIndex, rangeStart),
    [fullSeries, data.decadeIndex, rangeStart],
  )
  const { points } = geometry
```

4. 删除内部函数 `VersionDiffCard`，把 `<VersionDiffCard />` 改为 `{diffResult && <VersionDiffCard diff={diffResult} />}`。
5. SVG 内：`<defs>` 只保留 `<filter id="markerShadow">…</filter>`（删渐变和 clipPath）；把第 483–558 行（Y 轴标题到 X 轴标签）换成 `<CumulativeAxes geometry={geometry} locale={locale} yAxisLabel={t('yAxis')} />`；删除第 705–706 行 `hiddenAnchor` 占位。
6. 每个 marker `<g role="button" …>` 内部只保留透明命中圆，其余视觉换成组件：

```tsx
              <circle cx={p.cx} cy={p.cy} r={HIT_RADIUS} fill="transparent" />
              <CumulativeMarker
                p={p}
                isActive={isActive}
                compare={compareIds.has(p.id) && diffResult ? (p.id === diffResult.fromNode.node.id ? 'A' : 'B') : null}
              />
```

并删除该 map 回调里已不再使用的 `baseR`/`r`/`fontSize`/`isDraft` 变量。最后删除所有不再使用的 import 与变量（`useId`、`TimelineNode`、`decadeSet`、`tooltipPlacement` 仍在用则保留——以 `npm run lint` 的 unused 报告为准）。

- [ ] **Step 11: 运行全部测试与 lint**

Run: `npx vitest run && npm run lint`
Expected: 全部 PASS（含原有 `tests/logic/version-diff.test.ts`），lint 无错误

- [ ] **Step 12: Commit**

```bash
git add lib/charts/cumulative.ts components/chapter-01/ tests/helpers/intl.tsx tests/lib/charts-cumulative.test.ts tests/ui/CumulativeChart.test.tsx
git commit -m "refactor(ch01): extract cumulative chart geometry and shared marker/axes/diff card"
```

---

### Task 2: 抽取 treemap 布局与标签分档

**Files:**
- Create: `lib/charts/treemap.ts`, `tests/lib/charts-treemap.test.ts`
- Modify: `components/chapter-01/CategoryTreemap.tsx`

**Interfaces:**
- Produces：`TREEMAP_W=880`、`TREEMAP_H=460`、`interface TileNode { key; count; x; y; w; h }`、`layoutTreemap(frame, groupOrder, w?, h?): TileNode[]`、`interface TileText { hasText; canShowLabel; isWide; isStacked; textBandH; stageCy; emojiSize; labelX; labelY; labelAnchor: 'start' | 'middle'; countX; countY; countAnchor: 'end' | 'middle' }`、`tileTextLayout(tile, groupLabel): TileText`、`frameAt(frames, year): FrameLookup`、`interface SampleRun { fromLabel; toLabel; samples: string[] }`、`sampleRuns(frames, key, n = 6): SampleRun[]`

- [ ] **Step 1: 写失败测试**

`tests/lib/charts-treemap.test.ts`:

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/charts-treemap.test.ts`
Expected: FAIL，`Failed to resolve import "@/lib/charts/treemap"`

- [ ] **Step 3: 实现 `lib/charts/treemap.ts`**

```ts
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
```

（注：原组件中 `countX` 条件是 `canShowLabel && isWide`，而 `isWide` 已蕴含 `canShowLabel`，两者等价。）

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/charts-treemap.test.ts`
Expected: PASS

- [ ] **Step 5: 改 `CategoryTreemap.tsx`**

1. 删除 `d3-hierarchy` import、`W`/`H` 常量、`TileNode`、`FrameLookup`、`frameAt` 定义（第 14–15、24–46 行），加：

```tsx
import { layoutTreemap, tileTextLayout, TREEMAP_W as W, TREEMAP_H as H, type TileNode } from '@/lib/charts/treemap'

// Re-exported for tests/logic/category-frame.test.ts.
export { frameAt } from '@/lib/charts/treemap'
export type { FrameLookup } from '@/lib/charts/treemap'
```

2. `tiles` memo 改为 `const tiles: TileNode[] = useMemo(() => layoutTreemap(frame, data.groupOrder), [frame, data.groupOrder])`。
3. 在 tiles.map 回调中，删除第 253–278 行的就地计算（`hasText`…`emojiSize`），换成：

```tsx
          const glyph = frame.samples[tile.key]?.[0] ?? ''
          const L = tileTextLayout(tile, groupLabel)
```

并把 JSX 中的用法替换：`hasText`→`L.hasText`，`emojiSize`→`L.emojiSize`，`stageCy`→`L.stageCy`，`textBandH`→`L.textBandH`，`canShowLabel`→`L.canShowLabel`；标签 `animate={{ x: L.labelX, y: L.labelY }}`、`textAnchor={L.labelAnchor}`；计数 `animate={{ x: L.countX, y: L.countY }}`、`textAnchor={L.countAnchor}`。

- [ ] **Step 6: 全量测试 + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS（含原有 `tests/logic/category-frame.test.ts`）

- [ ] **Step 7: Commit**

```bash
git add lib/charts/treemap.ts components/chapter-01/CategoryTreemap.tsx tests/lib/charts-treemap.test.ts
git commit -m "refactor(ch01): extract treemap layout, label tiers and sample runs"
```

---

### Task 3: 抽取 Sankey 布局与珠子计算

**Files:**
- Create: `lib/charts/sankey.ts`, `tests/lib/charts-sankey.test.ts`
- Modify: `components/chapter-01/VariantSankey.tsx`

**Interfaces:**
- Produces：`SANKEY_W=880`、`SANKEY_H=520`、`SANKEY_PAD`、`NODE_WIDTH=16`、`type NodeKind`、`interface SankeyNodeIn`、`interface SankeyLinkIn`、`type LaidNode = SankeyNodeIn & { x0; x1; y0; y1; value }`、`type LaidLink = Omit<SankeyLinkIn, 'source' | 'target'> & { source: LaidNode; target: LaidNode; width; y0; y1 }`、`buildSankey(data, mechLabel: (id: MechanismId) => string, groupLabel: (g: CategoryGroupKey) => string): { nodes: LaidNode[]; links: LaidLink[] }`、`sankeyPath(l: LaidLink): string`、`sampleSankeyCurve(link, n)`、`beadCount(value)`、`beadSize(width)`、`beadGlyphs(link: LaidLink, data): { x: number; y: number; glyph: string }[]`

- [ ] **Step 1: 写失败测试**

`tests/lib/charts-sankey.test.ts`:

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/charts-sankey.test.ts`
Expected: FAIL，`Failed to resolve import "@/lib/charts/sankey"`

- [ ] **Step 3: 实现 `lib/charts/sankey.ts`**

```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/charts-sankey.test.ts`
Expected: PASS

- [ ] **Step 5: 改 `VariantSankey.tsx`**

1. 删除第 3 行 d3-sankey import、第 14–71 行（常量、`sampleSankeyCurve`、`beadCount`、`NodeKind`、`SankeyNodeIn`、`SankeyLinkIn`），加：

```tsx
import {
  buildSankey, beadGlyphs, beadSize, sankeyPath,
  SANKEY_W as W, SANKEY_H as H, SANKEY_PAD as PAD, NODE_WIDTH,
  type LaidLink, type LaidNode, type SankeyNodeIn,
} from '@/lib/charts/sankey'

type SelectionId = string // `mech::<id>` | `group::<id>` | `flow::<mech>::<group>`
```

2. `layout` memo 改为：

```tsx
  const layout = useMemo(
    () => buildSankey(data, id => t(`mechanisms.${id}.label` as never), g => groupT(g as never)),
    [data, t, groupT],
  )
```

删除 `linkPath` memo。
3. 链接 map：`(layout.links as Array<…>).map((l, i) =>` 改为 `layout.links.map((l: LaidLink, i) =>`；删除 `n`/`positions`/`beadSize`/`examples` 局部变量；两处 `d={linkPath(l) ?? ''}` 改为 `d={sankeyPath(l)}`；珠子改为：

```tsx
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
```

4. 节点 map：`(layout.nodes as Array<…>).map(n =>` 改为 `layout.nodes.map((n: LaidNode) =>`。`isNodeVisible` 与 `tooltipData` 中对 `layout.links`/`layout.nodes` 的 `as` 断言可以保留或改为直接使用 `LaidLink`/`LaidNode`，行为不变。

- [ ] **Step 6: 全量测试 + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/charts/sankey.ts components/chapter-01/VariantSankey.tsx tests/lib/charts-sankey.test.ts
git commit -m "refactor(ch01): extract sankey layout and bead helpers"
```

---

### Task 4: 抽取地图投影、局部放大区与 world-atlas 加载

**Files:**
- Create: `lib/charts/origin-map.ts`, `lib/use-world-features.ts`, `tests/lib/charts-origin-map.test.ts`, `tests/lib/use-world-features.test.tsx`
- Modify: `components/chapter-02/OriginMap.tsx`

**Interfaces:**
- Produces：`MAP_W=800`、`MAP_H=420`、`makeProjection(): GeoProjection`、`interface PlacedPin extends OriginPin { cx; cy }`、`placePins(pins, projection): PlacedPin[]`、`type LngLatBox = [[number, number], [number, number]]`、`type InsetId = 'europe-mideast' | 'east-asia' | 'south-asia' | 'mexico'`、`MAP_INSETS: { id: InsetId; box: LngLatBox }[]`、`pinsInBox(pins, box)`、`insetProjection(box, w, h, pad = 20): GeoProjection`；`useWorldFeatures(): FeatureCollection<Geometry> | null`

- [ ] **Step 1: 写失败测试**

`tests/lib/charts-origin-map.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MAP_INSETS, pinsInBox, insetProjection, placePins, makeProjection, MAP_W, MAP_H } from '@/lib/charts/origin-map'
import ch02 from '@/data/chapter-02.json'
import type { OriginPin } from '@/types/chapter-02'

const pins = ch02.origins as OriginPin[]

describe('origin map helpers', () => {
  it('places all 41 pins inside the main map', () => {
    const placed = placePins(pins, makeProjection())
    expect(placed).toHaveLength(41)
    for (const p of placed) {
      expect(p.cx).toBeGreaterThan(0); expect(p.cx).toBeLessThan(MAP_W)
      expect(p.cy).toBeGreaterThan(0); expect(p.cy).toBeLessThan(MAP_H)
    }
  })

  it('insets cover the dense regions', () => {
    const counts = Object.fromEntries(MAP_INSETS.map(i => [i.id, pinsInBox(pins, i.box).length]))
    expect(counts).toEqual({ 'europe-mideast': 15, 'east-asia': 8, 'south-asia': 4, 'mexico': 4 })
  })

  it('inset projections keep their pins inside the inset frame', () => {
    for (const inset of MAP_INSETS) {
      const placed = placePins(pinsInBox(pins, inset.box), insetProjection(inset.box, 400, 260))
      for (const p of placed) {
        expect(p.cx).toBeGreaterThanOrEqual(0); expect(p.cx).toBeLessThanOrEqual(400)
        expect(p.cy).toBeGreaterThanOrEqual(0); expect(p.cy).toBeLessThanOrEqual(260)
      }
    }
  })
})
```

`tests/lib/use-world-features.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useWorldFeatures } from '@/lib/use-world-features'

const atlas = JSON.parse(readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8'))

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('useWorldFeatures', () => {
  it('fetches the atlas through withBasePath and returns country features', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/howweemojify')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(atlas), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useWorldFeatures())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/howweemojify/world-atlas/countries-110m.json')
    expect(result.current!.features.length).toBe(177)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/charts-origin-map.test.ts tests/lib/use-world-features.test.tsx`
Expected: FAIL，找不到模块

- [ ] **Step 3: 实现 `lib/charts/origin-map.ts`**

```ts
import { geoEqualEarth, type GeoProjection } from 'd3-geo'
import type { MultiPoint } from 'geojson'
import type { OriginPin } from '@/types/chapter-02'

export const MAP_W = 800
export const MAP_H = 420

export function makeProjection(): GeoProjection {
  return geoEqualEarth().scale(140).translate([MAP_W / 2, MAP_H / 2])
}

export interface PlacedPin extends OriginPin {
  cx: number
  cy: number
}

export function placePins(pins: OriginPin[], projection: GeoProjection): PlacedPin[] {
  return pins
    .map(p => {
      const xy = projection([p.lng, p.lat])
      return xy ? { ...p, cx: xy[0], cy: xy[1] } : null
    })
    .filter((p): p is PlacedPin => p !== null)
}

/** [[west lng, south lat], [east lng, north lat]] */
export type LngLatBox = [[number, number], [number, number]]
export type InsetId = 'europe-mideast' | 'east-asia' | 'south-asia' | 'mexico'

/** Regions where pins overlap at the default zoom; the static page shows each
 *  as a separate zoomed map (the interactive map reaches them by zooming). */
export const MAP_INSETS: { id: InsetId; box: LngLatBox }[] = [
  { id: 'europe-mideast', box: [[-6, 22], [48, 60]] },
  { id: 'east-asia', box: [[100, 15], [145, 45]] },
  { id: 'south-asia', box: [[68, 8], [92, 32]] },
  { id: 'mexico', box: [[-106, 14], [-86, 24]] },
]

export function pinsInBox(pins: OriginPin[], box: LngLatBox): OriginPin[] {
  const [[w, s], [e, n]] = box
  return pins.filter(p => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n)
}

export function insetProjection(box: LngLatBox, w: number, h: number, pad = 20): GeoProjection {
  const [[west, south], [east, north]] = box
  const corners: MultiPoint = {
    type: 'MultiPoint',
    coordinates: [[west, south], [east, north], [west, north], [east, south]],
  }
  return geoEqualEarth().fitExtent([[pad, pad], [w - pad, h - pad]], corners)
}
```

- [ ] **Step 4: 实现 `lib/use-world-features.ts`**

```ts
'use client'
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { withBasePath } from '@/lib/base-path'

/** Country outlines from public/world-atlas. Must go through withBasePath:
 *  without it the fetch 404s on GitHub Pages and the map silently renders blank. */
export function useWorldFeatures(): FeatureCollection<Geometry> | null {
  const [features, setFeatures] = useState<FeatureCollection<Geometry> | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(withBasePath('/world-atlas/countries-110m.json'))
      .then(r => {
        if (!r.ok) throw new Error(`world-atlas: HTTP ${r.status}`)
        return r.json()
      })
      .then((topo: Topology) => {
        if (cancelled) return
        setFeatures(feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<Geometry>)
      })
      .catch(err => {
        console.error('failed to load world atlas', err)
      })
    return () => { cancelled = true }
  }, [])
  return features
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/lib/charts-origin-map.test.ts tests/lib/use-world-features.test.tsx`
Expected: PASS

- [ ] **Step 6: 改 `OriginMap.tsx`**

1. 删除 `geoEqualEarth`（保留 `geoPath`）、`feature`、`withBasePath`、`FeatureCollection/Geometry/Topology/GeometryCollection` import，删除 `W`/`H` 常量与 `PlacedPin` 接口，加：

```tsx
import { makeProjection, placePins, MAP_W as W, MAP_H as H, type PlacedPin } from '@/lib/charts/origin-map'
import { useWorldFeatures } from '@/lib/use-world-features'
```

2. 删除 `features` state 与整个 fetch `useEffect`（第 42–55 行），改为 `const features = useWorldFeatures()`。
3. `projection` memo 改为 `useMemo(makeProjection, [])`；`placed` memo 改为 `useMemo(() => placePins(pins, projection), [pins, projection])`。

- [ ] **Step 7: 全量测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add lib/charts/origin-map.ts lib/use-world-features.ts components/chapter-02/OriginMap.tsx tests/lib/charts-origin-map.test.ts tests/lib/use-world-features.test.tsx
git commit -m "refactor(ch02): extract map projection, insets and world-atlas loader"
```

---

### Task 5: 静态页骨架（路由、Hero、§02 非地图部分、文案）

**Files:**
- Create: `components/static/StaticSection.tsx`, `components/static/StaticTable.tsx`, `components/static/StaticHero.tsx`, `components/static/StaticWhoGetsIn.tsx`, `components/static/StaticStory.tsx`, `app/[locale]/static/page.tsx`, `tests/static/scaffold.test.tsx`
- Modify: `lib/hero-emoji-layout.ts`, `components/hero/EmojiField.tsx`, `app/[locale]/globals.css`, `components/chapter-02/Pipeline.tsx`, `components/chapter-02/CriteriaCards.tsx`, `components/chapter-02/CaseCards.tsx`, `messages/zh.json`, `messages/en.json`, `tests/helpers/intl.tsx`

**Interfaces:**
- Consumes：`computeLayout`（`lib/hero-emoji-layout.ts`）、`HERO_EMOJIS`
- Produces：`pickProfile(vw, vh): LayoutProfile`（移到 `lib/hero-emoji-layout.ts`）；`<StaticSection id accent className? />`；`<StaticTable caption>` + 类名常量 `TH`、`TD`；`<StaticHero />`；`<StaticWhoGetsIn data />`（Task 9 往里加地图）；`<StaticStory ch01 ch01Cat ch01Var ch02 />`（Task 6–8 往 ch01 区块里加图）；`Pipeline`/`CriteriaCards`/`CaseCards` 的可选 `isStatic?: boolean`；`assertNoInteractive(container)`；全部 `static.*` 文案键

- [ ] **Step 1: 文案——在 `messages/zh.json` 顶层加入 `static`**

```json
  "static": {
    "cumulative": {
      "note": "徽章旁的数字对应下表编号。徽章变大的是十年节点，虚线徽章为草案版本。",
      "insetTitle": "放大视图 · 2015 → 至今",
      "tableCaption": "各版本明细",
      "colNo": "#",
      "colVersion": "年份 · 版本",
      "colSamples": "代表 emoji",
      "colNarrative": "说明",
      "colSource": "来源"
    },
    "treemap": {
      "subtitle": "2010 → 至今 emoji 总量在 9 大类别间的占比变化，按版本依次排列。",
      "smallMultiplesTitle": "逐版本构成",
      "tableCaption": "各版本各类别数量与占比",
      "colGroup": "类别",
      "colSamples": "代表 emoji（适用版本）",
      "runRange": "{from} – {to}"
    },
    "sankey": {
      "subtitle": "在 {version} 的 {total} 个全限定 emoji 中，每条流向都标注了一种「让总量膨胀」的机制——把它流入九大类别里。",
      "nodeTableCaption": "节点明细",
      "flowTableCaption": "流向明细",
      "colKind": "类型",
      "colNode": "节点",
      "colFlow": "流向",
      "colShareOfMech": "占该机制",
      "colExamples": "示例",
      "kindMechanism": "变体机制",
      "kindGroup": "类别归属"
    },
    "map": {
      "note": "图钉旁的数字对应下表编号。",
      "insetsTitle": "局部放大",
      "insets": {
        "europe-mideast": "欧洲 · 中东",
        "east-asia": "东亚",
        "south-asia": "南亚",
        "mexico": "墨西哥"
      },
      "insetCount": "{count} 个原点",
      "tableCaption": "全部文化原点",
      "colNo": "#",
      "colEmoji": "Emoji",
      "colCountry": "国家/地区",
      "colYear": "年份",
      "colOrigin": "来源说明"
    }
  }
```

`messages/en.json` 同位置：

```json
  "static": {
    "cumulative": {
      "note": "Numbers beside the medallions match the table below. Larger medallions mark decade milestones; dashed medallions are draft versions.",
      "insetTitle": "Zoomed view · 2015 → today",
      "tableCaption": "Every version",
      "colNo": "#",
      "colVersion": "Year · version",
      "colSamples": "Highlights",
      "colNarrative": "Notes",
      "colSource": "Source"
    },
    "treemap": {
      "subtitle": "How the 9 emoji categories take share of the growing catalogue, 2010 → today, version by version.",
      "smallMultiplesTitle": "Composition by version",
      "tableCaption": "Count and share per category and version",
      "colGroup": "Category",
      "colSamples": "Samples (versions)",
      "runRange": "{from} – {to}"
    },
    "sankey": {
      "subtitle": "In {version} we count {total} fully-qualified emoji. Each flow tags one mechanism that grows the total and traces it into the nine CLDR groups.",
      "nodeTableCaption": "Nodes",
      "flowTableCaption": "Flows",
      "colKind": "Kind",
      "colNode": "Node",
      "colFlow": "Flow",
      "colShareOfMech": "Of mechanism",
      "colExamples": "Examples",
      "kindMechanism": "Mechanism",
      "kindGroup": "Category"
    },
    "map": {
      "note": "Numbers beside the pins match the table below.",
      "insetsTitle": "Close-ups",
      "insets": {
        "europe-mideast": "Europe · Middle East",
        "east-asia": "East Asia",
        "south-asia": "South Asia",
        "mexico": "Mexico"
      },
      "insetCount": "{count} origins",
      "tableCaption": "All cultural origins",
      "colNo": "#",
      "colEmoji": "Emoji",
      "colCountry": "Country / region",
      "colYear": "Year",
      "colOrigin": "Origin"
    }
  }
```

Run: `npx vitest run tests/i18n/message-keys.test.ts`
Expected: PASS

- [ ] **Step 2: 给测试辅助加 `assertNoInteractive` 与 ResizeObserver 桩**

在 `tests/helpers/intl.tsx` 末尾追加：

```tsx
import { expect } from 'vitest'

/** Anything a reader could operate. Links are allowed and checked separately. */
export const INTERACTIVE_SELECTOR =
  'button, select, input, textarea, [role="button"], [role="slider"], [tabindex]'

export function assertNoInteractive(container: Element) {
  const found = Array.from(container.querySelectorAll(INTERACTIVE_SELECTOR)).map(el => el.outerHTML.slice(0, 80))
  expect(found).toEqual([])
}

/** jsdom lacks ResizeObserver; the static hero measures its box with it. */
export function stubResizeObserver() {
  if (typeof globalThis.ResizeObserver !== 'undefined') return
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
```

（`import { expect }` 放到文件顶部 import 区。）

- [ ] **Step 3: 写失败的骨架测试**

`tests/static/scaffold.test.tsx`:

```tsx
import { describe, it, expect, beforeAll } from 'vitest'
import { screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, stubResizeObserver, msg } from '../helpers/intl'
import { StaticHero } from '@/components/static/StaticHero'
import { StaticWhoGetsIn } from '@/components/static/StaticWhoGetsIn'
import ch02 from '@/data/chapter-02.json'
import type { Chapter02Data } from '@/types/chapter-02'

const data = ch02 as unknown as Chapter02Data

beforeAll(() => {
  stubResizeObserver()
  // The map is added in Task 9; keep this test independent of the network.
  globalThis.fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch
})

describe('static scaffold', () => {
  it('hero shows the same headline copy and nothing operable', () => {
    const { container } = renderIntl(<StaticHero />)
    expect(screen.getByText(msg('zh', 'hero.eyebrow'))).toBeInTheDocument()
    expect(screen.getByText(msg('zh', 'hero.subtitle'))).toBeInTheDocument()
    assertNoInteractive(container)
  })

  it('ch02 lists every pipeline step, criterion and case without controls', () => {
    const { container } = renderIntl(<StaticWhoGetsIn data={data} />)
    for (const s of data.pipeline) expect(screen.getByText(msg('zh', s.labelKey))).toBeInTheDocument()
    for (const c of data.criteria) expect(screen.getByText(msg('zh', c.titleKey))).toBeInTheDocument()
    for (const c of data.cases) expect(screen.getByText(msg('zh', c.storyKey))).toBeInTheDocument()
    expect(container.querySelector('#ch02')).not.toBeNull()
    assertNoInteractive(container)
  })

  it('static components never import animation libraries or attach handlers', () => {
    const dir = resolve(__dirname, '../../components/static')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(resolve(dir, f), 'utf8')
      expect(src, f).not.toMatch(/framer-motion|gsap|onClick|onMouse|onKey|onFocus|tabIndex/)
    }
  })
})
```

Run: `npx vitest run tests/static/scaffold.test.tsx`
Expected: FAIL，找不到 `@/components/static/StaticHero`

- [ ] **Step 4: `pickProfile` 挪到 lib，加静态表情样式**

`lib/hero-emoji-layout.ts` 在 `PROFILES` 之后加：

```ts
export function pickProfile(vw: number, vh: number): LayoutProfile {
  if (vh < 480) return 'short'
  if (vw < 768) return 'mobile'
  return 'desktop'
}
```

`components/hero/EmojiField.tsx`：删除本地 `pickProfile`，import 改为 `import { computeLayout, pickProfile } from '@/lib/hero-emoji-layout'`（删掉不再需要的 `type LayoutProfile`）。

`app/[locale]/globals.css` 在 `.hero-emoji-btn[data-active="true"]` 规则之后加：

```css
/* Static-page twin of .hero-emoji-btn: same box and metrics, nothing to press. */
.hero-emoji-static {
  display: block;
  line-height: 1;
  user-select: none;
}
```

- [ ] **Step 5: 实现静态基础件**

`components/static/StaticSection.tsx`:

```tsx
interface Props {
  id: string
  accent: string
  children: React.ReactNode
  className?: string
}

/** `Section` without the fade-in: the static page never moves. */
export function StaticSection({ id, accent, children, className = '' }: Props) {
  return (
    <section
      id={id}
      className={`py-20 md:py-28 ${className}`}
      style={{ scrollMarginTop: 80, ['--section-accent' as never]: accent }}
    >
      {children}
    </section>
  )
}
```

`components/static/StaticTable.tsx`:

```tsx
export const TH =
  'px-3 py-2 text-[9px] uppercase tracking-wide font-bold text-[color:var(--muted)] border-b border-[color:var(--line)] whitespace-nowrap align-bottom'
export const TD = 'px-3 py-2 align-top border-b border-[color:var(--line)]/60'

/** A captioned data table in the page's card style. Wide tables scroll inside
 *  their own box so the page itself never scrolls sideways. */
export function StaticTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="mt-6">
      <figcaption className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)] mb-2">
        {caption}
      </figcaption>
      <div className="overflow-x-auto rounded-2xl bg-white card-elev">
        <table className="w-full text-xs text-left tabular text-[color:var(--ink)]">{children}</table>
      </div>
    </figure>
  )
}
```

`components/static/StaticHero.tsx`:

```tsx
'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { HERO_EMOJIS } from '@/lib/hero-emoji-timeline'
import { computeLayout, pickProfile } from '@/lib/hero-emoji-layout'

/** Same wallpaper positions as the interactive hero (same layout function and
 *  profiles), but plain glyphs: no drift, no hover push, no click-to-enlarge. */
function StaticEmojiField() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ vw: number; vh: number } | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timer: number | null = null
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ vw: rect.width, vh: rect.height })
    }
    measure()
    const ro = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(measure, 150)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const positioned = useMemo(
    () => (size ? computeLayout(HERO_EMOJIS, size.vw, size.vh, pickProfile(size.vw, size.vh)) : []),
    [size],
  )

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden hero-vignette" aria-hidden="true">
      {positioned.map((p, i) => (
        <span
          key={`${p.char}-${i}`}
          style={{ position: 'absolute', left: `${p.x}px`, top: `${p.y}px`, opacity: p.opacity, transform: 'translate(-50%, -50%)' }}
        >
          <span className="hero-emoji-static" style={{ fontSize: `${p.size}px` }}>{p.char}</span>
        </span>
      ))}
    </div>
  )
}

export function StaticHero() {
  const t = useTranslations('hero')
  return (
    <header data-track-section="hero" className="relative h-[88vh] overflow-hidden bg-[var(--bg)]">
      <StaticEmojiField />
      <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
        <div className="text-center px-6">
          <div className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">{t('eyebrow')}</div>
          <h1 className="display-tight mt-3 text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] text-balance max-w-4xl mx-auto text-[color:var(--ink)]">{t.rich('title', { br: () => <br /> })}</h1>
          <p className="mt-4 text-base md:text-xl font-normal text-[color:var(--muted)] max-w-2xl mx-auto text-balance">{t('subtitle')}</p>
          <div className="mt-8 text-xs text-[color:var(--muted)]">↓ {t('scrollCue')}</div>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 6: 给 §02 共用组件加 `isStatic`**

`components/chapter-02/Pipeline.tsx`：签名改为 `export function Pipeline({ steps, isStatic = false }: { steps: PipelineStep[]; isStatic?: boolean })`；两处 `motion.div` 的动画属性改为条件展开：

```tsx
            <motion.div
              {...(isStatic ? {} : {
                initial: { opacity: 0, y: 8 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true },
                transition: { delay: i * 0.08 },
              })}
              className="flex-1 text-center"
            >
```

```tsx
              <motion.div
                {...(isStatic ? {} : {
                  initial: { scaleX: 0 },
                  whileInView: { scaleX: 1 },
                  viewport: { once: true },
                  transition: { delay: i * 0.08 + 0.04 },
                })}
                className="h-0.5 w-6 mt-5 bg-[color:var(--accent-02)] origin-left"
              />
```

（没有任何动画属性的 `motion.div` 就是一个普通 div，不会产生运动。）

`components/chapter-02/CriteriaCards.tsx`：签名 `({ criteria, isStatic = false }: { criteria: Criterion[]; isStatic?: boolean })`；article 类名：

```tsx
            className={`bg-white rounded-2xl p-6 card-elev ${isStatic ? '' : 'transition-transform duration-200 hover:-translate-y-0.5'}`}
```

`components/chapter-02/CaseCards.tsx`：签名 `({ cases, isStatic = false }: { cases: CaseCardType[]; isStatic?: boolean })`；article 类名：

```tsx
        <article key={c.id} className={`bg-white rounded-2xl overflow-hidden card-elev relative ${isStatic ? '' : 'transition-transform duration-200 hover:-translate-y-0.5'}`}>
```

- [ ] **Step 7: 静态 §02 与页面组装**

`components/static/StaticWhoGetsIn.tsx`:

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { StaticSection } from './StaticSection'
import { Pipeline } from '@/components/chapter-02/Pipeline'
import { CriteriaCards } from '@/components/chapter-02/CriteriaCards'
import { CaseCards } from '@/components/chapter-02/CaseCards'
import type { Chapter02Data } from '@/types/chapter-02'

export function StaticWhoGetsIn({ data }: { data: Chapter02Data }) {
  const t = useTranslations('ch02')
  return (
    <StaticSection id="ch02" accent="var(--accent-02)">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>CHAPTER 02</div>
        <h2 className="display-tight text-3xl md:text-5xl font-semibold mt-2 text-[color:var(--ink)]">{t('title')}</h2>
        <p className="mt-3 text-sm md:text-base text-[color:var(--muted)] max-w-xl leading-relaxed">{t('intro')}</p>
        <div className="mt-6" data-track-section="ch02-pipeline"><Pipeline steps={data.pipeline} isStatic /></div>
        <div data-track-section="ch02-criteria"><CriteriaCards criteria={data.criteria} isStatic /></div>
        <div data-track-section="ch02-cases"><CaseCards cases={data.cases} isStatic /></div>
      </div>
    </StaticSection>
  )
}
```

`components/static/StaticStory.tsx`:

```tsx
import { StaticHero } from './StaticHero'
import { StaticSection } from './StaticSection'
import { StaticWhoGetsIn } from './StaticWhoGetsIn'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

interface Props {
  ch01: Chapter01Data
  ch01Cat: Chapter01CategoryData
  ch01Var: Chapter01VariantData
  ch02: Chapter02Data
}

/** Everything between the nav and the footer on /[locale]/static. */
export function StaticStory({ ch02 }: Props) {
  return (
    <>
      <StaticHero />
      <StaticSection id="ch01" accent="var(--accent-01)" className="!py-0">
        {/* §01 charts are added in Tasks 6–8 */}
      </StaticSection>
      <StaticWhoGetsIn data={ch02} />
    </>
  )
}
```

（Task 6 会把参数解构改回 `{ ch01, ch01Cat, ch01Var, ch02 }` 并去掉占位注释。）

`app/[locale]/static/page.tsx`:

```tsx
import { setRequestLocale } from 'next-intl/server'
import { TopNav } from '@/components/TopNav'
import { Footer } from '@/components/Footer'
import { StaticStory } from '@/components/static/StaticStory'

import ch01 from '@/data/chapter-01.json'
import ch01Cat from '@/data/chapter-01-categories.json'
import ch01Var from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'

import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

/** Control condition for the user study: same information as /[locale], laid out
 *  for reading, with no interaction and no motion. Not linked from the main page. */
export default async function StaticPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <>
      <TopNav />
      <StaticStory
        ch01={ch01 as Chapter01Data}
        ch01Cat={ch01Cat as Chapter01CategoryData}
        ch01Var={ch01Var as Chapter01VariantData}
        ch02={ch02 as Chapter02Data}
      />
      <Footer />
    </>
  )
}
```

- [ ] **Step 8: 运行测试 + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/static app/\[locale\]/static app/\[locale\]/globals.css lib/hero-emoji-layout.ts components/hero/EmojiField.tsx components/chapter-02/Pipeline.tsx components/chapter-02/CriteriaCards.tsx components/chapter-02/CaseCards.tsx messages tests/helpers/intl.tsx tests/static/scaffold.test.tsx
git commit -m "feat(static): add /[locale]/static route with still hero and chapter 02 cards"
```

---

### Task 6: 静态累计增长图

**Files:**
- Create: `components/static/StaticCumulative.tsx`, `tests/static/StaticCumulative.test.tsx`
- Modify: `components/static/StaticStory.tsx`

**Interfaces:**
- Consumes：Task 1 的 `buildSeries`、`buildGeometry`、`computeVersionDiff`、`RANGE_START`、`DEFAULT_*`、`CUM_W/H`、`CumulativeAxes`、`CumulativeMarker`、`markerBaseRadius`、`VersionDiffCard`；Task 5 的 `StaticTable`/`TH`/`TD`
- Produces：`<StaticCumulative data />`；DOM 钩子 `[data-marker="<versionId>"]`、`[data-cum-chart="full" | "since-2015"]`、`tr[data-row="<versionId>"]`

- [ ] **Step 1: 写失败测试**

`tests/static/StaticCumulative.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticCumulative } from '@/components/static/StaticCumulative'
import { buildSeries, computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID } from '@/lib/charts/cumulative'
import ch01 from '@/data/chapter-01.json'
import type { Chapter01Data } from '@/types/chapter-01'

const data = ch01 as Chapter01Data
const series = buildSeries(data.timeline)

describe('<StaticCumulative>', () => {
  it('draws every version on the full chart and 2015+ on the zoomed chart', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    expect(container.querySelectorAll('[data-cum-chart="full"] [data-marker]')).toHaveLength(15)
    expect(container.querySelectorAll('[data-cum-chart="since-2015"] [data-marker]'))
      .toHaveLength(series.filter(d => d.node.year >= 2015).length)
  })

  it('tabulates every tooltip field for every version', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    const rows = container.querySelectorAll('tbody tr[data-row]')
    expect(rows).toHaveLength(15)
    series.forEach((d, i) => {
      const row = container.querySelector(`tr[data-row="${d.node.id}"]`)!
      const text = row.textContent!
      expect(text).toContain(String(i + 1))
      expect(text).toContain(d.node.versionLabel)
      expect(text).toContain(`+${d.node.newEmojiCount.toLocaleString('zh')}`)
      expect(text).toContain(d.runningTotal.toLocaleString('zh'))
      expect(text).toContain(d.previousTotal === 0 ? '—' : `+${Math.round(d.growthPct)}%`)
      expect(text).toContain(msg('zh', d.node.narrativeKey))
      expect(row.querySelector(`a[href="${d.node.source.url}"]`)).not.toBeNull()
    })
  })

  it('shows the default diff card with A/B marks', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    const diff = computeVersionDiff(series, DEFAULT_FROM_ID, DEFAULT_TO_ID)!
    expect(screen.getByText(`+${diff.addedTotal.toLocaleString('zh')}`)).toBeInTheDocument()
    const full = container.querySelector('[data-cum-chart="full"]')!
    expect(full.querySelector(`[data-marker="${DEFAULT_FROM_ID}"]`)!.textContent).toContain('A')
    expect(full.querySelector(`[data-marker="${DEFAULT_TO_ID}"]`)!.textContent).toContain('B')
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    assertNoInteractive(container)
  })
})
```

Run: `npx vitest run tests/static/StaticCumulative.test.tsx`
Expected: FAIL，找不到模块

- [ ] **Step 2: 实现 `components/static/StaticCumulative.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { CumulativeAxes } from '@/components/chapter-01/CumulativeAxes'
import { CumulativeMarker, markerBaseRadius } from '@/components/chapter-01/CumulativeMarker'
import { VersionDiffCard } from '@/components/chapter-01/VersionDiffCard'
import { StaticTable, TH, TD } from './StaticTable'
import {
  buildGeometry, buildSeries, computeVersionDiff,
  CUM_W, CUM_H, DEFAULT_FROM_ID, DEFAULT_TO_ID, RANGE_START,
  type CumulativeGeometry, type DiffResult,
} from '@/lib/charts/cumulative'
import type { Chapter01Data } from '@/types/chapter-01'

function NumberBadge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={7} fill="var(--ink)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="800" fill="white" className="tabular">
        {n}
      </text>
    </g>
  )
}

interface ChartProps {
  id: 'full' | 'since-2015'
  geometry: CumulativeGeometry
  numbers: Map<string, number>
  diff: DiffResult | null
  ariaLabel: string
  yAxisLabel: string
  locale: string
}

function NumberedChart({ id, geometry, numbers, diff, ariaLabel, yAxisLabel, locale }: ChartProps) {
  return (
    <svg data-cum-chart={id} viewBox={`0 0 ${CUM_W} ${CUM_H}`} className="w-full select-none" role="img" aria-label={ariaLabel}>
      <CumulativeAxes geometry={geometry} locale={locale} yAxisLabel={yAxisLabel} />
      {geometry.points.map(p => {
        const r = markerBaseRadius(p)
        const compare = diff?.fromNode.node.id === p.id ? 'A' : diff?.toNode.node.id === p.id ? 'B' : null
        return (
          <g key={p.id} data-marker={p.id}>
            <CumulativeMarker p={p} isActive={false} compare={compare} />
            <NumberBadge x={p.cx + r * 0.75} y={p.cy - r * 0.75 - 4} n={numbers.get(p.id) ?? 0} />
          </g>
        )
      })}
    </svg>
  )
}

export function StaticCumulative({ data }: { data: Chapter01Data }) {
  const t = useTranslations('ch01.chart')
  const st = useTranslations('static.cumulative')
  const narrativeT = useTranslations()
  const locale = useLocale() as 'zh' | 'en'

  const series = useMemo(() => buildSeries(data.timeline), [data.timeline])
  const numbers = useMemo(() => new Map(series.map((d, i) => [d.node.id, i + 1])), [series])
  const full = useMemo(() => buildGeometry(series, data.decadeIndex, RANGE_START.all), [series, data.decadeIndex])
  const zoomed = useMemo(() => buildGeometry(series, data.decadeIndex, RANGE_START['since-2015']), [series, data.decadeIndex])
  const diff = useMemo(() => computeVersionDiff(series, DEFAULT_FROM_ID, DEFAULT_TO_ID), [series])
  const decadeSet = new Set(data.decadeIndex)
  const finalTotal = series[series.length - 1]?.runningTotal ?? 0

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">{t('title', { lastYear: full.maxYear })}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {finalTotal.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">{t('totalBy', { year: full.maxYear })}</div>
        </div>
      </div>
      <p className="text-[10px] text-[color:var(--muted)] mb-2">{st('note')}</p>

      <NumberedChart id="full" geometry={full} numbers={numbers} diff={diff} locale={locale}
        ariaLabel={t('ariaLabel', { count: full.points.length })} yAxisLabel={t('yAxis')} />

      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted)] mb-2">{st('insetTitle')}</div>
        <NumberedChart id="since-2015" geometry={zoomed} numbers={numbers} diff={diff} locale={locale}
          ariaLabel={t('ariaLabel', { count: zoomed.points.length })} yAxisLabel={t('yAxis')} />
      </div>

      {diff && (
        <>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px] font-bold text-[color:var(--muted)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider">{t('diff.eyebrow')}</span>
            <span>
              {t('diff.from')}{' '}
              <span className="text-[color:var(--ink)]">
                {t('diff.optionLabel', { version: diff.fromNode.node.versionLabel, year: diff.fromNode.node.year })}
              </span>
            </span>
            <span>
              {t('diff.to')}{' '}
              <span className="text-[color:var(--ink)]">
                {t('diff.optionLabel', { version: diff.toNode.node.versionLabel, year: diff.toNode.node.year })}
                {diff.toNode.node.draft ? t('diff.draftSuffix') : ''}
              </span>
            </span>
          </div>
          <VersionDiffCard diff={diff} />
        </>
      )}

      <StaticTable caption={st('tableCaption')}>
        <thead>
          <tr>
            <th className={TH}>{st('colNo')}</th>
            <th className={TH}>{st('colVersion')}</th>
            <th className={TH}>{t('added')}</th>
            <th className={TH}>{t('total')}</th>
            <th className={TH}>{t('growth')}</th>
            <th className={TH}>{st('colSamples')}</th>
            <th className={TH}>{st('colNarrative')}</th>
            <th className={TH}>{st('colSource')}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d, i) => (
            <tr key={d.node.id} data-row={d.node.id}>
              <td className={`${TD} text-[color:var(--muted)]`}>{i + 1}</td>
              <td className={`${TD} whitespace-nowrap`}>
                <span className="text-base mr-1.5">{d.node.highlightEmojis[0]}</span>
                <span className="font-semibold">{d.node.year} · {d.node.versionLabel}</span>
                {decadeSet.has(d.node.year) && (
                  <span className="ml-1.5 text-[9px] font-bold text-[color:var(--muted)] uppercase tracking-wider">{t('milestone')}</span>
                )}
                {d.node.draft && (
                  <span className="ml-1.5 text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--muted)] text-white">{t('draftBadge')}</span>
                )}
              </td>
              <td className={`${TD} font-semibold text-[color:var(--accent-01)]`}>+{d.node.newEmojiCount.toLocaleString(locale)}</td>
              <td className={`${TD} font-semibold`}>{d.runningTotal.toLocaleString(locale)}</td>
              <td className={`${TD} font-semibold text-[color:var(--accent-04)]`}>
                {d.previousTotal === 0 ? '—' : `+${Math.round(d.growthPct)}%`}
              </td>
              <td className={`${TD} text-sm whitespace-nowrap`}>{d.node.highlightEmojis.slice(0, 5).join(' ')}</td>
              <td className={`${TD} min-w-[16rem] leading-relaxed text-[color:var(--muted)]`}>{narrativeT(d.node.narrativeKey as never)}</td>
              <td className={`${TD} whitespace-nowrap`}><Citation source={d.node.source} locale={locale} /></td>
            </tr>
          ))}
        </tbody>
      </StaticTable>
    </div>
  )
}
```

- [ ] **Step 3: 接入 `StaticStory`**

`components/static/StaticStory.tsx`：加 `import { StaticCumulative } from './StaticCumulative'`；参数改为 `{ ch01, ch02 }: Props`（Task 7、8 再补 `ch01Cat`、`ch01Var`）；ch01 区块内容换成：

```tsx
        <div data-track-section="ch01-cumulative" className="max-w-6xl mx-auto px-6 pt-12 pb-8">
          <StaticCumulative data={ch01} />
        </div>
```

- [ ] **Step 4: 运行测试 + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/static/StaticCumulative.tsx components/static/StaticStory.tsx tests/static/StaticCumulative.test.tsx
git commit -m "feat(static): numbered cumulative chart, 2015+ close-up and per-version table"
```

---

### Task 7: 静态分类 treemap（小多图 + 矩阵表）

**Files:**
- Create: `components/static/StaticTreemap.tsx`, `tests/static/StaticTreemap.test.tsx`
- Modify: `components/static/StaticStory.tsx`

**Interfaces:**
- Consumes：Task 2 的 `layoutTreemap`、`tileTextLayout`、`sampleRuns`、`TREEMAP_W/H`
- Produces：`<StaticTreemap data />`；DOM 钩子 `[data-tile="<group>"]`、`figure[data-frame="<versionId>"]`、`tr[data-group-row="<group>"]`

- [ ] **Step 1: 写失败测试**

`tests/static/StaticTreemap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticTreemap } from '@/components/static/StaticTreemap'
import { sampleRuns } from '@/lib/charts/treemap'
import cat from '@/data/chapter-01-categories.json'
import type { Chapter01CategoryData } from '@/types/chapter-01'

const data = cat as Chapter01CategoryData

describe('<StaticTreemap>', () => {
  it('shows the latest frame large plus one small treemap per version', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    expect(container.querySelectorAll('figure[data-frame]')).toHaveLength(data.frames.length)
    expect(container.querySelectorAll('[data-tile]')).toHaveLength(9 * (data.frames.length + 1))
  })

  it('tabulates count and share for every group × version', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    expect(container.querySelectorAll('tr[data-group-row]')).toHaveLength(9)
    for (const key of data.groupOrder) {
      const row = container.querySelector(`tr[data-group-row="${key}"]`)!
      expect(row.textContent).toContain(msg('zh', `ch01.categoryTreemap.groups.${key}`))
      const cells = row.querySelectorAll('td[data-frame-cell]')
      expect(cells).toHaveLength(data.frames.length)
      data.frames.forEach((f, i) => {
        expect(cells[i].textContent).toContain(f.counts[key].toLocaleString('zh'))
        expect(cells[i].textContent).toContain(`${((f.counts[key] / f.total) * 100).toFixed(1)}%`)
      })
      for (const run of sampleRuns(data.frames, key)) expect(row.textContent).toContain(run.samples.join(' '))
    }
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    assertNoInteractive(container)
  })
})
```

Run: `npx vitest run tests/static/StaticTreemap.test.tsx`
Expected: FAIL，找不到模块

- [ ] **Step 2: 实现 `components/static/StaticTreemap.tsx`**

```tsx
'use client'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { StaticTable, TH, TD } from './StaticTable'
import { layoutTreemap, sampleRuns, tileTextLayout, TREEMAP_W, TREEMAP_H } from '@/lib/charts/treemap'
import type { CategoryFrame, CategoryGroupKey, Chapter01CategoryData } from '@/types/chapter-01'

const SMALL_W = 280
const SMALL_H = 146

function TreemapSvg({ frame, groupOrder, w, h }: { frame: CategoryFrame; groupOrder: CategoryGroupKey[]; w: number; h: number }) {
  const t = useTranslations('ch01.categoryTreemap')
  const locale = useLocale()
  const tiles = layoutTreemap(frame, groupOrder, w, h)
  const rx = Math.max(4, Math.round(12 * (w / TREEMAP_W)))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full select-none" role="img"
      aria-label={t('ariaLabel', { year: frame.year, version: frame.versionLabel, total: frame.total })}>
      {tiles.map(tile => {
        const label = t(`groups.${tile.key}` as never)
        const L = tileTextLayout(tile, label)
        const percent = (tile.count / frame.total) * 100
        const glyph = frame.samples[tile.key]?.[0] ?? ''
        return (
          <g key={tile.key} data-tile={tile.key}>
            <rect x={tile.x} y={tile.y} width={tile.w} height={tile.h} fill={`var(--cat-${tile.key})`} opacity={0.9} rx={rx} />
            {glyph && (
              <text x={tile.x + tile.w / 2} y={L.stageCy} textAnchor="middle" dominantBaseline="central"
                fontSize={L.emojiSize} aria-hidden="true" style={{ fontVariantEmoji: 'emoji' }}>
                {glyph}
              </text>
            )}
            {L.hasText && (
              <>
                <rect x={tile.x} y={tile.y + tile.h - L.textBandH} width={tile.w} height={L.textBandH} fill="black" opacity={0.08} />
                {L.canShowLabel && (
                  <text x={L.labelX} y={L.labelY} textAnchor={L.labelAnchor} fontSize="10" fontWeight="800"
                    letterSpacing="0.06em" fill="#1a1a1a" style={{ textTransform: 'uppercase' }}>
                    {label}
                  </text>
                )}
                <text x={L.countX} y={L.countY} textAnchor={L.countAnchor} fontSize="12" fontWeight="900" className="tabular" fill="#1a1a1a">
                  {tile.count.toLocaleString(locale)}
                  <tspan className="font-bold" fill="#3a3a3a" dx="6" fontSize="10">{percent.toFixed(1)}%</tspan>
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function StaticTreemap({ data }: { data: Chapter01CategoryData }) {
  const t = useTranslations('ch01.categoryTreemap')
  const st = useTranslations('static.treemap')
  const locale = useLocale() as 'zh' | 'en'
  const frames = data.frames
  const latest = frames[frames.length - 1]

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">{t('title')}</div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1 max-w-xl">{st('subtitle')}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {latest.total.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">{t('totalBy', { version: latest.versionLabel })}</div>
        </div>
      </div>

      <TreemapSvg frame={latest} groupOrder={data.groupOrder} w={TREEMAP_W} h={TREEMAP_H} />

      <div className="mt-8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{st('smallMultiplesTitle')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          {frames.map(f => (
            <figure key={f.versionId} data-frame={f.versionId}>
              <TreemapSvg frame={f} groupOrder={data.groupOrder} w={SMALL_W} h={SMALL_H} />
              <figcaption className="mt-1 text-[10px] font-bold tabular text-[color:var(--muted)]">
                {f.versionLabel} · {f.year} · {f.total.toLocaleString(locale)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <StaticTable caption={st('tableCaption')}>
        <thead>
          <tr>
            <th className={TH}>{st('colGroup')}</th>
            {frames.map(f => (
              <th key={f.versionId} className={TH}>{f.versionLabel}<br />{f.year}</th>
            ))}
            <th className={TH}>{st('colSamples')}</th>
          </tr>
        </thead>
        <tbody>
          {data.groupOrder.map(key => (
            <tr key={key} data-group-row={key}>
              <td className={`${TD} whitespace-nowrap font-semibold`}>
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: `var(--cat-${key})` }} />
                {t(`groups.${key}` as never)}
              </td>
              {frames.map(f => (
                <td key={f.versionId} data-frame-cell className={`${TD} whitespace-nowrap`}>
                  <div className="font-semibold">{f.counts[key].toLocaleString(locale)}</div>
                  <div className="text-[10px] text-[color:var(--muted)]">{((f.counts[key] / f.total) * 100).toFixed(1)}%</div>
                </td>
              ))}
              <td className={`${TD} min-w-[14rem]`}>
                {sampleRuns(frames, key).map(run => (
                  <div key={run.fromLabel} className="whitespace-nowrap">
                    <span className="text-sm">{run.samples.join(' ')}</span>{' '}
                    <span className="text-[10px] text-[color:var(--muted)]">
                      ({run.fromLabel === run.toLabel ? run.fromLabel : st('runRange', { from: run.fromLabel, to: run.toLabel })})
                    </span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </StaticTable>

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] text-[color:var(--muted)]">
        <span>{t('caption')}</span>
        <Citation source={data.source} locale={locale} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 接入 `StaticStory`**

加 `import { StaticTreemap } from './StaticTreemap'`；参数解构加 `ch01Cat`；在累计图 div 之后加入（与交互版 `app/[locale]/page.tsx` 的包装类名一致）：

```tsx
        <div data-track-section="ch01-treemap" className="max-w-6xl mx-auto px-6 pt-2 pb-8 border-t border-[color:var(--line)]/40">
          <div className="pt-8">
            <StaticTreemap data={ch01Cat} />
          </div>
        </div>
```

- [ ] **Step 4: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add components/static/StaticTreemap.tsx components/static/StaticStory.tsx tests/static/StaticTreemap.test.tsx
git commit -m "feat(static): treemap small multiples and group × version matrix"
```

---

### Task 8: 静态变体 Sankey（全部表情珠 + 节点/流向表）

**Files:**
- Create: `components/static/StaticSankey.tsx`, `tests/static/StaticSankey.test.tsx`
- Modify: `components/static/StaticStory.tsx`

**Interfaces:**
- Consumes：Task 3 的 `buildSankey`、`sankeyPath`、`beadGlyphs`、`beadSize`、`SANKEY_W/H/PAD`、`LaidNode`
- Produces：`<StaticSankey data />`；DOM 钩子 `[data-flow="<mech>::<group>"]`、`[data-bead]`、`tr[data-node-row]`、`tr[data-flow-row]`

- [ ] **Step 1: 写失败测试**

`tests/static/StaticSankey.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive } from '../helpers/intl'
import { StaticSankey } from '@/components/static/StaticSankey'
import { beadCount } from '@/lib/charts/sankey'
import v from '@/data/chapter-01-variants.json'
import type { Chapter01VariantData } from '@/types/chapter-01'

const data = v as Chapter01VariantData

describe('<StaticSankey>', () => {
  it('draws every flow with its beads showing', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    expect(container.querySelectorAll('[data-flow]')).toHaveLength(22)
    const expectedBeads = data.flows.filter(f => f.examples.length > 0).reduce((a, f) => a + beadCount(f.count), 0)
    expect(container.querySelectorAll('[data-bead]')).toHaveLength(expectedBeads)
  })

  it('tabulates every node and flow tooltip', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    expect(container.querySelectorAll('tr[data-node-row]')).toHaveLength(17)
    const flowRows = container.querySelectorAll('tr[data-flow-row]')
    expect(flowRows).toHaveLength(22)
    data.flows.forEach((f, i) => {
      const mech = data.mechanisms.find(m => m.id === f.mechanism)!
      const text = flowRows[i].textContent!
      expect(text).toContain(f.count.toLocaleString('zh'))
      expect(text).toContain(`${((f.count / data.snapshot.total) * 100).toFixed(1)}%`)
      expect(text).toContain(`${((f.count / mech.count) * 100).toFixed(1)}%`)
      if (f.examples[0]) expect(text).toContain(f.examples[0])
    })
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    assertNoInteractive(container)
  })
})
```

Run: `npx vitest run tests/static/StaticSankey.test.tsx`
Expected: FAIL，找不到模块

- [ ] **Step 2: 实现 `components/static/StaticSankey.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { StaticTable, TH, TD } from './StaticTable'
import { buildSankey, beadGlyphs, beadSize, sankeyPath, SANKEY_W as W, SANKEY_H as H, SANKEY_PAD as PAD } from '@/lib/charts/sankey'
import type { Chapter01VariantData } from '@/types/chapter-01'

export function StaticSankey({ data }: { data: Chapter01VariantData }) {
  const t = useTranslations('ch01.variantSankey')
  const groupT = useTranslations('ch01.categoryTreemap.groups')
  const st = useTranslations('static.sankey')
  const locale = useLocale() as 'zh' | 'en'
  const total = data.snapshot.total

  const layout = useMemo(
    () => buildSankey(data, id => t(`mechanisms.${id}.label` as never), g => groupT(g as never)),
    [data, t, groupT],
  )
  const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">{t('title')}</div>
          <div className="text-[11px] text-[color:var(--muted)] mt-1 max-w-2xl">
            {st('subtitle', { version: data.snapshot.versionLabel, total: total.toLocaleString(locale) })}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
            {total.toLocaleString(locale)}
          </div>
          <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">{data.snapshot.versionLabel}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img"
        aria-label={t('ariaLabel', { total, version: data.snapshot.versionLabel })}>
        <g>
          {layout.links.map(l => (
            <g key={`${l.mechanism}::${l.group}`} data-flow={`${l.mechanism}::${l.group}`}>
              <path d={sankeyPath(l)} fill="none" stroke={`var(--mech-${l.mechanism})`} strokeWidth={Math.max(l.width, 0.5)} opacity={0.42} />
              {beadGlyphs(l, data).map((b, j) => (
                <text key={j} data-bead x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={beadSize(l.width)} aria-hidden="true" style={{ fontVariantEmoji: 'emoji' }}>
                  {b.glyph}
                </text>
              ))}
            </g>
          ))}
        </g>
        <g>
          {layout.nodes.map(n => {
            const accentVar = n.kind === 'mechanism' ? `--mech-${n.refId}` : `--cat-${n.refId}`
            return (
              <g key={n.id}>
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(n.y1 - n.y0, 1)} rx={3} fill={`var(${accentVar})`} opacity={0.92} />
                <text
                  x={n.kind === 'mechanism' ? n.x1 + 8 : n.x0 - 8}
                  y={(n.y0 + n.y1) / 2}
                  textAnchor={n.kind === 'mechanism' ? 'start' : 'end'}
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="800"
                  fill="var(--ink)"
                  className="tabular"
                >
                  {n.label}
                  <tspan fontSize="10" fontWeight="700" fill="var(--muted)" dx="6">{n.total.toLocaleString(locale)}</tspan>
                </text>
              </g>
            )
          })}
        </g>
        <text x={PAD.left} y={12} fontSize="9" fontWeight="800" letterSpacing="0.15em" fill="var(--muted)">{t('columnLeft')}</text>
        <text x={W - PAD.right} y={12} textAnchor="end" fontSize="9" fontWeight="800" letterSpacing="0.15em" fill="var(--muted)">{t('columnRight')}</text>
      </svg>

      <StaticTable caption={st('nodeTableCaption')}>
        <thead>
          <tr>
            <th className={TH}>{st('colKind')}</th>
            <th className={TH}>{st('colNode')}</th>
            <th className={TH}>{t('tooltipCount')}</th>
            <th className={TH}>{t('tooltipShare')}</th>
            <th className={TH}>{st('colExamples')}</th>
          </tr>
        </thead>
        <tbody>
          {layout.nodes.map(n => (
            <tr key={n.id} data-node-row={n.id}>
              <td className={`${TD} text-[color:var(--muted)] whitespace-nowrap`}>{n.kind === 'mechanism' ? st('kindMechanism') : st('kindGroup')}</td>
              <td className={`${TD} font-semibold whitespace-nowrap`}>
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                  style={{ background: `var(${n.kind === 'mechanism' ? `--mech-${n.refId}` : `--cat-${n.refId}`})` }} />
                {n.label}
              </td>
              <td className={`${TD} font-semibold`}>{n.total.toLocaleString(locale)}</td>
              <td className={TD}>{pct(n.total, total)}</td>
              <td className={`${TD} text-sm whitespace-nowrap`}>{n.examples.slice(0, 6).join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </StaticTable>

      <StaticTable caption={st('flowTableCaption')}>
        <thead>
          <tr>
            <th className={TH}>{st('colFlow')}</th>
            <th className={TH}>{t('tooltipCount')}</th>
            <th className={TH}>{t('tooltipShare')}</th>
            <th className={TH}>{st('colShareOfMech')}</th>
            <th className={TH}>{st('colExamples')}</th>
          </tr>
        </thead>
        <tbody>
          {data.flows.map(f => {
            const mech = data.mechanisms.find(m => m.id === f.mechanism)
            return (
              <tr key={`${f.mechanism}::${f.group}`} data-flow-row={`${f.mechanism}::${f.group}`}>
                <td className={`${TD} font-semibold whitespace-nowrap`}>
                  {t(`mechanisms.${f.mechanism}.label` as never)} → {groupT(f.group as never)}
                </td>
                <td className={`${TD} font-semibold`}>{f.count.toLocaleString(locale)}</td>
                <td className={TD}>{pct(f.count, total)}</td>
                <td className={TD}>{mech ? pct(f.count, mech.count) : '—'}</td>
                <td className={`${TD} text-sm whitespace-nowrap`}>{f.examples.slice(0, 6).join(' ')}</td>
              </tr>
            )
          })}
        </tbody>
      </StaticTable>

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] text-[color:var(--muted)]">
        <span className="max-w-2xl">{t('caption')}</span>
        <Citation source={data.source} locale={locale} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 接入 `StaticStory`**

加 `import { StaticSankey } from './StaticSankey'`；参数解构加 `ch01Var`；在 treemap div 之后加入：

```tsx
        <div data-track-section="ch01-sankey" className="max-w-6xl mx-auto px-6 pt-2 pb-16 border-t border-[color:var(--line)]/40">
          <div className="pt-8">
            <StaticSankey data={ch01Var} />
          </div>
        </div>
```

- [ ] **Step 4: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add components/static/StaticSankey.tsx components/static/StaticStory.tsx tests/static/StaticSankey.test.tsx
git commit -m "feat(static): sankey with every flow's beads plus node and flow tables"
```

---

### Task 9: 静态文化原点地图（全图 + 局部放大 + 全表）

**Files:**
- Create: `components/static/StaticOriginMap.tsx`, `tests/static/StaticOriginMap.test.tsx`
- Modify: `components/static/StaticWhoGetsIn.tsx`

**Interfaces:**
- Consumes：Task 4 的 `useWorldFeatures`、`makeProjection`、`placePins`、`MAP_INSETS`、`pinsInBox`、`insetProjection`、`MAP_W/H`
- Produces：`<StaticOriginMap pins />`；DOM 钩子 `svg[data-map="main"]`、`figure[data-inset="<id>"]`、`[data-pin="<id>"]`、`tr[data-pin-row]`

- [ ] **Step 1: 写失败测试**

`tests/static/StaticOriginMap.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticOriginMap } from '@/components/static/StaticOriginMap'
import ch02 from '@/data/chapter-02.json'
import type { OriginPin } from '@/types/chapter-02'

const pins = ch02.origins as OriginPin[]
const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 }))) })
afterAll(() => { vi.unstubAllGlobals() })

async function renderLoaded() {
  const r = renderIntl(<StaticOriginMap pins={pins} />)
  await waitFor(() => expect(r.container.querySelector('svg[data-map="main"]')).not.toBeNull())
  return r
}

describe('<StaticOriginMap>', () => {
  it('draws all countries and all 41 numbered pins on the world map', async () => {
    const { container } = await renderLoaded()
    const main = container.querySelector('svg[data-map="main"]')!
    expect(main.querySelectorAll('path')).toHaveLength(177)
    expect(main.querySelectorAll('[data-pin]')).toHaveLength(41)
  })

  it('resolves the dense regions in close-up maps', async () => {
    const { container } = await renderLoaded()
    const count = (id: string) => container.querySelectorAll(`figure[data-inset="${id}"] [data-pin]`).length
    expect(count('europe-mideast')).toBe(15)
    expect(count('east-asia')).toBe(8)
    expect(count('south-asia')).toBe(4)
    expect(count('mexico')).toBe(4)
  })

  it('lists every pin with its tooltip content', async () => {
    const { container } = await renderLoaded()
    const rows = container.querySelectorAll('tr[data-pin-row]')
    expect(rows).toHaveLength(41)
    pins.forEach((p, i) => {
      const text = rows[i].textContent!
      expect(text).toContain(String(i + 1))
      expect(text).toContain(p.emoji)
      expect(text).toContain(p.country)
      expect(text).toContain(String(p.year))
      expect(text).toContain(msg('zh', p.labelKey))
    })
  })

  it('has nothing to operate', async () => {
    const { container } = await renderLoaded()
    assertNoInteractive(container)
  })
})
```

Run: `npx vitest run tests/static/StaticOriginMap.test.tsx`
Expected: FAIL，找不到模块

- [ ] **Step 2: 实现 `components/static/StaticOriginMap.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { geoPath } from 'd3-geo'
import { useTranslations } from 'next-intl'
import type { FeatureCollection, Geometry } from 'geojson'
import { StaticTable, TH, TD } from './StaticTable'
import { useWorldFeatures } from '@/lib/use-world-features'
import {
  insetProjection, makeProjection, pinsInBox, placePins,
  MAP_INSETS, MAP_W, MAP_H, type PlacedPin,
} from '@/lib/charts/origin-map'
import type { OriginPin } from '@/types/chapter-02'

const INSET_W = 400
const INSET_H = 260

function Pins({ placed, numbers }: { placed: PlacedPin[]; numbers: Map<string, number> }) {
  return (
    <g>
      {placed.map(p => (
        <g key={p.id} data-pin={p.id} transform={`translate(${p.cx}, ${p.cy})`}>
          <circle r={14} fill="white" stroke="var(--accent-02)" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={14}>{p.emoji}</text>
          <circle cx={11} cy={-11} r={7} fill="var(--ink)" />
          <text x={11} y={-11} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="800" fill="white" className="tabular">
            {numbers.get(p.id)}
          </text>
        </g>
      ))}
    </g>
  )
}

function Countries({ features, path }: { features: FeatureCollection<Geometry>; path: ReturnType<typeof geoPath> }) {
  return (
    <g>
      {features.features.map((f, i) => (
        <path key={i} d={path(f) || ''} fill="#e8e8ed" stroke="#d2d2d7" strokeWidth={0.4} />
      ))}
    </g>
  )
}

export function StaticOriginMap({ pins }: { pins: OriginPin[] }) {
  const t = useTranslations('ch02.map')
  const st = useTranslations('static.map')
  const labelT = useTranslations()
  const features = useWorldFeatures()
  const projection = useMemo(makeProjection, [])
  const placed = useMemo(() => placePins(pins, projection), [pins, projection])
  const numbers = useMemo(() => new Map(pins.map((p, i) => [p.id, i + 1])), [pins])
  const insets = useMemo(
    () => MAP_INSETS.map(inset => {
      const proj = insetProjection(inset.box, INSET_W, INSET_H)
      return { ...inset, proj, placed: placePins(pinsInBox(pins, inset.box), proj) }
    }),
    [pins],
  )
  const uniqueCountries = new Set(pins.map(p => p.country)).size

  if (!features) {
    return (
      <div className="h-[420px] grid place-items-center text-[color:var(--muted)] text-sm bg-white rounded-2xl border border-[color:var(--line)] mt-6" aria-busy="true">
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="relative mt-8">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-sm font-bold mt-0.5">{t('title')}</div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[10px] text-[color:var(--muted)] mt-0.5 tabular">{t('regionsCount', { count: placed.length, countries: uniqueCountries })}</div>
        </div>
      </div>
      <p className="text-[10px] text-[color:var(--muted)] mb-2">{st('note')}</p>

      <svg data-map="main" viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full bg-white rounded-2xl border border-[color:var(--line)] select-none overflow-hidden"
        role="img" aria-label={t('ariaLabel', { count: placed.length })}>
        <Countries features={features} path={geoPath(projection)} />
        <Pins placed={placed} numbers={numbers} />
      </svg>

      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{st('insetsTitle')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {insets.map(inset => (
            <figure key={inset.id} data-inset={inset.id}>
              <svg viewBox={`0 0 ${INSET_W} ${INSET_H}`} className="w-full bg-white rounded-2xl border border-[color:var(--line)] select-none overflow-hidden"
                role="img" aria-label={st(`insets.${inset.id}` as never)}>
                <Countries features={features} path={geoPath(inset.proj)} />
                <Pins placed={inset.placed} numbers={numbers} />
              </svg>
              <figcaption className="mt-1 text-[10px] font-bold text-[color:var(--muted)]">
                {st(`insets.${inset.id}` as never)} · {st('insetCount', { count: inset.placed.length })}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <StaticTable caption={st('tableCaption')}>
        <thead>
          <tr>
            <th className={TH}>{st('colNo')}</th>
            <th className={TH}>{st('colEmoji')}</th>
            <th className={TH}>{st('colCountry')}</th>
            <th className={TH}>{st('colYear')}</th>
            <th className={TH}>{st('colOrigin')}</th>
          </tr>
        </thead>
        <tbody>
          {pins.map((p, i) => (
            <tr key={p.id} data-pin-row={p.id}>
              <td className={`${TD} text-[color:var(--muted)]`}>{i + 1}</td>
              <td className={`${TD} text-lg`}>{p.emoji}</td>
              <td className={`${TD} font-semibold text-[color:var(--accent-02)]`}>{p.country}</td>
              <td className={`${TD} font-semibold`}>{p.year}</td>
              <td className={`${TD} min-w-[16rem] leading-relaxed text-[color:var(--muted)]`}>{labelT(p.labelKey as never)}</td>
            </tr>
          ))}
        </tbody>
      </StaticTable>
    </div>
  )
}
```

- [ ] **Step 3: 接入 `StaticWhoGetsIn`**

加 `import { StaticOriginMap } from './StaticOriginMap'`；在 cases div 之后加（包装 div 必须始终存在——追踪要在挂载时就观察到它，不能随地图加载状态出现/消失）：

```tsx
        <div data-track-section="ch02-map"><StaticOriginMap pins={data.origins} /></div>
```

并把 `tests/static/scaffold.test.tsx` 的 `beforeAll` 中 fetch 桩保留不变（返回 500 时地图停在"加载中"，该测试只检查 §02 卡片）。

- [ ] **Step 4: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add components/static/StaticOriginMap.tsx components/static/StaticWhoGetsIn.tsx tests/static/StaticOriginMap.test.tsx
git commit -m "feat(static): origin map with numbered pins, regional close-ups and full table"
```

---

### Task 10: 实验构建开关（隐藏语言切换、npm 脚本）

**Files:**
- Create: `lib/experiment.ts`, `tests/ui/TopNav.test.tsx`
- Modify: `components/TopNav.tsx`, `package.json`, `.gitignore`

**Interfaces:**
- Produces：`isExperiment(): boolean`；npm 脚本 `build:experiment`、`experiment`

- [ ] **Step 1: 写失败测试**

`tests/ui/TopNav.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderIntl } from '../helpers/intl'

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/static',
  useRouter: () => ({ replace: vi.fn() }),
}))

import { TopNav } from '@/components/TopNav'

afterEach(() => { vi.unstubAllEnvs() })

describe('<TopNav>', () => {
  it('offers the language switch in the public build', () => {
    renderIntl(<TopNav />)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('drops the language switch in the experiment build, keeping chapter anchors', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    renderIntl(<TopNav />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
```

Run: `npx vitest run tests/ui/TopNav.test.tsx`
Expected: 第二个测试 FAIL（按钮仍在）

- [ ] **Step 2: 实现**

`lib/experiment.ts`:

```ts
/**
 * Experiment build switch. `NEXT_PUBLIC_*` is inlined at build time, so in the
 * public GitHub Pages build this is constant false and tracking code is inert.
 */
export function isExperiment(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIMENT === '1'
}
```

`components/TopNav.tsx`：`import { isExperiment } from '@/lib/experiment'`；把 `<button …>{switchLabel}</button>` 整体包成：

```tsx
      {/* Participants stay in the language their link assigns them. */}
      {!isExperiment() && (
        <button …原样…>
          {switchLabel}
        </button>
      )}
```

`package.json` scripts 增加：

```json
    "build:experiment": "NEXT_PUBLIC_EXPERIMENT=1 next build --turbopack",
    "experiment": "npm run build:experiment && node scripts/experiment-server.mjs",
```

`.gitignore` 末尾 `# project-specific` 段加：

```
/logs/
```

- [ ] **Step 3: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add lib/experiment.ts components/TopNav.tsx package.json .gitignore tests/ui/TopNav.test.tsx
git commit -m "feat(experiment): build flag that hides the language switch"
```

---

### Task 11: 行为记录核心（队列、停留、悬停、会话 ID）

**Files:**
- Create: `lib/tracking.ts`, `tests/lib/tracking.test.ts`

**Interfaces:**
- Consumes：无
- Produces：`type Condition = 'interactive' | 'static'`、`interface SessionContext { pid; sessionId; condition; locale }`、`interface Transport { post(body: string): Promise<boolean>; beacon(body: string): boolean }`、常量 `MAX_BATCH=50`、`FLUSH_THRESHOLD=20`、`FLUSH_MS=5000`、`HEARTBEAT_MS=15000`、`MAX_QUEUE=500`、`HOVER_MIN_MS=300`、`SCROLL_THROTTLE_MS=500`；`makeId(fill?)`、`createQueue(ctx, transport, env): EventQueue`（`push(type, payload?)`、`flush(): Promise<void>`、`flushBeacon()`、`size()`）、`createDwell(now)`（`setInView(id, v): number`、`setPageVisible(v): {id, ms}[]`、`totals()`）、`isSectionActive(ratio, rectHeight, viewportHeight): boolean`、`createHoverTimer(now)`（`start(key)`、`end(key): number | null`）、单例 `setActiveTracker(t | null)`、`track(target, action, detail?)`、`hoverStart(target, detail)`、`hoverEnd(target, detail)`

- [ ] **Step 1: 写失败测试**

`tests/lib/tracking.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createQueue, createDwell, createHoverTimer, isSectionActive, makeId,
  setActiveTracker, track, hoverStart, hoverEnd,
  FLUSH_THRESHOLD, MAX_BATCH, MAX_QUEUE, type Transport,
} from '@/lib/tracking'

const ctx = { pid: 'P1', sessionId: 's', condition: 'static' as const, locale: 'zh' }
const env = (clock = { t: 0 }) => ({ now: () => clock.t, viewport: () => ({ vw: 1440, vh: 900 }) })

function fakeTransport(results: boolean[] = []) {
  const posts: unknown[][] = []
  const beacons: unknown[][] = []
  const t: Transport = {
    post: vi.fn(async (body: string) => { posts.push(JSON.parse(body)); return results.length ? results.shift()! : true }),
    beacon: vi.fn((body: string) => { beacons.push(JSON.parse(body)); return true }),
  }
  return { t, posts, beacons }
}

afterEach(() => setActiveTracker(null))

describe('makeId', () => {
  it('works without crypto.randomUUID (plain-http LAN pages)', () => {
    const id = makeId(buf => buf.fill(171))
    expect(id).toBe('ab'.repeat(16))
  })
  it('defaults to crypto.getRandomValues', () => {
    expect(makeId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('createQueue', () => {
  it('stamps context, viewport, time and a sequence number', () => {
    const { t } = fakeTransport()
    const q = createQueue(ctx, t, env({ t: 42 }))
    q.push('scroll', { y: 10 })
    q.flushBeacon()
    const [ev] = (t.beacon as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]))[0]
    expect(ev).toMatchObject({ pid: 'P1', condition: 'static', locale: 'zh', vw: 1440, vh: 900, type: 'scroll', t: 42, y: 10, seq: 1 })
  })

  it('auto-flushes at the threshold', async () => {
    const { t, posts } = fakeTransport()
    const q = createQueue(ctx, t, env())
    for (let i = 0; i < FLUSH_THRESHOLD; i++) q.push('e')
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(q.size()).toBe(0)
  })

  it('keeps events when the collector is down and sends them later', async () => {
    const { t, posts } = fakeTransport([false, true])
    const q = createQueue(ctx, t, env())
    q.push('a'); q.push('b')
    await q.flush()
    expect(q.size()).toBe(2)
    q.push('c')
    await q.flush()
    expect(q.size()).toBe(0)
    expect(posts[1].map(e => (e as { type: string }).type)).toEqual(['a', 'b', 'c'])
  })

  it('does not drop events pushed while a post is in flight', async () => {
    let release!: (ok: boolean) => void
    const t: Transport = { post: () => new Promise(r => { release = r }), beacon: () => true }
    const q = createQueue(ctx, t, env())
    q.push('a')
    const p = q.flush()
    q.push('b')
    release(true)
    await p
    expect(q.size()).toBe(1)
  })

  it('sends at most MAX_BATCH per request and caps the queue', () => {
    const { t, beacons } = fakeTransport()
    const q = createQueue(ctx, { ...t, post: async () => false }, env())
    for (let i = 0; i < MAX_QUEUE + 10; i++) q.push('e')
    expect(q.size()).toBe(MAX_QUEUE)
    q.flushBeacon()
    expect(beacons.every(b => b.length <= MAX_BATCH)).toBe(true)
    expect(beacons.flat()).toHaveLength(MAX_QUEUE)
    expect((beacons[0][0] as { seq: number }).seq).toBe(11)
  })
})

describe('createDwell', () => {
  it('accumulates visible time per section and excludes hidden-tab time', () => {
    const clock = { t: 0 }
    const d = createDwell(() => clock.t)
    d.setInView('hero', true)
    clock.t = 1000
    expect(d.setPageVisible(false)).toEqual([{ id: 'hero', ms: 1000 }])
    clock.t = 5000
    d.setPageVisible(true)
    clock.t = 5500
    expect(d.setInView('hero', false)).toBe(500)
    expect(d.totals()).toEqual({ hero: 1500 })
  })
  it('totals include the running stint', () => {
    const clock = { t: 0 }
    const d = createDwell(() => clock.t)
    d.setInView('ch02-map', true)
    clock.t = 300
    expect(d.totals()).toEqual({ 'ch02-map': 300 })
  })
})

describe('isSectionActive', () => {
  it('accepts half the section visible', () => expect(isSectionActive(0.5, 100, 900)).toBe(true))
  it('accepts a tall section filling half the viewport', () => expect(isSectionActive(0.2, 450, 900)).toBe(true))
  it('rejects a sliver', () => expect(isSectionActive(0.1, 90, 900)).toBe(false))
})

describe('hover timer and singleton', () => {
  it('only reports hovers of at least 300 ms', () => {
    const clock = { t: 0 }
    const h = createHoverTimer(() => clock.t)
    h.start('k'); clock.t = 299
    expect(h.end('k')).toBeNull()
    h.start('k'); clock.t = 700
    expect(h.end('k')).toBe(401)
  })

  it('track/hover are no-ops until a tracker is active', () => {
    expect(() => { track('map', 'zoom', 2); hoverStart('map', 'x'); hoverEnd('map', 'x') }).not.toThrow()
  })

  it('routes interact events to the active tracker', () => {
    const clock = { t: 0 }
    const { t } = fakeTransport()
    const queue = createQueue(ctx, t, env(clock))
    setActiveTracker({ queue, hover: createHoverTimer(() => clock.t) })
    track('cumulative', 'range', 'since-2015')
    hoverStart('map', 'sushi-jp'); clock.t = 500; hoverEnd('map', 'sushi-jp')
    queue.flushBeacon()
    const events = (t.beacon as ReturnType<typeof vi.fn>).mock.calls.flatMap(c => JSON.parse(c[0]))
    expect(events).toMatchObject([
      { type: 'interact', target: 'cumulative', action: 'range', detail: 'since-2015' },
      { type: 'interact', target: 'map', action: 'hover', detail: 'sushi-jp', ms: 500 },
    ])
  })
})
```

Run: `npx vitest run tests/lib/tracking.test.ts`
Expected: FAIL，找不到 `@/lib/tracking`

- [ ] **Step 2: 实现 `lib/tracking.ts`**

```ts
export type Condition = 'interactive' | 'static'

export interface SessionContext {
  pid: string
  sessionId: string
  condition: Condition
  locale: string
}

export interface Transport {
  post(body: string): Promise<boolean>
  beacon(body: string): boolean
}

type Payload = Record<string, unknown>

export const MAX_BATCH = 50 // well under the server's 100-event / 64 KB limit
export const FLUSH_THRESHOLD = 20
export const FLUSH_MS = 5000
export const HEARTBEAT_MS = 15000
export const MAX_QUEUE = 500
export const HOVER_MIN_MS = 300
export const SCROLL_THROTTLE_MS = 500

/** 128-bit hex id. Uses getRandomValues, not randomUUID: the latter only exists
 *  in secure contexts, and lab machines open the page over plain http on a LAN IP. */
export function makeId(fill: (buf: Uint8Array) => Uint8Array = buf => crypto.getRandomValues(buf)): string {
  return Array.from(fill(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
}

export interface EventQueue {
  push(type: string, payload?: Payload): void
  flush(): Promise<void>
  flushBeacon(): void
  size(): number
}

export function createQueue(
  ctx: SessionContext,
  transport: Transport,
  env: { now: () => number; viewport: () => { vw: number; vh: number } },
): EventQueue {
  let queue: Payload[] = []
  let seq = 0
  let inflight = false

  const flush = async () => {
    if (inflight || queue.length === 0) return
    const batch = queue.slice(0, MAX_BATCH)
    const lastSeq = batch[batch.length - 1].seq as number
    inflight = true
    let ok = false
    try {
      ok = await transport.post(JSON.stringify(batch))
    } catch {
      ok = false
    }
    inflight = false
    // Acknowledge by sequence number, not position: events may have been
    // pushed (or the oldest trimmed) while the request was in flight.
    if (ok) queue = queue.filter(e => (e.seq as number) > lastSeq)
  }

  return {
    push(type, payload = {}) {
      seq += 1
      queue.push({ ...ctx, ...env.viewport(), type, t: env.now(), seq, ...payload })
      if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE)
      if (queue.length >= FLUSH_THRESHOLD) void flush()
    },
    flush,
    flushBeacon() {
      while (queue.length > 0) {
        const batch = queue.slice(0, MAX_BATCH)
        if (!transport.beacon(JSON.stringify(batch))) break
        queue = queue.slice(batch.length)
      }
    },
    size: () => queue.length,
  }
}

/** Per-section visible time. A section only accrues time while it is in view
 *  AND the tab is visible. */
export function createDwell(now: () => number) {
  const inView = new Set<string>()
  const since = new Map<string, number>()
  const totals: Record<string, number> = {}
  let pageVisible = true

  const stop = (id: string): number => {
    const s = since.get(id)
    if (s === undefined) return 0
    since.delete(id)
    const ms = now() - s
    totals[id] = (totals[id] ?? 0) + ms
    return ms
  }

  return {
    /** Returns the length of the stint that just ended (0 when entering). */
    setInView(id: string, visible: boolean): number {
      if (visible) {
        inView.add(id)
        if (pageVisible && !since.has(id)) since.set(id, now())
        return 0
      }
      inView.delete(id)
      return stop(id)
    },
    /** Returns the stints closed by the tab going hidden. */
    setPageVisible(visible: boolean): { id: string; ms: number }[] {
      pageVisible = visible
      if (visible) {
        for (const id of inView) if (!since.has(id)) since.set(id, now())
        return []
      }
      return [...since.keys()].map(id => ({ id, ms: stop(id) }))
    },
    totals(): Record<string, number> {
      const out = { ...totals }
      for (const [id, s] of since) out[id] = (out[id] ?? 0) + now() - s
      return out
    },
  }
}

/** A section counts as "being read" when half of it is visible, or — for
 *  sections taller than the screen, which never reach ratio 0.5 — when it
 *  fills at least half the viewport. */
export function isSectionActive(ratio: number, rectHeight: number, viewportHeight: number): boolean {
  return ratio >= 0.5 || rectHeight >= viewportHeight * 0.5
}

export function createHoverTimer(now: () => number) {
  const starts = new Map<string, number>()
  return {
    start(key: string) {
      starts.set(key, now())
    },
    /** Duration if the hover was long enough to count, else null. */
    end(key: string): number | null {
      const s = starts.get(key)
      if (s === undefined) return null
      starts.delete(key)
      const ms = now() - s
      return ms >= HOVER_MIN_MS ? ms : null
    },
  }
}

interface ActiveTracker {
  queue: EventQueue
  hover: ReturnType<typeof createHoverTimer>
}

let active: ActiveTracker | null = null

export function setActiveTracker(tracker: ActiveTracker | null) {
  active = tracker
}

/** Record a deliberate interaction. No-op outside the experiment build. */
export function track(target: string, action: string, detail?: unknown) {
  active?.queue.push('interact', { target, action, detail })
}

export function hoverStart(target: string, detail: unknown) {
  active?.hover.start(`${target}::${String(detail)}`)
}

export function hoverEnd(target: string, detail: unknown) {
  if (!active) return
  const ms = active.hover.end(`${target}::${String(detail)}`)
  if (ms !== null) active.queue.push('interact', { target, action: 'hover', detail, ms })
}
```

- [ ] **Step 3: 运行确认通过 + commit**

Run: `npx vitest run tests/lib/tracking.test.ts && npm run lint`
Expected: PASS

```bash
git add lib/tracking.ts tests/lib/tracking.test.ts
git commit -m "feat(experiment): tracking queue, section dwell and hover timing"
```

---

### Task 12: 浏览器接线 `initTracking` + `TrackingRoot` + 区块标记

**Files:**
- Create: `lib/tracking-session.ts`, `components/TrackingRoot.tsx`, `tests/lib/tracking-session.test.ts`, `tests/lib/track-sections.test.ts`
- Modify: `app/[locale]/page.tsx`, `app/[locale]/static/page.tsx`, `components/Hero.tsx`, `components/chapter-02/WhoGetsIn.tsx`, `components/Footer.tsx`

**Interfaces:**
- Consumes：Task 10 `isExperiment`；Task 11 全部导出；`withBasePath`
- Produces：`initTracking({ condition, locale }): () => void`；`<TrackingRoot condition />`

- [ ] **Step 1: 写失败测试**

`tests/lib/tracking-session.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initTracking } from '@/lib/tracking-session'
import { track } from '@/lib/tracking'

let ioCallback: IntersectionObserverCallback | null = null
const observed: Element[] = []

beforeEach(() => {
  observed.length = 0
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { ioCallback = cb }
    observe(el: Element) { observed.push(el) }
    disconnect() {}
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  vi.stubGlobal('Blob', class { constructor(public parts: string[]) {} })
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
  window.history.replaceState({}, '', '/zh/static/?pid=P017')
  document.body.innerHTML = '<section data-track-section="hero"></section><a href="https://unicode.org">u</a>'
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

// sendBeacon receives a Blob; the Blob stub above keeps the JSON string it was built from.
function sentEvents(): Record<string, unknown>[] {
  const calls = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls
  return calls.flatMap(c => JSON.parse((c[1] as unknown as { parts: string[] }).parts[0]))
}

describe('initTracking', () => {
  it('does nothing in the public build', () => {
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    track('x', 'y')
    window.dispatchEvent(new Event('pagehide'))
    expect(fetch).not.toHaveBeenCalled()
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
    expect(observed).toHaveLength(0)
    stop()
  })

  it('records a session in the experiment build', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    const stop = initTracking({ condition: 'static', locale: 'zh' })
    expect(observed).toHaveLength(1)

    ioCallback!([{ target: observed[0], isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 500 } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.dispatchEvent(new Event('pagehide'))

    const events = sentEvents()
    const types = events.map(e => e.type)
    expect(types).toEqual(expect.arrayContaining(['session_start', 'link', 'session_end']))
    for (const e of events) expect(e).toMatchObject({ pid: 'P017', condition: 'static', locale: 'zh' })
    expect(events.find(e => e.type === 'link')).toMatchObject({ href: 'https://unicode.org' })
    expect(events.find(e => e.type === 'session_end')!.dwell).toHaveProperty('hero')
    stop()
  })
})
```

`tests/lib/track-sections.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SECTIONS = ['hero', 'ch01-cumulative', 'ch01-treemap', 'ch01-sankey', 'ch02-pipeline', 'ch02-criteria', 'ch02-cases', 'ch02-map', 'footer']

function sectionsIn(files: string[]): string[] {
  const found = new Set<string>()
  for (const f of files) {
    const src = readFileSync(resolve(__dirname, '../..', f), 'utf8')
    for (const m of src.matchAll(/data-track-section="([a-z0-9-]+)"/g)) found.add(m[1])
  }
  return [...found].sort()
}

describe('tracked sections', () => {
  it('interactive and static pages mark the same sections', () => {
    const interactive = sectionsIn(['app/[locale]/page.tsx', 'components/Hero.tsx', 'components/chapter-02/WhoGetsIn.tsx', 'components/Footer.tsx'])
    const still = sectionsIn(['components/static/StaticHero.tsx', 'components/static/StaticStory.tsx', 'components/static/StaticWhoGetsIn.tsx', 'components/Footer.tsx'])
    expect(interactive).toEqual([...SECTIONS].sort())
    expect(still).toEqual([...SECTIONS].sort())
  })
})
```

Run: `npx vitest run tests/lib/tracking-session.test.ts tests/lib/track-sections.test.ts`
Expected: FAIL（模块不存在；交互版缺少区块标记）

- [ ] **Step 2: 实现 `lib/tracking-session.ts`**

```ts
import { isExperiment } from './experiment'
import { withBasePath } from './base-path'
import {
  createDwell, createHoverTimer, createQueue, isSectionActive, makeId, setActiveTracker,
  FLUSH_MS, HEARTBEAT_MS, SCROLL_THROTTLE_MS,
  type Condition, type Transport,
} from './tracking'

/** Wire the page up for the experiment. Returns a cleanup function; in the
 *  public build it does nothing and returns a no-op. */
export function initTracking({ condition, locale }: { condition: Condition; locale: string }): () => void {
  if (!isExperiment() || typeof window === 'undefined') return () => {}

  const now = () => Date.now()
  const endpoint = withBasePath('/api/log')
  const transport: Transport = {
    post: body =>
      fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
        .then(r => r.ok),
    beacon: body =>
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })),
  }
  const ctx = {
    pid: new URLSearchParams(window.location.search).get('pid') || 'anonymous',
    sessionId: makeId(),
    condition,
    locale,
  }
  const queue = createQueue(ctx, transport, { now, viewport: () => ({ vw: window.innerWidth, vh: window.innerHeight }) })
  const dwell = createDwell(now)
  setActiveTracker({ queue, hover: createHoverTimer(now) })

  const startedAt = now()
  const depth = () => {
    const h = document.documentElement.scrollHeight
    return h > 0 ? Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100)) : 0
  }
  let maxDepthPct = depth()
  let lastScroll = 0
  let ended = false

  queue.push('session_start', { ua: navigator.userAgent, path: window.location.pathname })

  const onScroll = () => {
    maxDepthPct = Math.max(maxDepthPct, depth())
    const t = now()
    if (t - lastScroll < SCROLL_THROTTLE_MS) return
    lastScroll = t
    queue.push('scroll', { y: Math.round(window.scrollY), maxDepthPct })
  }
  const onVisibility = () => {
    const visible = document.visibilityState === 'visible'
    for (const s of dwell.setPageVisible(visible)) queue.push('section_dwell', { section: s.id, ms: s.ms })
    queue.push('visibility', { state: visible ? 'visible' : 'hidden' })
    if (!visible) queue.flushBeacon()
  }
  const onPageHide = () => {
    if (ended) return
    ended = true
    queue.push('session_end', { ms: now() - startedAt, dwell: dwell.totals(), maxDepthPct })
    queue.flushBeacon()
  }
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href]')
    if (a) queue.push('link', { href: a.getAttribute('href') })
  }

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.trackSection
        if (!id) continue
        const activeNow =
          entry.isIntersecting && isSectionActive(entry.intersectionRatio, entry.intersectionRect.height, window.innerHeight)
        const ms = dwell.setInView(id, activeNow)
        if (!activeNow && ms > 0) queue.push('section_dwell', { section: id, ms })
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  )
  document.querySelectorAll('[data-track-section]').forEach(el => io.observe(el))

  const flushTimer = window.setInterval(() => void queue.flush(), FLUSH_MS)
  const heartbeatTimer = window.setInterval(
    () => queue.push('heartbeat', { ms: now() - startedAt, dwell: dwell.totals(), maxDepthPct }),
    HEARTBEAT_MS,
  )
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('click', onClick, true)

  return () => {
    io.disconnect()
    window.clearInterval(flushTimer)
    window.clearInterval(heartbeatTimer)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('click', onClick, true)
    setActiveTracker(null)
  }
}
```

`components/TrackingRoot.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { initTracking } from '@/lib/tracking-session'
import type { Condition } from '@/lib/tracking'

/** Starts behaviour logging for the experiment build (inert otherwise). Every
 *  `[data-track-section]` wrapper must already be in the DOM on mount. */
export function TrackingRoot({ condition }: { condition: Condition }) {
  const locale = useLocale()
  useEffect(() => initTracking({ condition, locale }), [condition, locale])
  return null
}
```

- [ ] **Step 3: 两个页面挂载 `TrackingRoot`，交互版补区块标记**

- `app/[locale]/page.tsx`：`import { TrackingRoot } from '@/components/TrackingRoot'`；在 `<Footer />` 之后加 `<TrackingRoot condition="interactive" />`；三处图表外层 div 分别加 `data-track-section="ch01-cumulative"`、`"ch01-treemap"`、`"ch01-sankey"`（顺序与现有三个 `max-w-6xl` div 对应）。
- `app/[locale]/static/page.tsx`：同样 import，在 `<Footer />` 之后加 `<TrackingRoot condition="static" />`。
- `components/Hero.tsx`：`<header data-track-section="hero" className=…>`。
- `components/Footer.tsx`：`<footer data-track-section="footer" className=…>`。
- `components/chapter-02/WhoGetsIn.tsx`：与 `StaticWhoGetsIn` 同样包装：

```tsx
        <div className="mt-6" data-track-section="ch02-pipeline"><Pipeline steps={data.pipeline} /></div>
        <div data-track-section="ch02-criteria"><CriteriaCards criteria={data.criteria} /></div>
        <div data-track-section="ch02-cases"><CaseCards cases={data.cases} /></div>
        <div data-track-section="ch02-map"><OriginMap pins={data.origins} /></div>
```

- [ ] **Step 4: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add lib/tracking-session.ts components/TrackingRoot.tsx app components/Hero.tsx components/Footer.tsx components/chapter-02/WhoGetsIn.tsx tests/lib/tracking-session.test.ts tests/lib/track-sections.test.ts
git commit -m "feat(experiment): session wiring, section dwell and shared section ids"
```

---

### Task 13: 交互版操作事件

**Files:**
- Create: `tests/ui/interact-tracking.test.tsx`
- Modify: `components/chapter-01/CumulativeChart.tsx`, `components/chapter-01/CategoryTreemap.tsx`, `components/chapter-01/VariantSankey.tsx`, `components/chapter-02/OriginMap.tsx`, `components/hero/EmojiField.tsx`

**Interfaces:**
- Consumes：Task 11 `track`、`hoverStart`、`hoverEnd`
- Produces：`interact` 事件，`target` ∈ `cumulative | treemap | sankey | map | hero`

- [ ] **Step 1: 写失败测试**

`tests/ui/interact-tracking.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, msg } from '../helpers/intl'

vi.mock('@/lib/tracking', () => ({ track: vi.fn(), hoverStart: vi.fn(), hoverEnd: vi.fn() }))

import { track, hoverStart } from '@/lib/tracking'
import { CumulativeChart } from '@/components/chapter-01/CumulativeChart'
import { CategoryTreemap } from '@/components/chapter-01/CategoryTreemap'
import { VariantSankey } from '@/components/chapter-01/VariantSankey'
import { OriginMap } from '@/components/chapter-02/OriginMap'
import ch01 from '@/data/chapter-01.json'
import cat from '@/data/chapter-01-categories.json'
import v from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { OriginPin } from '@/types/chapter-02'

const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeEach(() => {
  vi.mocked(track).mockClear()
  vi.mocked(hoverStart).mockClear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => vi.unstubAllGlobals())

describe('interaction events', () => {
  it('cumulative: range, pin, diff and hover', () => {
    const { container } = renderIntl(<CumulativeChart data={ch01 as Chapter01Data} />)
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch01.chart.range2015') }))
    expect(track).toHaveBeenCalledWith('cumulative', 'range', 'since-2015')
    const marker = container.querySelector('svg [role="button"]')!
    fireEvent.mouseEnter(marker)
    expect(hoverStart).toHaveBeenCalledWith('cumulative', expect.any(String))
    fireEvent.click(marker)
    expect(track).toHaveBeenCalledWith('cumulative', 'pin', expect.any(String))
    fireEvent.change(screen.getByLabelText(msg('zh', 'ch01.chart.diff.fromAria')), { target: { value: 'emoji-7-0' } })
    expect(track).toHaveBeenCalledWith('cumulative', 'diff', 'emoji-7-0→emoji-17-0')
  })

  it('treemap: slider and play', () => {
    renderIntl(<CategoryTreemap data={cat as Chapter01CategoryData} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
    expect(track).toHaveBeenCalledWith('treemap', 'slider', (cat as Chapter01CategoryData).frames[0].year)
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch01.categoryTreemap.playAria') }))
    expect(track).toHaveBeenCalledWith('treemap', 'play')
  })

  it('sankey: pin a flow', () => {
    const { container } = renderIntl(<VariantSankey data={v as Chapter01VariantData} />)
    fireEvent.click(container.querySelector('svg [role="button"]')!)
    expect(track).toHaveBeenCalledWith('sankey', 'pin', expect.stringMatching(/^flow::/))
  })

  it('map: zoom (debounced) and pin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 })))
    const { container } = renderIntl(<OriginMap pins={ch02.origins as OriginPin[]} />)
    const zoomIn = await screen.findByRole('button', { name: msg('zh', 'ch02.map.zoomIn') })
    fireEvent.click(zoomIn)
    await waitFor(() => expect(track).toHaveBeenCalledWith('map', 'zoom', 1.6), { timeout: 1500 })
    fireEvent.click(container.querySelector('[data-pin="true"]')!)
    expect(track).toHaveBeenCalledWith('map', 'pin', expect.any(String))
  })
})
```

Run: `npx vitest run tests/ui/interact-tracking.test.tsx`
Expected: FAIL（`track` 未被调用）

- [ ] **Step 2: 在各组件插入调用**

每个文件加 `import { track, hoverStart, hoverEnd } from '@/lib/tracking'`（只 import 用到的）。

`CumulativeChart.tsx`：

```tsx
  const onMarkerActivate = (id: string) => {
    track('cumulative', 'pin', id)
    setPinnedId(prev => (prev === id ? null : id))
  }
```

范围按钮 `onClick={() => { track('cumulative', 'range', r.id); setRange(r.id) }}`；两个 select：

```tsx
            onChange={(e) => { track('cumulative', 'diff', `${e.target.value}→${toId}`); setFromId(e.target.value) }}
```

```tsx
            onChange={(e) => { track('cumulative', 'diff', `${fromId}→${e.target.value}`); setToId(e.target.value) }}
```

marker `onMouseEnter={() => { setActiveId(p.id); hoverStart('cumulative', p.id) }}`、`onMouseLeave={() => { setActiveId(null); hoverEnd('cumulative', p.id) }}`。

`CategoryTreemap.tsx`：`onSliderChange` 开头加 `track('treemap', 'slider', frames[next].year)`（`next` 计算之后）；`onSliderKey` 的空格分支加 `track('treemap', playing ? 'pause' : 'play')`；播放按钮 `onClick={() => { track('treemap', playing ? 'pause' : 'play'); setPlaying(p => !p) }}`；`onTileActivate` 开头加 `track('treemap', 'pin', key)`；tile 的 `onMouseEnter`/`onMouseLeave` 分别追加 `hoverStart('treemap', tile.key)` / `hoverEnd('treemap', tile.key)`。

`VariantSankey.tsx`：`onActivate` 开头加 `track('sankey', 'pin', id)`；链接与节点的 `onMouseEnter` 追加 `hoverStart('sankey', id)`（节点用 `n.id`），`onMouseLeave` 追加 `hoverEnd('sankey', id)`（节点用 `n.id`）。

`OriginMap.tsx`：

```tsx
  // Zoom changes arrive from buttons, wheel, pinch and keys; log the level the
  // reader settles on rather than every wheel tick.
  const loggedK = useRef(1)
  useEffect(() => {
    if (zoom.k === loggedK.current) return
    const id = window.setTimeout(() => {
      loggedK.current = zoom.k
      track('map', 'zoom', Number(zoom.k.toFixed(1)))
    }, 400)
    return () => window.clearTimeout(id)
  }, [zoom.k])
```

（放在 `zoomRef.current = zoom` 之后。）鼠标与单指触摸的 `onDocUp`/`onDocEnd` 中 `if (moved) {` 分支第一行加 `track('map', 'pan')`；`onPinActivate` 在 `justDraggedRef` 判断之后加 `track('map', 'pin', id)`；图钉 `onMouseEnter`/`onMouseLeave` 追加 `hoverStart('map', p.id)` / `hoverEnd('map', p.id)`。

`EmojiField.tsx`：

```tsx
  const toggle = (i: number) => {
    track('hero', 'click', positioned[i]?.char)
    setActive(prev => { … 原样 … })
  }
```

（`toggle` 定义在 `positioned` 之前，把 `toggle` 移到 `positioned` 的 `useMemo` 之后。）

- [ ] **Step 3: 运行测试 + lint + commit**

Run: `npx vitest run && npm run lint`
Expected: PASS

```bash
git add components tests/ui/interact-tracking.test.tsx
git commit -m "feat(experiment): log deliberate interactions on the interactive page"
```

---

### Task 14: 实验服务器

**Files:**
- Create: `scripts/experiment-server.mjs`, `tests/scripts/experiment-server.test.ts`

**Interfaces:**
- Produces：`createExperimentServer({ root, logDir }): http.Server`、`validateEvents(text): object[] | null`、`MAX_EVENTS=100`、`MAX_BYTES=65536`；直接运行时读 `PORT`（默认 7777）、`OUT_DIR`（默认 `out`）、`LOG_DIR`（默认 `logs`）

- [ ] **Step 1: 写失败测试**

`tests/scripts/experiment-server.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createExperimentServer } from '../../scripts/experiment-server.mjs'

let base = ''
let root = ''
let logDir = ''
let server: ReturnType<typeof createExperimentServer>

beforeAll(async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'exp-'))
  root = join(tmp, 'out')
  logDir = join(tmp, 'logs')
  mkdirSync(join(root, 'zh/static'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<p>root</p>')
  writeFileSync(join(root, 'zh/static/index.html'), '<p>static zh</p>')
  writeFileSync(join(root, '404.html'), '<p>missing</p>')
  writeFileSync(join(root, 'app.js'), 'console.log(1)')
  writeFileSync(join(tmp, 'secret.txt'), 'do not serve')
  server = createExperimentServer({ root, logDir })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => { server.close() })
beforeEach(() => { rmSync(logDir, { recursive: true, force: true }) })

const post = (body: string) => fetch(`${base}/api/log`, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
const logLines = () => {
  let files: string[] = []
  try { files = readdirSync(logDir) } catch { return [] }
  return files.flatMap(f => readFileSync(join(logDir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)))
}

describe('experiment server', () => {
  it('health check', async () => {
    const r = await fetch(`${base}/api/health`)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('ok')
  })

  it('appends valid events to a dated JSONL file with server time and ip', async () => {
    const r = await post(JSON.stringify([{ type: 'session_start', pid: 'P1' }, { type: 'scroll', pid: 'P1' }]))
    expect(r.status).toBe(204)
    expect(readdirSync(logDir)[0]).toMatch(/^events-\d{4}-\d{2}-\d{2}\.jsonl$/)
    const lines = logLines()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ type: 'session_start', pid: 'P1' })
    expect(typeof lines[0].serverTime).toBe('string')
    expect(lines[0].ip).toContain('127.0.0.1')
  })

  it.each([
    ['invalid JSON', '{nope'],
    ['not an array', '{"type":"x"}'],
    ['empty array', '[]'],
    ['non-object items', '[1,2]'],
    ['too many events', JSON.stringify(Array.from({ length: 101 }, () => ({ type: 'e' })))],
    ['too large', JSON.stringify([{ type: 'e', pad: 'x'.repeat(70 * 1024) }])],
  ])('rejects %s with 400 and writes nothing', async (_, body) => {
    const r = await post(body)
    expect(r.status).toBe(400)
    expect(logLines()).toHaveLength(0)
  })

  it('only accepts POST on /api/log', async () => {
    expect((await fetch(`${base}/api/log`)).status).toBe(405)
  })

  it('serves directory indexes and assets', async () => {
    const r = await fetch(`${base}/zh/static/?pid=P1`)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/html')
    expect(await r.text()).toContain('static zh')
    expect((await fetch(`${base}/app.js`)).headers.get('content-type')).toContain('javascript')
  })

  it('redirects a directory without trailing slash, keeping the query', async () => {
    const r = await fetch(`${base}/zh/static?pid=P1`, { redirect: 'manual' })
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe('/zh/static/?pid=P1')
  })

  it('404s with the exported 404 page', async () => {
    const r = await fetch(`${base}/nope`)
    expect(r.status).toBe(404)
    expect(await r.text()).toContain('missing')
  })

  it('refuses paths that escape the export directory', async () => {
    const r = await fetch(`${base}/zh%2F..%2F..%2Fsecret.txt`)
    expect(r.status).toBe(403)
  })

  it('answers malformed percent-encoding with 400 instead of crashing', async () => {
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400)
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })
})
```

Run: `npx vitest run tests/scripts/experiment-server.test.ts`
Expected: FAIL，找不到 `scripts/experiment-server.mjs`

- [ ] **Step 2: 实现 `scripts/experiment-server.mjs`**

```js
// Serves the static export (out/) and collects behaviour logs for the user
// study. Node built-ins only, so it runs unchanged on a lab PC or a cloud VM:
//   npm run experiment            (build with NEXT_PUBLIC_EXPERIMENT=1, then serve)
//   node scripts/experiment-server.mjs   (serve an existing out/)
// Env: PORT (7777), OUT_DIR (out), LOG_DIR (logs).
import { createServer } from 'node:http'
import { createReadStream, existsSync, promises as fs } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MAX_EVENTS = 100
export const MAX_BYTES = 64 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function send(res, status, body = '', headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

/** Reads the whole body; returns null if it exceeds `limit` bytes. Keeps
 *  draining past the limit so the response can still be written. */
async function readBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size <= limit) chunks.push(chunk)
  }
  return size > limit ? null : Buffer.concat(chunks).toString('utf8')
}

/** Parsed events, or null unless the body is a non-empty array of at most
 *  MAX_EVENTS plain objects. */
export function validateEvents(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_EVENTS) return null
  if (!data.every(e => e !== null && typeof e === 'object' && !Array.isArray(e))) return null
  return data
}

async function handleLog(req, res, logDir) {
  if (req.method !== 'POST') return send(res, 405, 'method not allowed', { allow: 'POST' })
  const text = await readBody(req, MAX_BYTES)
  const events = text === null ? null : validateEvents(text)
  if (!events) return send(res, 400, 'bad request')
  const serverTime = new Date().toISOString()
  const ip = req.socket.remoteAddress ?? ''
  const lines = events.map(e => JSON.stringify({ ...e, serverTime, ip })).join('\n') + '\n'
  await fs.mkdir(logDir, { recursive: true })
  // One appendFile per request writes whole lines, so concurrent requests never interleave mid-line.
  await fs.appendFile(join(logDir, `events-${serverTime.slice(0, 10)}.jsonl`), lines)
  send(res, 204)
}

async function serveStatic(req, res, root, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return send(res, 400, 'bad request')
  }
  if (pathname.includes('\0')) return send(res, 400, 'bad request')
  const target = resolve(root, '.' + pathname)
  if (target !== root && !target.startsWith(root + sep)) return send(res, 403, 'forbidden')

  let file = target
  let stat = await fs.stat(file).catch(() => null)
  if (stat?.isDirectory()) {
    // The export uses trailingSlash; relative asset URLs break without it.
    if (!url.pathname.endsWith('/')) return send(res, 301, '', { location: `${url.pathname}/${url.search}` })
    file = join(file, 'index.html')
    stat = await fs.stat(file).catch(() => null)
  }
  if (!stat?.isFile()) {
    const page = await fs.readFile(join(root, '404.html')).catch(() => null)
    res.writeHead(404, { 'content-type': MIME['.html'] })
    return res.end(page ?? 'not found')
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

export function createExperimentServer({ root, logDir }) {
  const rootAbs = resolve(root)
  const logAbs = resolve(logDir)
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const work =
      url.pathname === '/api/log' ? handleLog(req, res, logAbs)
      : url.pathname === '/api/health' ? Promise.resolve(send(res, 200, 'ok'))
      : serveStatic(req, res, rootAbs, url)
    work.catch(err => {
      console.error('[experiment]', err)
      if (!res.headersSent) send(res, 500, 'internal error')
      else res.end()
    })
  })
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 7777)
  const root = resolve(process.env.OUT_DIR ?? 'out')
  const logDir = resolve(process.env.LOG_DIR ?? 'logs')
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`[experiment] ${root} has no index.html — run \`npm run build:experiment\` first.`)
    process.exit(1)
  }
  createExperimentServer({ root, logDir }).listen(port, '0.0.0.0', () => {
    console.log(`[experiment] serving ${root} on http://0.0.0.0:${port}`)
    console.log(`[experiment] logs → ${logDir}/events-YYYY-MM-DD.jsonl (UTC date)`)
    console.log(`[experiment] interactive: http://<host>:${port}/zh/?pid=P001`)
    console.log(`[experiment] static:      http://<host>:${port}/zh/static/?pid=P001`)
  })
}
```

- [ ] **Step 3: 运行确认通过 + lint + commit**

Run: `npx vitest run tests/scripts/experiment-server.test.ts && npm run lint`
Expected: PASS（`.mjs` 在 `tsconfig` 的 `allowJs` 下被 TS 推断类型；若 lint 报 `.mjs` 相关问题，按提示修，不要关规则）

```bash
git add scripts/experiment-server.mjs tests/scripts/experiment-server.test.ts
git commit -m "feat(experiment): zero-dependency server for the export and JSONL logs"
```

---

### Task 15: 整页对等检查、构建验证、冒烟脚本与文档

**Files:**
- Create: `tests/static/story.test.tsx`, `scripts/experiment_smoke.py`
- Modify: `README.md`

- [ ] **Step 1: 写整页测试**

`tests/static/story.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, stubResizeObserver } from '../helpers/intl'
import { StaticStory } from '@/components/static/StaticStory'
import ch01 from '@/data/chapter-01.json'
import ch01Cat from '@/data/chapter-01-categories.json'
import ch01Var from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeAll(() => {
  stubResizeObserver()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 })))
})
afterAll(() => vi.unstubAllGlobals())

describe.each(['zh', 'en'] as const)('static page (%s)', locale => {
  it('renders every chapter, all sections, and nothing operable', async () => {
    const { container } = renderIntl(
      <StaticStory
        ch01={ch01 as Chapter01Data}
        ch01Cat={ch01Cat as Chapter01CategoryData}
        ch01Var={ch01Var as Chapter01VariantData}
        ch02={ch02 as unknown as Chapter02Data}
      />,
      locale,
    )
    await waitFor(() => expect(container.querySelector('svg[data-map="main"]')).not.toBeNull())
    expect(container.querySelector('#ch01')).not.toBeNull()
    expect(container.querySelector('#ch02')).not.toBeNull()
    const sections = [...container.querySelectorAll('[data-track-section]')].map(el => el.getAttribute('data-track-section'))
    expect(sections).toEqual(['hero', 'ch01-cumulative', 'ch01-treemap', 'ch01-sankey', 'ch02-pipeline', 'ch02-criteria', 'ch02-cases', 'ch02-map'])
    assertNoInteractive(container)
    for (const a of container.querySelectorAll('a')) expect(a.getAttribute('href')).toMatch(/^https?:\/\//)
  })
})
```

Run: `npx vitest run tests/static/story.test.tsx`
Expected: PASS（前面各任务已实现；若失败，按报错修对应组件）

- [ ] **Step 2: 全量测试、lint、类型检查**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: 全部通过，无类型错误

- [ ] **Step 3: 公开构建验证（GitHub Pages 形态）**

先确认没有 `next dev` 在运行：`ps aux | grep -v grep | grep "next dev"`；若有，记下 PID 并 `kill <pid>`，再 `rm -rf .next`。

Run:

```bash
GITHUB_PAGES=true npm run build
ls out/zh/static/index.html out/en/static/index.html
grep -c 'data-track-section' out/zh/static/index.html
grep -o '/api/log' -r out/_next | head -1 || echo "no /api/log string in public bundle"
```

Expected: 两个 `index.html` 都存在；区块标记计数 > 0；公开包中若出现 `/api/log` 字符串是可以接受的（`initTracking` 被 `isExperiment()` 短路），但下一步的浏览器检查必须确认**没有**任何 `/api/log` 请求。

- [ ] **Step 4: 写冒烟脚本 `scripts/experiment_smoke.py`**

```python
"""Smoke-test the experiment build end to end.

Usage (server must be running: `npm run experiment`):
    python3 scripts/experiment_smoke.py [--base http://127.0.0.1:7777] [--logs logs]

Opens both conditions with a test pid, scrolls, waits past one heartbeat,
clicks a control on the interactive page, closes the pages, then checks the
JSONL log for the expected event types.
"""
import argparse
import glob
import json
import time

from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("--base", default="http://127.0.0.1:7777")
p.add_argument("--logs", default="logs")
args = p.parse_args()

pid = f"SMOKE-{int(time.time())}"

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for condition, path in (("static", "/zh/static/"), ("interactive", "/zh/")):
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{args.base}{path}?pid={pid}", wait_until="networkidle")
        assert page.locator("text=EN").count() == 0, "language switch must be hidden in the experiment build"
        for _ in range(12):
            page.mouse.wheel(0, 900)
            page.wait_for_timeout(400)
        if condition == "interactive":
            page.get_by_role("button", name="2015 → 至今").click()
        page.wait_for_timeout(16000)  # past one heartbeat
        page.close()
    browser.close()

time.sleep(1)
events = []
for f in glob.glob(f"{args.logs}/events-*.jsonl"):
    with open(f, encoding="utf-8") as fh:
        events += [json.loads(line) for line in fh if line.strip()]
mine = [e for e in events if e.get("pid") == pid]

ok = True
for condition in ("static", "interactive"):
    types = {e["type"] for e in mine if e.get("condition") == condition}
    need = {"session_start", "scroll", "section_dwell", "heartbeat", "session_end"}
    if condition == "interactive":
        need.add("interact")
    missing = need - types
    print(f"{condition:12s} events={sum(1 for e in mine if e.get('condition') == condition):4d} missing={sorted(missing) or '-'}")
    ok &= not missing
raise SystemExit(0 if ok else 1)
```

- [ ] **Step 5: 实验构建冒烟**

```bash
npm run build:experiment
node scripts/experiment-server.mjs   # 以后台方式运行（run_in_background），记下它的任务/PID
curl -s http://127.0.0.1:7777/api/health          # → ok
python3 scripts/experiment_smoke.py
```

Expected: 脚本打印两行且 `missing=-`，退出码 0。结束后停掉服务器进程，并删除本次冒烟产生的日志：`rm -rf logs`（`logs/` 已被 gitignore）。

- [ ] **Step 6: 视觉对比（人工）**

用公开构建（Step 3 的 `out/`）启动 `npx --yes serve out -l 7778`（后台），用 Playwright（Python）对 `/zh/`、`/zh/static/`、`/en/`、`/en/static/` 各截一张 1440 宽全页图与一张 390 宽全页图，保存到 scratchpad 目录（不入库）。逐张检查：
- 两版同一图表的配色、字体、形状一致；
- 静态版无 tooltip、无按钮、无滑块、Hero 表情不动；
- 390 宽时页面**没有**横向滚动（宽表格只在自身框内滚动）：在页面上执行 `document.documentElement.scrollWidth <= window.innerWidth` 应为 true；
- 静态版地图 `svg[data-map="main"] path` 数为 177（basePath 正确）；
- 打开浏览器网络记录，确认两版都**没有**发往 `/api/log` 的请求。

把发现的问题修掉后重跑 Step 2。

- [ ] **Step 7: README**

在 `README.md` 的 `## Run` 之后加一节：

````markdown
## Static control page & user-study logging

`/zh/static/` and `/en/static/` present the same information as the main page with no interaction and no motion — tooltips become labels and tables, the treemap slider becomes small multiples, the map's zoom becomes regional close-ups. The two versions do not link to each other. It is published on GitHub Pages alongside the main page.

For the user study, build and serve the experiment variant (language switch hidden, behaviour logging on):

```bash
npm run experiment            # build with NEXT_PUBLIC_EXPERIMENT=1, then serve on 0.0.0.0:7777
```

Give each participant one link:

- interactive: `http://<host>:7777/zh/?pid=P001`
- static:      `http://<host>:7777/zh/static/?pid=P001`

Events are appended to `logs/events-YYYY-MM-DD.jsonl` (UTC date, one JSON object per line, `logs/` is git-ignored): `session_start`, `scroll`, `section_dwell`, `visibility`, `heartbeat` (every 15 s), `link`, `session_end`, and — interactive page only — `interact` (`target`/`action`/`detail`). Every event carries `pid`, `sessionId`, `condition`, `locale`, `seq`, client time `t`, `serverTime` and `ip`; dedupe on `(sessionId, seq)`.

To run on a cloud VM, copy `out/` and `scripts/experiment-server.mjs` and run `node scripts/experiment-server.mjs` (env: `PORT`, `OUT_DIR`, `LOG_DIR`). Before a session, `python3 scripts/experiment_smoke.py` checks the whole pipeline.

Do not run `npm run build:experiment` while `npm run dev` is running — they share `.next/`.
````

- [ ] **Step 8: Commit**

```bash
git add tests/static/story.test.tsx scripts/experiment_smoke.py README.md
git commit -m "test(static): whole-page parity check, experiment smoke script and docs"
```

- [ ] **Step 9: 部署（先问用户）**

公开站点的发布需要把 `master` 推到 `pages` 远端，这是对外操作——**先询问用户是否现在发布**。用户同意后：

```bash
git push origin master
git push pages master
gh run watch --repo evetai1997-beep/howweemojify
```

上线后验证：`https://evetai1997-beep.github.io/howweemojify/zh/static/` 返回 200，页面地图有 177 条 `path`，浏览器网络面板无 4xx、无 `/api/log` 请求；主页面 `/zh/` 保持原样（含语言切换按钮）。
