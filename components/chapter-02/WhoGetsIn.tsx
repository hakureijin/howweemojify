'use client'
import { useTranslations } from 'next-intl'
import { Section } from '@/components/ui/Section'
import { Pipeline } from './Pipeline'
import { CriteriaCards } from './CriteriaCards'
import { CaseCards } from './CaseCards'
import { OriginMap } from './OriginMap'
import type { Chapter02Data } from '@/types/chapter-02'

export function WhoGetsIn({ data }: { data: Chapter02Data }) {
  const t = useTranslations('ch02')
  return (
    <Section id="ch02" accent="var(--accent-02)">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>CHAPTER 02</div>
        <h2 className="display-tight text-3xl md:text-5xl font-semibold mt-2 text-[color:var(--ink)]">{t('title')}</h2>
        <p className="mt-3 text-sm md:text-base text-[color:var(--muted)] max-w-xl leading-relaxed">{t('intro')}</p>
        <div className="mt-6"><Pipeline steps={data.pipeline} /></div>
        <CriteriaCards criteria={data.criteria} />
        <CaseCards cases={data.cases} />
        <OriginMap pins={data.origins} />
      </div>
    </Section>
  )
}
