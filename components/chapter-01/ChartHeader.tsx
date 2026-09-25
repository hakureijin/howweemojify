interface Props {
  eyebrow: string
  title: string
  subtitle?: string
  subtitleClassName?: string
  total: string
  totalLabel: string
}

/** Eyebrow / title / optional subtitle on the left, headline total on the
 *  right. Shared markup for chapter-01 charts (interactive and static). */
export function ChartHeader({ eyebrow, title, subtitle, subtitleClassName = 'max-w-xl', total, totalLabel }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">
          {eyebrow}
        </div>
        <div className="text-base md:text-lg font-semibold mt-1 text-[color:var(--ink)]">
          {title}
        </div>
        {subtitle && (
          <div className={`text-[11px] text-[color:var(--muted)] mt-1 ${subtitleClassName}`}>
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="display-tight text-3xl md:text-4xl font-semibold tabular text-[color:var(--accent-01)] leading-none">
          {total}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] font-bold uppercase tracking-wider">
          {totalLabel}
        </div>
      </div>
    </div>
  )
}
