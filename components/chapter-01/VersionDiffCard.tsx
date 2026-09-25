'use client'
import { useLocale, useTranslations } from 'next-intl'
import type { DiffResult } from '@/lib/charts/cumulative'

const MAX_SAMPLES = 30

export function VersionDiffCard({ diff }: { diff: DiffResult }) {
  const t = useTranslations('ch01.chart')
  const locale = useLocale() as 'zh' | 'en'
  const samples = diff.sampleEmojis
  const visibleSamples = samples.slice(0, MAX_SAMPLES)
  const overflow = Math.max(0, samples.length - MAX_SAMPLES)
  const spanText =
    diff.yearSpan === 0
      ? t('diff.cardSpanSameYear', { versions: diff.versionCount })
      : t('diff.cardSpan', { years: diff.yearSpan, versions: diff.versionCount })

  return (
    <div className="mt-3 rounded-xl bg-white p-3.5 border border-[color:var(--accent-01)]/25">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-[color:var(--accent-01)] uppercase">
            {t('diff.cardEyebrow', { fromYear: diff.fromNode.node.year, toYear: diff.toNode.node.year })}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
            {t('diff.cardTitle', { fromVersion: diff.fromNode.node.versionLabel, toVersion: diff.toNode.node.versionLabel })}
            <span className="ml-2 text-[11px] font-bold text-[color:var(--muted)]">· {spanText}</span>
          </div>
        </div>
        {diff.isDraft && (
          <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--muted)] text-white">
            {t('draftBadge')}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs border-t border-[color:var(--line)]/60 pt-3" aria-live="polite">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('added')}</div>
          <div className="text-base font-semibold tabular text-[color:var(--accent-01)] leading-tight">
            +{diff.addedTotal.toLocaleString(locale)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('total')}</div>
          <div className="text-base font-semibold tabular leading-tight">{diff.toNode.runningTotal.toLocaleString(locale)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold">{t('growth')}</div>
          <div className="text-base font-semibold tabular text-[color:var(--accent-04)] leading-tight">
            {diff.growthPct === null ? '—' : `+${Math.round(diff.growthPct)}%`}
          </div>
        </div>
      </div>

      {visibleSamples.length > 0 && (
        <div className="mt-3 border-t border-[color:var(--line)]/60 pt-3">
          <div className="text-[9px] uppercase tracking-wide text-[color:var(--muted)] font-bold mb-1.5">
            {t('diff.sampleHeader', { versions: diff.versionCount })}
          </div>
          <div className="flex flex-wrap gap-1.5 text-base md:text-lg leading-none">
            {visibleSamples.map((e, i) => (<span key={i}>{e}</span>))}
            {overflow > 0 && (
              <span className="text-[11px] font-bold text-[color:var(--muted)] self-end">
                {t('diff.moreCount', { count: overflow })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
