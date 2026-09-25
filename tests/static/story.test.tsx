import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, stubResizeObserver } from '../helpers/intl'
import { StaticStory } from '@/components/static/StaticStory'
import ch01 from '@/data/chapter-01.json'
import ch01Cat from '@/data/chapter-01-categories.json'
import ch01Var from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

const atlas = readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8')

beforeAll(() => {
  stubResizeObserver()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(atlas, { status: 200 })))
})
afterAll(() => vi.unstubAllGlobals())

describe.each(['zh', 'en'] as const)('static page (%s)', locale => {
  it('renders every chapter, all sections, and nothing operable', async () => {
    const { container } = renderIntl(
      <StaticStory
        ch01={ch01 as Chapter01Data}
        ch01Cat={ch01Cat as Chapter01CategoryData}
        ch01Var={ch01Var as Chapter01VariantData}
        ch02={ch02 as unknown as Chapter02Data}
      />,
      locale,
    )
    await waitFor(() => expect(container.querySelector('svg[data-map="main"]')).not.toBeNull())
    expect(container.querySelector('#ch01')).not.toBeNull()
    expect(container.querySelector('#ch02')).not.toBeNull()
    const sections = [...container.querySelectorAll('[data-track-section]')].map(el => el.getAttribute('data-track-section'))
    expect(sections).toEqual(['hero', 'ch01-cumulative', 'ch01-treemap', 'ch01-sankey', 'ch02-pipeline', 'ch02-criteria', 'ch02-cases', 'ch02-map'])
    assertNoInteractive(container)
    for (const a of container.querySelectorAll('a')) expect(a.getAttribute('href')).toMatch(/^https?:\/\//)
  })
})
