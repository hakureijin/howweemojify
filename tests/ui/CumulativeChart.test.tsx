import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderIntl } from '../helpers/intl'
import { CumulativeChart } from '@/components/chapter-01/CumulativeChart'
import { buildSeries, computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID } from '@/lib/charts/cumulative'
import ch01 from '@/data/chapter-01.json'
import type { Chapter01Data } from '@/types/chapter-01'

const data = ch01 as Chapter01Data

describe('<CumulativeChart> (interactive)', () => {
  it('renders one focusable medallion per contributing version', () => {
    const { container } = renderIntl(<CumulativeChart data={data} />)
    expect(container.querySelectorAll('svg [role="button"]')).toHaveLength(15)
  })

  it('shows the default 6.0 → 17.0 diff card and A/B chips', () => {
    const { container } = renderIntl(<CumulativeChart data={data} />)
    const diff = computeVersionDiff(buildSeries(data.timeline), DEFAULT_FROM_ID, DEFAULT_TO_ID)!
    expect(screen.getByText(`+${diff.addedTotal.toLocaleString('zh')}`)).toBeInTheDocument()
    const svg = container.querySelector('svg')!
    expect(within(svg as unknown as HTMLElement).getByText('A')).toBeInTheDocument()
    expect(within(svg as unknown as HTMLElement).getByText('B')).toBeInTheDocument()
  })
})
