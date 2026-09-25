'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { HERO_EMOJIS } from '@/lib/hero-emoji-timeline'
import { computeLayout, pickProfile } from '@/lib/hero-emoji-layout'

/** Same wallpaper positions as the interactive hero (same layout function and
 *  profiles), but plain glyphs: no drift, no hover push, no click-to-enlarge. */
function StaticEmojiField() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ vw: number; vh: number } | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timer: number | null = null
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ vw: rect.width, vh: rect.height })
    }
    measure()
    const ro = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(measure, 150)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const positioned = useMemo(
    () => (size ? computeLayout(HERO_EMOJIS, size.vw, size.vh, pickProfile(size.vw, size.vh)) : []),
    [size],
  )

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden hero-vignette" aria-hidden="true">
      {positioned.map((p, i) => (
        <span
          key={`${p.char}-${i}`}
          style={{ position: 'absolute', left: `${p.x}px`, top: `${p.y}px`, opacity: p.opacity, transform: 'translate(-50%, -50%)' }}
        >
          <span className="hero-emoji-static" style={{ fontSize: `${p.size}px` }}>{p.char}</span>
        </span>
      ))}
    </div>
  )
}

export function StaticHero() {
  const t = useTranslations('hero')
  return (
    <header data-track-section="hero" className="relative h-[88vh] overflow-hidden bg-[var(--bg)]">
      <StaticEmojiField />
      <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
        <div className="text-center px-6">
          <div className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">{t('eyebrow')}</div>
          <h1 className="display-tight mt-3 text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] text-balance max-w-4xl mx-auto text-[color:var(--ink)]">{t.rich('title', { br: () => <br /> })}</h1>
          <p className="mt-4 text-base md:text-xl font-normal text-[color:var(--muted)] max-w-2xl mx-auto text-balance">{t('subtitle')}</p>
          <div className="mt-8 text-xs text-[color:var(--muted)]">↓ {t('scrollCue')}</div>
        </div>
      </div>
    </header>
  )
}
