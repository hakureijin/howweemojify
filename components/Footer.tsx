'use client'
import { useLocale, useTranslations } from 'next-intl'
import type { Source } from '@/types/source'
import data01 from '@/data/chapter-01.json'
import data01Cat from '@/data/chapter-01-categories.json'
import data02 from '@/data/chapter-02.json'

interface WithSource { source: Source }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ACM Reference Format retrieval date, e.g. "May 11, 2026".
function formatAccessed(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

// Dedupe every cited source across both chapters by id.
function collect(): Source[] {
  const all = new Map<string, Source>()
  const push = (s?: Source) => {
    if (s && !all.has(s.id)) all.set(s.id, s)
  }
  for (const s of data01.sources as Source[]) push(s)
  for (const n of data01.timeline as WithSource[]) push(n.source)
  push(data01Cat.source as Source)
  for (const s of data02.sources as Source[]) push(s)
  for (const c of data02.cases as WithSource[]) push(c.source)
  return Array.from(all.values())
}

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale() as 'zh' | 'en'
  // ACM references are ordered alphabetically by the leading element (author/publisher).
  const sources = collect().sort((a, b) => a.publisher.localeCompare(b.publisher))

  return (
    <footer className="bg-white border-t border-[color:var(--line)] py-14 px-6 text-sm">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">{t('heading')}</h3>
        <ol className="mt-4 space-y-3">
          {sources.map((source, i) => (
            <li
              key={source.id}
              className="grid grid-cols-[2.25rem_1fr] gap-x-2 leading-snug"
            >
              <span className="tabular-nums text-[color:var(--muted)]">[{i + 1}]</span>
              <span>
                <span className="font-bold">{source.publisher}</span>. n.d.{' '}
                <span className="italic">{source.title[locale]}</span>. Retrieved{' '}
                {formatAccessed(source.accessed)} from{' '}
                <a
                  className="text-[color:var(--accent)] hover:underline break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 rounded"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={source.url}
                >
                  {source.url}
                </a>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-[color:var(--muted)] mt-8">{t('credits')}</p>
      </div>
    </footer>
  )
}
