'use client'
import { useLocale, useTranslations } from 'next-intl'
import { Citation } from '@/components/ui/Citation'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'
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
      <ChartHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={st('subtitle')}
        total={latest.total.toLocaleString(locale)}
        totalLabel={t('totalBy', { version: latest.versionLabel })}
      />

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
