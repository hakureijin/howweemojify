import { describe, it, expect } from 'vitest'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticOriginMap } from '@/components/static/StaticOriginMap'
import ch02 from '@/data/chapter-02.json'
import type { OriginPin } from '@/types/chapter-02'

const pins = ch02.origins as OriginPin[]
describe('<StaticOriginMap>', () => {
  it('omits the world map and close-up maps', () => {
    const { container } = renderIntl(<StaticOriginMap pins={pins} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-inset]')).toBeNull()
  })

  it('lists every origin', () => {
    const { container } = renderIntl(<StaticOriginMap pins={pins} />)
    const rows = container.querySelectorAll('tr[data-pin-row]')
    expect(rows).toHaveLength(41)
    pins.forEach((p, i) => {
      const text = rows[i].textContent!
      expect(text).toContain(String(i + 1))
      expect(text).toContain(p.emoji)
      expect(text).toContain(p.country)
      expect(text).toContain(String(p.year))
      expect(text).toContain(msg('zh', p.labelKey))
    })
  })

  it('has nothing to operate', () => {
    const { container } = renderIntl(<StaticOriginMap pins={pins} />)
    assertNoInteractive(container)
  })
})
