'use client'

/** The visible pin: a white circle with an emoji, used by both the interactive
 *  and static origin maps. Callers own the `<g>` wrapper (position, hit area,
 *  handlers) around this. */
export function MapPinVisual({ emoji, active }: { emoji: string; active: boolean }) {
  return (
    <>
      <circle
        r={active ? 17 : 14}
        fill="white"
        stroke="var(--accent-02)"
        strokeWidth={active ? 3 : 2}
        style={{ transition: 'r 160ms ease, stroke-width 160ms ease' }}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={active ? 16 : 14}
        style={{ pointerEvents: 'none', transition: 'font-size 160ms ease' }}
      >
        {emoji}
      </text>
    </>
  )
}
