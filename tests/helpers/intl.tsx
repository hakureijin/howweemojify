import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import zh from '@/messages/zh.json'
import en from '@/messages/en.json'

const MESSAGES = { zh, en }

export function renderIntl(ui: ReactElement, locale: 'zh' | 'en' = 'zh') {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  )
}

/** 读取原始文案（不做 ICU 插值），用于断言无参数的文案出现在页面上。 */
export function msg(locale: 'zh' | 'en', key: string): string {
  let node: unknown = MESSAGES[locale]
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
  if (typeof node !== 'string') throw new Error(`no message at ${key}`)
  return node
}
