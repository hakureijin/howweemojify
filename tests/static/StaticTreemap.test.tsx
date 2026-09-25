import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticTreemap } from '@/components/static/StaticTreemap'
import { sampleRuns } from '@/lib/charts/treemap'
import cat from '@/data/chapter-01-categories.json'
import type { Chapter01CategoryData } from '@/types/chapter-01'

const data = cat as Chapter01CategoryData

describe('<StaticTreemap>', () => {
  it('shows the latest frame large plus one small treemap per version', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    expect(container.querySelectorAll('figure[data-frame]')).toHaveLength(data.frames.length)
    expect(container.querySelectorAll('[data-tile]')).toHaveLength(9 * (data.frames.length + 1))
  })

  it('tabulates count and share for every group × version', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    expect(container.querySelectorAll('tr[data-group-row]')).toHaveLength(9)
    for (const key of data.groupOrder) {
      const row = container.querySelector(`tr[data-group-row="${key}"]`)!
      expect(row.textContent).toContain(msg('zh', `ch01.categoryTreemap.groups.${key}`))
      const cells = row.querySelectorAll('td[data-frame-cell]')
      expect(cells).toHaveLength(data.frames.length)
      data.frames.forEach((f, i) => {
        expect(cells[i].textContent).toContain(f.counts[key].toLocaleString('zh'))
        expect(cells[i].textContent).toContain(`${((f.counts[key] / f.total) * 100).toFixed(1)}%`)
      })
      for (const run of sampleRuns(data.frames, key)) expect(row.textContent).toContain(run.samples.join(' '))
    }
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticTreemap data={data} />)
    assertNoInteractive(container)
  })
})
