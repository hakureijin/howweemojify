'use client'
import { useLocale, useTranslations } from 'next-intl'
import type { CaseCard as CaseCardType } from '@/types/chapter-02'
import { Citation } from '@/components/ui/Citation'

export function CaseCards({ cases, isStatic = false }: { cases: CaseCardType[]; isStatic?: boolean }) {
  const t = useTranslations()
  const locale = useLocale() as 'zh' | 'en'
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
      {cases.map(c => (
        <article key={c.id} className={`bg-white rounded-2xl overflow-hidden card-elev relative ${isStatic ? '' : 'transition-transform duration-200 hover:-translate-y-0.5'}`}>
          {c.status === 'rejected' && (
            <div className="absolute top-2 right-2 bg-[color:var(--signal-reject)] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">REJECTED</div>
          )}
          <div className="h-20 flex items-center justify-center bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ed]">
            <span className="text-4xl">{c.emoji}</span>
          </div>
          <div className="p-3">
            <div className="text-[10px] font-semibold text-[color:var(--accent-02)]">{c.year} · {c.unicodeVersion}</div>
            <div className="text-sm font-semibold mt-1">{t(c.proposerKey as never)}</div>
            <p className="text-xs text-[color:var(--muted)] mt-1 leading-snug">{t(c.storyKey as never)}</p>
            <div className="mt-2"><Citation source={c.source} locale={locale} /></div>
          </div>
        </article>
      ))}
    </div>
  )
}
