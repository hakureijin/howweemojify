import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticCumulative } from '@/components/static/StaticCumulative'
import { buildSeries, computeVersionDiff, DEFAULT_FROM_ID, DEFAULT_TO_ID } from '@/lib/charts/cumulative'
import ch01 from '@/data/chapter-01.json'
import type { Chapter01Data } from '@/types/chapter-01'

const data = ch01 as Chapter01Data
const series = buildSeries(data.timeline)

describe('<StaticCumulative>', () => {
  it('omits the full and zoomed charts', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    expect(container.querySelector('[data-cum-chart]')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('tabulates every tooltip field for every version', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    const rows = container.querySelectorAll('tbody tr[data-row]')
    expect(rows).toHaveLength(15)
    series.forEach((d, i) => {
      const row = container.querySelector(`tr[data-row="${d.node.id}"]`)!
      const text = row.textContent!
      expect(text).toContain(String(i + 1))
      expect(text).toContain(d.node.versionLabel)
      expect(text).toContain(`+${d.node.newEmojiCount.toLocaleString('zh')}`)
      expect(text).toContain(d.runningTotal.toLocaleString('zh'))
      expect(text).toContain(d.previousTotal === 0 ? '—' : `+${Math.round(d.growthPct)}%`)
      expect(text).toContain(msg('zh', d.node.narrativeKey))
      expect(row.querySelector(`a[href="${d.node.source.url}"]`)).not.toBeNull()
    })
  })

  it('shows the default version comparison card', () => {
    renderIntl(<StaticCumulative data={data} />)
    const diff = computeVersionDiff(series, DEFAULT_FROM_ID, DEFAULT_TO_ID)!
    expect(screen.getByText(`+${diff.addedTotal.toLocaleString('zh')}`)).toBeInTheDocument()
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticCumulative data={data} />)
    assertNoInteractive(container)
  })
})
