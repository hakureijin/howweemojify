import { StaticHero } from './StaticHero'
import { StaticSection } from './StaticSection'
import { StaticCumulative } from './StaticCumulative'
import { StaticTreemap } from './StaticTreemap'
import { StaticSankey } from './StaticSankey'
import { StaticWhoGetsIn } from './StaticWhoGetsIn'
import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

interface Props {
  ch01: Chapter01Data
  ch01Cat: Chapter01CategoryData
  ch01Var: Chapter01VariantData
  ch02: Chapter02Data
}

/** Everything between the nav and the footer on /[locale]/static. */
export function StaticStory({ ch01, ch01Cat, ch01Var, ch02 }: Props) {
  return (
    <>
      <StaticHero />
      <StaticSection id="ch01" accent="var(--accent-01)" className="!py-0">
        <div data-track-section="ch01-cumulative" className="max-w-6xl mx-auto px-6 pt-12 pb-8">
          <StaticCumulative data={ch01} />
        </div>
        <div data-track-section="ch01-treemap" className="max-w-6xl mx-auto px-6 pt-2 pb-8 border-t border-[color:var(--line)]/40">
          <div className="pt-8">
            <StaticTreemap data={ch01Cat} />
          </div>
        </div>
        <div data-track-section="ch01-sankey" className="max-w-6xl mx-auto px-6 pt-2 pb-16 border-t border-[color:var(--line)]/40">
          <div className="pt-8">
            <StaticSankey data={ch01Var} />
          </div>
        </div>
      </StaticSection>
      <StaticWhoGetsIn data={ch02} />
    </>
  )
}
