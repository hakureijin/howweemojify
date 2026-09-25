import type { ChartPoint } from '@/lib/charts/cumulative'

export function markerBaseRadius(p: ChartPoint): number {
  return p.flagship ? 18 : 13
}

interface Props {
  p: ChartPoint
  isActive: boolean
  compare: 'A' | 'B' | null
}

/** Visual medallion for one version (circle, emoji, year label, draft pill,
 *  compare chip). No hit area, no handlers — callers wrap it. */
export function CumulativeMarker({ p, isActive, compare }: Props) {
  const baseR = markerBaseRadius(p)
  const r = isActive ? baseR + 4 : baseR
  const fontSize = p.flagship ? (isActive ? 18 : 14) : isActive ? 14 : 11
  const isDraft = p.draft === true
  return (
    <>
      <circle
        cx={p.cx}
        cy={p.cy}
        r={r}
        fill="white"
        stroke={isDraft ? 'var(--muted)' : 'var(--accent-01)'}
        strokeWidth={isActive ? 3 : p.flagship ? 2.5 : 2}
        strokeDasharray={isDraft ? '3 3' : undefined}
        filter={isActive ? 'url(#markerShadow)' : undefined}
        style={{ transition: 'r 160ms ease, stroke-width 160ms ease' }}
      />
      <text
        x={p.cx}
        y={p.cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        pointerEvents="none"
        opacity={isDraft ? 0.65 : 1}
        style={{ transition: 'font-size 160ms ease' }}
      >
        {p.highlightEmojis[0] ?? '·'}
      </text>
      {p.flagship && !isActive && !compare && (
        <text
          x={p.cx}
          y={p.cy + baseR + 12}
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          fill={isDraft ? 'var(--muted)' : 'var(--accent-01)'}
          className="tabular"
          pointerEvents="none"
        >
          {p.year}
        </text>
      )}
      {/* Draft badge — sits on the LEFT of the medallion since the draft
          point is always at the chart's right edge. */}
      {isDraft && (() => {
        const pillW = 44
        const pillH = 14
        const pillX = p.cx - baseR - pillW
        const pillY = p.cy - baseR - pillH / 2 - 2
        return (
          <g pointerEvents="none">
            <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={pillH / 2} fill="var(--muted)" />
            <text x={pillX + pillW / 2} y={pillY + pillH / 2} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="900" fill="white" letterSpacing="0.05em">
              DRAFT
            </text>
          </g>
        )
      })()}
      {compare && (
        <g pointerEvents="none">
          <circle cx={p.cx} cy={p.cy} r={r} fill="none" stroke="var(--accent-01)" strokeWidth={4} />
          <g transform={`translate(${p.cx}, ${p.cy + baseR + 22})`}>
            <rect x={-9} y={-7} width={18} height={13} rx={3} fill="var(--accent-01)" />
            <text textAnchor="middle" dy={2} fontSize={9} fontWeight={900} fill="white" letterSpacing="0.05em">
              {compare}
            </text>
          </g>
        </g>
      )}
    </>
  )
}
