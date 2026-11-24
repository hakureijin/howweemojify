'use client'
import { useTranslations } from 'next-intl'
import { StaticTable, TH, TD } from './StaticTable'
import type { OriginPin } from '@/types/chapter-02'

export function StaticOriginMap({ pins }: { pins: OriginPin[] }) {
  const t = useTranslations('ch02.map')
  const st = useTranslations('static.map')
  const labelT = useTranslations()
  const uniqueCountries = new Set(pins.map(p => p.country)).size

  return (
    <div className="relative mt-8">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">{t('eyebrow')}</div>
          <div className="text-sm font-bold mt-0.5">{t('title')}</div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[10px] text-[color:var(--muted)] mt-0.5 tabular">{t('regionsCount', { count: pins.length, countries: uniqueCountries })}</div>
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
