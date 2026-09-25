import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, msg } from '../helpers/intl'
import { StaticOriginMap } from '@/components/static/StaticOriginMap'
import ch02 from '@/data/chapter-02.json'
import type { OriginPin } from '@/types/chapter-02'

const pins = ch02.origins as OriginPin[]
const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 }))) })
afterAll(() => { vi.unstubAllGlobals() })

async function renderLoaded() {
  const r = renderIntl(<StaticOriginMap pins={pins} />)
  await waitFor(() => expect(r.container.querySelector('svg[data-map="main"]')).not.toBeNull())
  return r
}

describe('<StaticOriginMap>', () => {
  it('draws all countries and all 41 numbered pins on the world map', async () => {
    const { container } = await renderLoaded()
    const main = container.querySelector('svg[data-map="main"]')!
    expect(main.querySelectorAll('path')).toHaveLength(177)
    expect(main.querySelectorAll('[data-pin]')).toHaveLength(41)
  })

  it('resolves the dense regions in close-up maps', async () => {
    const { container } = await renderLoaded()
    const count = (id: string) => container.querySelectorAll(`figure[data-inset="${id}"] [data-pin]`).length
    expect(count('europe-mideast')).toBe(15)
    expect(count('east-asia')).toBe(8)
    expect(count('south-asia')).toBe(4)
    expect(count('mexico')).toBe(4)
  })

  it('lists every pin with its tooltip content', async () => {
    const { container } = await renderLoaded()
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

  it('has nothing to operate', async () => {
    const { container } = await renderLoaded()
    assertNoInteractive(container)
  })
})
