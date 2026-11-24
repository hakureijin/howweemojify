import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive } from '../helpers/intl'
import { StaticSankey } from '@/components/static/StaticSankey'
import v from '@/data/chapter-01-variants.json'
import type { Chapter01VariantData } from '@/types/chapter-01'

const data = v as Chapter01VariantData

describe('<StaticSankey>', () => {
  it('omits the flow chart', () => {
    const { container } = renderIntl(<StaticSankey data={data} />)
    expect(container.querySelector('svg')).toBeNull()
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
