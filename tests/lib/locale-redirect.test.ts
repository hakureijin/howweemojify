import { describe, it, expect } from 'vitest'
import { redirectHref, redirectScript } from '@/lib/locale-redirect'

/**
 * 执行生成的脚本，注入假的 navigator/location，返回被请求的跳转目标。
 * 脚本形如 (function(n,l){...})(navigator,location);，故 new Function 的
 * 两个形参正好遮蔽掉全局的 navigator/location。
 */
function runScript(script: string, language: string): string[] {
  const seen: string[] = []
  const fn = new Function('navigator', 'location', script)
  fn({ language }, { replace: (url: string) => seen.push(url) })
  return seen
}

describe('redirectHref', () => {
  it('builds a trailing-slash URL under the base path', () => {
    expect(redirectHref('/howweemojify', 'zh')).toBe('/howweemojify/zh/')
  })

  it('builds a root-relative URL when the base path is empty', () => {
    expect(redirectHref('', 'en')).toBe('/en/')
  })
})

describe('redirectScript', () => {
  it('sends English browsers to the en route under the base path', () => {
    expect(runScript(redirectScript('/howweemojify'), 'en-GB')).toEqual([
      '/howweemojify/en/',
    ])
  })

  it('sends Chinese browsers to the zh route', () => {
    expect(runScript(redirectScript('/howweemojify'), 'zh-CN')).toEqual([
      '/howweemojify/zh/',
    ])
  })

  it('falls back to zh for any other language', () => {
    expect(runScript(redirectScript('/howweemojify'), 'ja-JP')).toEqual([
      '/howweemojify/zh/',
    ])
  })

  it('works with an empty base path', () => {
    expect(runScript(redirectScript(''), 'zh-CN')).toEqual(['/zh/'])
  })
})
