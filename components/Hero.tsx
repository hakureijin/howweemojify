'use client'
import { useTranslations } from 'next-intl'
import { EmojiField } from '@/components/hero/EmojiField'

export function Hero() {
  const t = useTranslations('hero')
  return (
    <header data-track-section="hero" className="relative h-[88vh] overflow-hidden bg-[var(--bg)]">
      <EmojiField
        labelEnlarge={t('enlarge', { char: '__CHAR__' })}
        labelShrink={t('shrink', { char: '__CHAR__' })}
      />
      <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
        <div className="text-center px-6 pointer-events-auto">
          <div className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">{t('eyebrow')}</div>
          <h1 className="display-tight mt-3 text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] text-balance max-w-4xl mx-auto text-[color:var(--ink)]">{t.rich('title', { br: () => <br /> })}</h1>
          <p className="mt-4 text-base md:text-xl font-normal text-[color:var(--muted)] max-w-2xl mx-auto text-balance">{t('subtitle')}</p>
          <div className="mt-8 text-xs text-[color:var(--muted)]">↓ {t('scrollCue')}</div>
        </div>
      </div>
    </header>
  )
}
