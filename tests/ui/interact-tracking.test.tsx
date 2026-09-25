import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, msg } from '../helpers/intl'

vi.mock('@/lib/tracking', () => ({ track: vi.fn(), hoverStart: vi.fn(), hoverEnd: vi.fn() }))

import { track, hoverStart } from '@/lib/tracking'

const calls = (target: string) => vi.mocked(track).mock.calls.filter(c => c[0] === target).map(c => c[1])

/** Click, click the same element again, click again, Escape, Escape: expects pin → unpin
 *  → pin → close, and no second close when nothing is open. */
function pinUnpinClose(target: string, el: Element) {
  fireEvent.click(el)
  fireEvent.click(el)
  fireEvent.click(el)
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(calls(target).filter(a => ['pin', 'unpin', 'close'].includes(a as string)))
    .toEqual(['pin', 'unpin', 'pin', 'close'])
}
import { CumulativeChart } from '@/components/chapter-01/CumulativeChart'
import { CategoryTreemap } from '@/components/chapter-01/CategoryTreemap'
import { VariantSankey } from '@/components/chapter-01/VariantSankey'
import { OriginMap } from '@/components/chapter-02/OriginMap'
import ch01 from '@/data/chapter-01.json'
import cat from '@/data/chapter-01-categories.json'
import v from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { OriginPin } from '@/types/chapter-02'

const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeEach(() => {
  vi.mocked(track).mockClear()
  vi.mocked(hoverStart).mockClear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => vi.unstubAllGlobals())

describe('interaction events', () => {
  it('cumulative: range, pin, diff and hover', () => {
    const { container } = renderIntl(<CumulativeChart data={ch01 as Chapter01Data} />)
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch01.chart.range2015') }))
    expect(track).toHaveBeenCalledWith('cumulative', 'range', 'since-2015')
    const marker = container.querySelector('svg [role="button"]')!
    fireEvent.mouseEnter(marker)
    expect(hoverStart).toHaveBeenCalledWith('cumulative', expect.any(String))
    fireEvent.click(marker)
    expect(track).toHaveBeenCalledWith('cumulative', 'pin', expect.any(String))
    fireEvent.change(screen.getByLabelText(msg('zh', 'ch01.chart.diff.fromAria')), { target: { value: 'emoji-7-0' } })
    expect(track).toHaveBeenCalledWith('cumulative', 'diff', 'emoji-7-0→emoji-17-0')
  })

  it('treemap: slider and play', () => {
    renderIntl(<CategoryTreemap data={cat as Chapter01CategoryData} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
    expect(track).toHaveBeenCalledWith('treemap', 'slider', (cat as Chapter01CategoryData).frames[0].year)
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch01.categoryTreemap.playAria') }))
    expect(track).toHaveBeenCalledWith('treemap', 'play')
  })

  it('sankey: pin a flow', () => {
    const { container } = renderIntl(<VariantSankey data={v as Chapter01VariantData} />)
    fireEvent.click(container.querySelector('svg [role="button"]')!)
    expect(track).toHaveBeenCalledWith('sankey', 'pin', expect.stringMatching(/^flow::/))
  })

  it('map: zoom (debounced) and pin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 })))
    const { container } = renderIntl(<OriginMap pins={ch02.origins as OriginPin[]} />)
    const zoomIn = await screen.findByRole('button', { name: msg('zh', 'ch02.map.zoomIn') })
    fireEvent.click(zoomIn)
    await waitFor(() => expect(track).toHaveBeenCalledWith('map', 'zoom', 1.6), { timeout: 1500 })
    fireEvent.click(container.querySelector('[data-pin="true"]')!)
    expect(track).toHaveBeenCalledWith('map', 'pin', expect.any(String))
  })

  it.each([
    ['cumulative', () => renderIntl(<CumulativeChart data={ch01 as Chapter01Data} />), 'svg [role="button"]'],
    ['treemap', () => renderIntl(<CategoryTreemap data={cat as Chapter01CategoryData} />), 'svg [role="button"]'],
    ['sankey', () => renderIntl(<VariantSankey data={v as Chapter01VariantData} />), 'svg [role="button"]'],
  ] as const)('%s: a second click unpins, Escape closes once', (target, render, selector) => {
    const { container } = render()
    pinUnpinClose(target, container.querySelector(selector)!)
  })

  it('map: a second click unpins, Escape closes once, the close button logs close', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 })))
    const { container } = renderIntl(<OriginMap pins={ch02.origins as OriginPin[]} />)
    await screen.findByRole('button', { name: msg('zh', 'ch02.map.zoomIn') })
    const pin = container.querySelector('[data-pin="true"]')!
    pinUnpinClose('map', pin)
    vi.mocked(track).mockClear()
    fireEvent.click(pin)
    // The tooltip wrapper is aria-hidden (pointer-only), hence hidden: true.
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch02.map.close'), hidden: true }))
    expect(calls('map')).toEqual(['pin', 'close'])
  })

  it('cumulative: changing range with nothing pinned logs no close', () => {
    renderIntl(<CumulativeChart data={ch01 as Chapter01Data} />)
    fireEvent.click(screen.getByRole('button', { name: msg('zh', 'ch01.chart.range2015') }))
    expect(calls('cumulative')).toEqual(['range'])
  })
})
