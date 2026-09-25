'use client'
import { useMemo } from 'react'
import { geoPath } from 'd3-geo'
import { useTranslations } from 'next-intl'
import { StaticTable, TH, TD } from './StaticTable'
import { useWorldFeatures } from '@/lib/use-world-features'
import { CountryPaths } from '@/components/chapter-02/CountryPaths'
import { MapPinVisual } from '@/components/chapter-02/MapPinVisual'
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
          <MapPinVisual emoji={p.emoji} active={false} />
          <circle cx={11} cy={-11} r={7} fill="var(--ink)" />
          <text x={11} y={-11} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="800" fill="white" className="tabular">
            {numbers.get(p.id)}
          </text>
        </g>
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
        <CountryPaths features={features} path={geoPath(projection)} strokeWidth={0.4} />
        <Pins placed={placed} numbers={numbers} />
      </svg>

      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{st('insetsTitle')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {insets.map(inset => (
            <figure key={inset.id} data-inset={inset.id}>
              <svg viewBox={`0 0 ${INSET_W} ${INSET_H}`} className="w-full bg-white rounded-2xl border border-[color:var(--line)] select-none overflow-hidden"
                role="img" aria-label={st(`insets.${inset.id}` as never)}>
                <CountryPaths features={features} path={geoPath(inset.proj)} strokeWidth={0.4} />
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
