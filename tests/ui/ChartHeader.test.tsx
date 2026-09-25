import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartHeader } from '@/components/chapter-01/ChartHeader'

describe('<ChartHeader>', () => {
  it('renders eyebrow, title and total', () => {
    render(<ChartHeader eyebrow="Eyebrow" title="Title" total="1,234" totalLabel="by 2026" />)
    expect(screen.getByText('Eyebrow')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('by 2026')).toBeInTheDocument()
  })

  it('renders the subtitle only when given', () => {
    const { rerender } = render(<ChartHeader eyebrow="Eyebrow" title="Title" total="1,234" totalLabel="by 2026" />)
    expect(screen.queryByText('Subtitle text')).not.toBeInTheDocument()

    rerender(<ChartHeader eyebrow="Eyebrow" title="Title" subtitle="Subtitle text" total="1,234" totalLabel="by 2026" />)
    expect(screen.getByText('Subtitle text')).toBeInTheDocument()
  })
})
