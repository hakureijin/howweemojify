import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive } from '../helpers/intl'
import { StaticSankey } from '@/components/static/StaticSankey'
import { beadCount } from '@/lib/charts/sankey'
import v from '@/data/chapter-01-variants.json'
import type { Chapter01VariantData } from '@/types/chapter-01'

const data = v as Chapter01VariantData

describe('<StaticSankey>', () => {
  it('draws every flow with its beads showing', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    expect(container.querySelectorAll('[data-flow]')).toHaveLength(22)
    const expectedBeads = data.flows.filter(f => f.examples.length > 0).reduce((a, f) => a + beadCount(f.count), 0)
    expect(container.querySelectorAll('[data-bead]')).toHaveLength(expectedBeads)
  })

  it('tabulates every node and flow tooltip', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    expect(container.querySelectorAll('tr[data-node-row]')).toHaveLength(17)
    const flowRows = container.querySelectorAll('tr[data-flow-row]')
    expect(flowRows).toHaveLength(22)
    data.flows.forEach((f, i) => {
      const mech = data.mechanisms.find(m => m.id === f.mechanism)!
      const text = flowRows[i].textContent!
      expect(text).toContain(f.count.toLocaleString('zh'))
      expect(text).toContain(`${((f.count / data.snapshot.total) * 100).toFixed(1)}%`)
      expect(text).toContain(`${((f.count / mech.count) * 100).toFixed(1)}%`)
      if (f.examples[0]) expect(text).toContain(f.examples[0])
    })
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    assertNoInteractive(container)
  })
})
