'use client'
import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { PipelineStep } from '@/types/chapter-02'

export function Pipeline({ steps }: { steps: PipelineStep[] }) {
  const t = useTranslations()
  return (
    <div className="bg-white rounded-2xl p-6 card-elev">
      <div className="flex items-start gap-2">
        {steps.map((s, i) => (
          <Fragment key={s.id}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex-1 text-center"
            >
              <div className="mx-auto w-9 h-9 rounded-full bg-[color:var(--accent-02)] text-white flex items-center justify-center font-semibold text-sm">
                {i + 1}
              </div>
              <div className="text-xs font-semibold mt-2">{t(s.labelKey as never)}</div>
              <div className="text-[10px] text-[color:var(--muted)] mt-1 leading-tight">{t(s.descKey as never)}</div>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 + 0.04 }}
                className="h-0.5 w-6 mt-5 bg-[color:var(--accent-02)] origin-left"
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
