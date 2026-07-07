'use client'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/lib/prefers-reduced-motion'

interface Props {
  id: string
  accent: string
  children: React.ReactNode
  className?: string
}

export function Section({ id, accent, children, className = '' }: Props) {
  const reduced = usePrefersReducedMotion()

  if (reduced) {
    return (
      <section id={id} className={`py-20 md:py-28 ${className}`} style={{ scrollMarginTop: 80 }}>
        {children}
      </section>
    )
  }

  return (
    <motion.section
      id={id}
      className={`py-20 md:py-28 ${className}`}
      style={{ scrollMarginTop: 80, ['--section-accent' as never]: accent }}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15% 0px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  )
}
