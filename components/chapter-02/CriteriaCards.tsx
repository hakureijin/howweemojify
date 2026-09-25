'use client'
import { useTranslations } from 'next-intl'
import type { Criterion } from '@/types/chapter-02'

const TONE: Record<Criterion['tone'], { tagKey: string; color: string }> = {
  mint: { tagKey: 'ch02.criteria.tone.mint', color: 'var(--accent-02)' },
  cultural: { tagKey: 'ch02.criteria.tone.cultural', color: 'var(--signal-cultural)' },
  reject: { tagKey: 'ch02.criteria.tone.reject', color: 'var(--signal-reject)' },
}

export function CriteriaCards({ criteria, isStatic = false }: { criteria: Criterion[]; isStatic?: boolean }) {
  const t = useTranslations()
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      {criteria.map(c => {
        const tone = TONE[c.tone]
        return (
          <article
            key={c.id}
            className={`bg-white rounded-2xl p-6 card-elev ${isStatic ? '' : 'transition-transform duration-200 hover:-translate-y-0.5'}`}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: tone.color }}
            >
              {t(tone.tagKey as never)}
            </div>
            <h3 className="text-base font-semibold leading-tight mt-3 text-[color:var(--ink)]">
              {t(c.titleKey as never)}
            </h3>
            <p className="text-xs leading-relaxed text-[color:var(--muted)] mt-2">
              {t(c.descKey as never)}
            </p>
          </article>
        )
      })}
    </div>
  )
}
