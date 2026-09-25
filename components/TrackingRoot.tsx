'use client'
import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { initTracking } from '@/lib/tracking-session'
import type { Condition } from '@/lib/tracking'

/** Starts behaviour logging for the experiment build (inert otherwise). Every
 *  `[data-track-section]` wrapper must already be in the DOM on mount. */
export function TrackingRoot({ condition }: { condition: Condition }) {
  const locale = useLocale()
  useEffect(() => initTracking({ condition, locale }), [condition, locale])
  return null
}
