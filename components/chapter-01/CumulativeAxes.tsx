'use client'
import { useId } from 'react'
import { CUM_W as W, CUM_H as H, CUM_PAD as PAD, type CumulativeGeometry } from '@/lib/charts/cumulative'

interface Props {
  geometry: CumulativeGeometry
  locale: string
  yAxisLabel: string
}

/** Axes, gridlines, area and line of the cumulative chart. Rendered inside an
 *  `<svg viewBox="0 0 880 440">` by both the interactive and the static chart. */
export function CumulativeAxes({ geometry, locale, yAxisLabel }: Props) {
  const uid = useId()
  const gradId = `${uid}-grad`
  const clipId = `${uid}-clip`
  const { yTicks, yScale, xScale, xLabels, pathArea, pathLine } = geometry
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0%" stopColor="var(--accent-01)" />
          <stop offset="100%" stopColor="var(--accent-04)" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={PAD.l} y={PAD.t - 10} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b + 12} />
        </clipPath>
      </defs>

      <text
        x={16}
        y={(PAD.t + (H - PAD.b)) / 2}
        fontSize="10"
        fill="var(--muted)"
        textAnchor="middle"
        fontWeight="800"
        letterSpacing="0.1em"
        transform={`rotate(-90 16 ${(PAD.t + (H - PAD.b)) / 2})`}
      >
        {yAxisLabel}
      </text>

      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={PAD.l - 10} y={yScale(tick)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--muted)" className="tabular">
            {tick.toLocaleString(locale)}
          </text>
        </g>
      ))}

      <g clipPath={`url(#${clipId})`}>
        <path d={pathArea} fill={`url(#${gradId})`} opacity={0.16} />
        <path d={pathLine} fill="none" stroke={`url(#${gradId})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {xLabels.map(year => (
        <g key={year}>
          <line x1={xScale(year)} x2={xScale(year)} y1={H - PAD.b} y2={H - PAD.b + 5} stroke="var(--muted)" opacity={0.4} />
          <text x={xScale(year)} y={H - PAD.b + 20} fontSize="11" fill="var(--muted)" textAnchor="middle" className="tabular" fontWeight="700">
            {year}
          </text>
        </g>
      ))}
    </>
  )
}
