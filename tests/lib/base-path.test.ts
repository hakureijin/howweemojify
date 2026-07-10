import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveBasePath, withBasePath } from '@/lib/base-path'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveBasePath', () => {
  it("returns the project subpath when GITHUB_PAGES is 'true'", () => {
    expect(resolveBasePath('true')).toBe('/howweemojify')
  })

  it('returns an empty string when GITHUB_PAGES is unset', () => {
    expect(resolveBasePath(undefined)).toBe('')
  })

  it('returns an empty string for any value other than "true"', () => {
    expect(resolveBasePath('false')).toBe('')
    expect(resolveBasePath('1')).toBe('')
  })
})

describe('withBasePath', () => {
  it('leaves the path untouched when no base path is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '')
    expect(withBasePath('/world-atlas/countries-110m.json')).toBe(
      '/world-atlas/countries-110m.json',
    )
  })

  it('prefixes the path when a base path is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/howweemojify')
    expect(withBasePath('/world-atlas/countries-110m.json')).toBe(
      '/howweemojify/world-atlas/countries-110m.json',
    )
  })
})
