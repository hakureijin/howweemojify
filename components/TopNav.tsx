'use client'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

const CHAPTERS = ['ch01', 'ch02'] as const

export function TopNav() {
  const t = useTranslations('nav')
  const locale = useLocale() as 'zh' | 'en'
  const router = useRouter()
  const pathname = usePathname()

  const otherLocale: 'zh' | 'en' = locale === 'zh' ? 'en' : 'zh'
  const switchLabel = locale === 'zh' ? 'EN' : '中'

  return (
    <nav className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full bg-white/70 backdrop-blur-xl backdrop-saturate-150 px-2 py-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] border border-black/[0.06]">
      {CHAPTERS.map(ch => (
        <a
          key={ch}
          href={`#${ch}`}
          className="text-[13px] font-medium text-[color:var(--muted)] hover:text-[color:var(--ink)] px-3 py-1.5 rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
        >
          {t(ch)}
        </a>
      ))}
      <button
        onClick={() => router.replace(pathname, { locale: otherLocale })}
        className="ml-1 text-[13px] font-medium bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] text-white px-3.5 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
        aria-label={t('switchLangAria')}
      >
        {switchLabel}
      </button>
    </nav>
  )
}
