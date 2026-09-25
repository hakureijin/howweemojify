import { setRequestLocale } from 'next-intl/server'
import { TopNav } from '@/components/TopNav'
import { Footer } from '@/components/Footer'
import { StaticStory } from '@/components/static/StaticStory'

import ch01 from '@/data/chapter-01.json'
import ch01Cat from '@/data/chapter-01-categories.json'
import ch01Var from '@/data/chapter-01-variants.json'
import ch02 from '@/data/chapter-02.json'

import type { Chapter01Data, Chapter01CategoryData, Chapter01VariantData } from '@/types/chapter-01'
import type { Chapter02Data } from '@/types/chapter-02'

/** Control condition for the user study: same information as /[locale], laid out
 *  for reading, with no interaction and no motion. Not linked from the main page. */
export default async function StaticPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <>
      <TopNav />
      <StaticStory
        ch01={ch01 as Chapter01Data}
        ch01Cat={ch01Cat as Chapter01CategoryData}
        ch01Var={ch01Var as Chapter01VariantData}
        ch02={ch02 as Chapter02Data}
      />
      <Footer />
    </>
  )
}
