'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
import { StaticTable, TH, TD } from './StaticTable'
import { buildSankey } from '@/lib/charts/sankey'
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
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={st('subtitle', { version: data.snapshot.versionLabel, total: total.toLocaleString(locale) })}
        subtitleClassName="max-w-2xl"
        total={total.toLocaleString(locale)}
        totalLabel={data.snapshot.versionLabel}
      />

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
