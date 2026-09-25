export const TH =
  'px-3 py-2 text-[9px] uppercase tracking-wide font-bold text-[color:var(--muted)] border-b border-[color:var(--line)] whitespace-nowrap align-bottom'
export const TD = 'px-3 py-2 align-top border-b border-[color:var(--line)]/60'

/** A captioned data table in the page's card style. Wide tables scroll inside
 *  their own box so the page itself never scrolls sideways. */
export function StaticTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="mt-6">
      <figcaption className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)] mb-2">
        {caption}
      </figcaption>
      <div className="overflow-x-auto rounded-2xl bg-white card-elev">
        <table className="w-full text-xs text-left tabular text-[color:var(--ink)]">{children}</table>
      </div>
    </figure>
  )
}
