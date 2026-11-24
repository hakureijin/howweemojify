'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
import { VersionDiffCard } from '@/components/chapter-01/VersionDiffCard'
import { StaticTable, TH, TD } from './StaticTable'
import {
  buildSeries, computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID,
} from '@/lib/charts/cumulative'
import type { Chapter01Data } from '@/types/chapter-01'

export function StaticCumulative({ data }: { data: Chapter01Data }) {
  const t = useTranslations('ch01.chart')
  const st = useTranslations('static.cumulative')
  const narrativeT = useTranslations()
  const locale = useLocale() as 'zh' | 'en'

  const series = useMemo(() => buildSeries(data.timeline), [data.timeline])
  const diff = useMemo(() => computeVersionDiff(series, DEFAULT_FROM_ID, DEFAULT_TO_ID), [series])
  const decadeSet = new Set(data.decadeIndex)
  const finalTotal = series[series.length - 1]?.runningTotal ?? 0
  const lastYear = series[series.length - 1]?.node.year ?? 2026

  return (
    <div>
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title', { lastYear })}
        total={finalTotal.toLocaleString(locale)}
        totalLabel={t('totalBy', { year: lastYear })}
      />

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
