import { StaticHero } from './StaticHero'
import { StaticSection } from './StaticSection'
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
export function StaticStory({ ch02 }: Props) {
  return (
    <>
      <StaticHero />
      <StaticSection id="ch01" accent="var(--accent-01)" className="!py-0">
        {/* §01 charts are added in Tasks 6–8 */}
        {null}
      </StaticSection>
      <StaticWhoGetsIn data={ch02} />
    </>
  )
}
