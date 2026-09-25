import { describe, it, expect, beforeAll } from 'vitest'
import { screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderIntl, assertNoInteractive, stubResizeObserver, msg } from '../helpers/intl'
import { StaticHero } from '@/components/static/StaticHero'
import { StaticWhoGetsIn } from '@/components/static/StaticWhoGetsIn'
import ch02 from '@/data/chapter-02.json'
import type { Chapter02Data } from '@/types/chapter-02'

const data = ch02 as unknown as Chapter02Data

beforeAll(() => {
  stubResizeObserver()
  // The map is added in Task 9; keep this test independent of the network.
  globalThis.fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch
})

describe('static scaffold', () => {
  it('hero shows the same headline copy and nothing operable', () => {
    const { container } = renderIntl(<StaticHero />)
    expect(screen.getByText(msg('zh', 'hero.eyebrow'))).toBeInTheDocument()
    expect(screen.getByText(msg('zh', 'hero.subtitle'))).toBeInTheDocument()
    assertNoInteractive(container)
  })

  it('ch02 lists every pipeline step, criterion and case without controls', () => {
    const { container } = renderIntl(<StaticWhoGetsIn data={data} />)
    for (const s of data.pipeline) expect(screen.getByText(msg('zh', s.labelKey))).toBeInTheDocument()
    for (const c of data.criteria) expect(screen.getByText(msg('zh', c.titleKey))).toBeInTheDocument()
    for (const c of data.cases) expect(screen.getByText(msg('zh', c.storyKey))).toBeInTheDocument()
    expect(container.querySelector('#ch02')).not.toBeNull()
    assertNoInteractive(container)
  })

  it('static components never import animation libraries or attach handlers', () => {
    const dir = resolve(__dirname, '../../components/static')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(resolve(dir, f), 'utf8')
      expect(src, f).not.toMatch(/framer-motion|gsap|onClick|onMouse|onKey|onFocus|tabIndex/)
    }
  })
})
