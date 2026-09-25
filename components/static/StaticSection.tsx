interface Props {
  id: string
  accent: string
  children: React.ReactNode
  className?: string
}

/** `Section` without the fade-in: the static page never moves. */
export function StaticSection({ id, accent, children, className = '' }: Props) {
  return (
    <section
      id={id}
      className={`py-20 md:py-28 ${className}`}
      style={{ scrollMarginTop: 80, ['--section-accent' as never]: accent }}
    >
      {children}
    </section>
  )
}
