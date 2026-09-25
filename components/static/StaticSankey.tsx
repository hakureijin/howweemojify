'use client'
import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
import { SankeyNodeVisual } from '@/components/chapter-01/SankeyNodeVisual'
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
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={st('subtitle', { version: data.snapshot.versionLabel, total: total.toLocaleString(locale) })}
        subtitleClassName="max-w-2xl"
        total={total.toLocaleString(locale)}
        totalLabel={data.snapshot.versionLabel}
      />

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
          {layout.nodes.map(n => (
            <g key={n.id}>
              <SankeyNodeVisual n={n} locale={locale} rectOpacity={0.92} labelOpacity={1} active={false} />
            </g>
          ))}
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
