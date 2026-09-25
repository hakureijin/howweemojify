import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SECTIONS = ['hero', 'ch01-cumulative', 'ch01-treemap', 'ch01-sankey', 'ch02-pipeline', 'ch02-criteria', 'ch02-cases', 'ch02-map', 'footer']

function sectionsIn(files: string[]): string[] {
  const found = new Set<string>()
  for (const f of files) {
    const src = readFileSync(resolve(__dirname, '../..', f), 'utf8')
    for (const m of src.matchAll(/data-track-section="([a-z0-9-]+)"/g)) found.add(m[1])
  }
  return [...found].sort()
}

describe('tracked sections', () => {
  it('interactive and static pages mark the same sections', () => {
    const interactive = sectionsIn(['app/[locale]/page.tsx', 'components/Hero.tsx', 'components/chapter-02/WhoGetsIn.tsx', 'components/Footer.tsx'])
    const still = sectionsIn(['components/static/StaticHero.tsx', 'components/static/StaticStory.tsx', 'components/static/StaticWhoGetsIn.tsx', 'components/Footer.tsx'])
    expect(interactive).toEqual([...SECTIONS].sort())
    expect(still).toEqual([...SECTIONS].sort())
  })
})
