'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { HERO_EMOJIS } from '@/lib/hero-emoji-timeline'
import { computeLayout, pickProfile } from '@/lib/hero-emoji-layout'
import { usePrefersReducedMotion } from '@/lib/prefers-reduced-motion'

type Props = {
  labelEnlarge: string  // i18n template containing __CHAR__ placeholder
  labelShrink: string   // i18n template containing __CHAR__ placeholder
}

export function EmojiField({ labelEnlarge, labelShrink }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const emojiRefs = useRef<(HTMLButtonElement | null)[]>([])
  const quickToRefs = useRef<Array<{ x: (v: number) => void; y: (v: number) => void } | null>>([])
  const [size, setSize] = useState<{ vw: number; vh: number } | null>(null)
  const [active, setActive] = useState<Set<number>>(new Set())
  const reducedMotion = usePrefersReducedMotion()

  const toggle = (i: number) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ vw: rect.width, vh: rect.height })
    }
    measure()
    const ro = new ResizeObserver(() => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(measure, 150)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const positioned = useMemo(() => {
    if (!size) return []
    const profile = pickProfile(size.vw, size.vh)
    return computeLayout(HERO_EMOJIS, size.vw, size.vh, profile)
  }, [size])

  // Hover magnetic push
  useGSAP(
    () => {
      if (reducedMotion || !size) return
      const container = containerRef.current
      if (!container) return

      // Skip magnetic push on touch-only devices (no fine pointer)
      const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      if (!hasFinePointer) return

      quickToRefs.current = emojiRefs.current.map(el => {
        if (!el) return null
        return {
          x: gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' }),
          y: gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' }),
        }
      })

      let rafId: number | null = null
      let mouseX = 0
      let mouseY = 0
      const RADIUS = 100
      const STRENGTH = 28

      const handleMove = (e: MouseEvent) => {
        if (active.size > 0) return  // freeze hover while click-pop is active
        const rect = container.getBoundingClientRect()
        mouseX = e.clientX - rect.left
        mouseY = e.clientY - rect.top
        if (rafId !== null) return
        rafId = requestAnimationFrame(() => {
          rafId = null
          for (let i = 0; i < positioned.length; i++) {
            const p = positioned[i]
            const qt = quickToRefs.current[i]
            if (!qt) continue
            const dx = p.x - mouseX
            const dy = p.y - mouseY
            const d = Math.hypot(dx, dy)
            if (d < RADIUS && d > 0) {
              const f = Math.pow(1 - d / RADIUS, 2) * STRENGTH
              qt.x((dx / d) * f)
              qt.y((dy / d) * f)
            } else {
              qt.x(0)
              qt.y(0)
            }
          }
        })
      }

      const handleLeave = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        if (active.size > 0) return  // don't snap-back while click-pop is active
        const targets = emojiRefs.current.filter(Boolean) as HTMLButtonElement[]
        gsap.to(targets, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: 'elastic.out(1, 0.5)',
        })
      }

      container.addEventListener('mousemove', handleMove)
      container.addEventListener('mouseleave', handleLeave)

      return () => {
        container.removeEventListener('mousemove', handleMove)
        container.removeEventListener('mouseleave', handleLeave)
        if (rafId !== null) cancelAnimationFrame(rafId)
      }
    },
    { scope: containerRef, dependencies: [positioned, reducedMotion, size, active] },
  )

  // Click toggle: scale active emojis + push neighbours
  useGSAP(
    () => {
      if (!size) return
      const dur = reducedMotion ? 0.001 : 0.5
      const easeActive = reducedMotion ? 'none' : 'back.out(1.7)'
      const easeInactive = reducedMotion ? 'none' : 'back.out(1.4)'

      positioned.forEach((p, i) => {
        const el = emojiRefs.current[i]
        if (!el) return

        if (active.has(i)) {
          gsap.to(el, {
            scale: 3,
            duration: dur,
            ease: easeActive,
          })
        } else {
          let pushX = 0
          let pushY = 0
          active.forEach(j => {
            const a = positioned[j]
            if (!a) return
            const dx = p.x - a.x
            const dy = p.y - a.y
            const d = Math.hypot(dx, dy)
            if (d > 0 && d < 120) {
              const f = (1 - d / 120) * 36
              pushX += (dx / d) * f
              pushY += (dy / d) * f
            }
          })
          gsap.to(el, {
            scale: 1,
            x: pushX,
            y: pushY,
            duration: dur,
            ease: easeInactive,
          })
        }
      })
    },
    { scope: containerRef, dependencies: [active, positioned, reducedMotion, size] },
  )

  // Esc collapses all popped emojis
  useEffect(() => {
    if (active.size === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(new Set())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden hero-vignette"
      role="presentation"
    >
      {positioned.map((p, i) => {
        // Per-emoji ambient drift desync — deterministic from index
        const driftDuration = 6 + ((i * 7) % 60) / 10  // 6.0 – 12.0 s
        const driftDelay = -((i * 0.37) % 5)            // negative: pre-rolled, no startup gap
        return (
          <span
            key={`${p.char}-${i}`}
            className="hero-emoji-drift"
            style={{
              position: 'absolute',
              left: `${p.x}px`,
              top: `${p.y}px`,
              opacity: p.opacity,
              transform: 'translate(-50%, -50%)',
              ['--drift-duration' as string]: `${driftDuration}s`,
              ['--drift-delay' as string]: `${driftDelay}s`,
            }}
          >
            <button
              ref={el => { emojiRefs.current[i] = el }}
              type="button"
              aria-pressed={active.has(i)}
              aria-label={(active.has(i) ? labelShrink : labelEnlarge).replace('__CHAR__', p.char)}
              data-active={active.has(i) ? 'true' : 'false'}
              className="hero-emoji-btn"
              onClick={(e) => {
                e.stopPropagation()
                toggle(i)
              }}
              style={{
                fontSize: `${p.size}px`,
                display: 'block',
              }}
            >
              <span aria-hidden="true">{p.char}</span>
            </button>
          </span>
        )
      })}
    </div>
  )
}
