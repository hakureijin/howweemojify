import type { LaidNode } from '@/lib/charts/sankey'

interface Props {
  n: LaidNode
  locale: string
  rectOpacity: number
  labelOpacity: number
  active: boolean
}

/** The visible rect + label for one sankey node. Shared by the interactive
 *  and static sankey charts; callers own any hit area / interaction wrapper. */
export function SankeyNodeVisual({ n, locale, rectOpacity, labelOpacity, active }: Props) {
  const accentVar = n.kind === 'mechanism' ? `--mech-${n.refId}` : `--cat-${n.refId}`
  const labelX = n.kind === 'mechanism' ? n.x1 + 8 : n.x0 - 8
  const labelAnchor = n.kind === 'mechanism' ? 'start' : 'end'
  const labelY = (n.y0 + n.y1) / 2
  const nodeHeight = n.y1 - n.y0
  return (
    <>
      <rect
        x={n.x0}
        y={n.y0}
        width={n.x1 - n.x0}
        height={Math.max(nodeHeight, 1)}
        rx={3}
        fill={`var(${accentVar})`}
        opacity={rectOpacity}
        stroke={active ? 'var(--ink)' : 'none'}
        strokeWidth={active ? 1.5 : 0}
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor={labelAnchor}
        dominantBaseline="central"
        fontSize="11"
        fontWeight="800"
        fill="var(--ink)"
        opacity={labelOpacity}
        pointerEvents="none"
        className="tabular"
      >
        {n.label}
        <tspan
          fontSize="10"
          fontWeight="700"
          fill="var(--muted)"
          dx="6"
        >
          {n.total.toLocaleString(locale)}
        </tspan>
      </text>
    </>
  )
}
