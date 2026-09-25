'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
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
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title', { lastYear: full.maxYear })}
        total={finalTotal.toLocaleString(locale)}
        totalLabel={t('totalBy', { year: full.maxYear })}
      />
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
