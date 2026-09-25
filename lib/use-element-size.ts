'use client'
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Measures an element's box via ResizeObserver, debounced 150ms. Shared by the
 *  interactive and static heroes so both position their emoji wallpaper from the
 *  same (vw, vh) reading. */
export function useElementSize(ref: RefObject<HTMLElement | null>): { vw: number; vh: number } | null {
  const [size, setSize] = useState<{ vw: number; vh: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
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
  }, [ref])

  return size
}
