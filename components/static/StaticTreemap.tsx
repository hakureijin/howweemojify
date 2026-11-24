'use client'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
import { StaticTable, TH, TD } from './StaticTable'
import { sampleRuns } from '@/lib/charts/treemap'
import type { Chapter01CategoryData } from '@/types/chapter-01'

export function StaticTreemap({ data }: { data: Chapter01CategoryData }) {
  const t = useTranslations('ch01.categoryTreemap')
  const st = useTranslations('static.treemap')
  const locale = useLocale() as 'zh' | 'en'
  const frames = data.frames
  const latest = frames[frames.length - 1]

  return (
    <div>
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={st('subtitle')}
        total={latest.total.toLocaleString(locale)}
        totalLabel={t('totalBy', { version: latest.versionLabel })}
      />

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
