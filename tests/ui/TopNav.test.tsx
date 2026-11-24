import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderIntl } from '../helpers/intl'

const navigation = vi.hoisted(() => ({ pathname: '/static', push: vi.fn(), replace: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}))

import { TopNav } from '@/components/TopNav'

afterEach(() => {
  vi.unstubAllEnvs()
  navigation.pathname = '/static'
  navigation.push.mockClear()
  navigation.replace.mockClear()
  window.history.replaceState({}, '', '/')
})

describe('<TopNav>', () => {
  it('offers the language switch in the public build', () => {
    renderIntl(<TopNav />)
    expect(screen.getByRole('button', { name: '切换到英文' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切换到动态版' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('switches from static to dynamic while preserving the query string', () => {
    window.history.replaceState({}, '', '/zh/static/?pid=P001')
    renderIntl(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: '切换到动态版' }))
    expect(navigation.push).toHaveBeenCalledWith('/?pid=P001')
  })

  it('recognizes the exported static route with its trailing slash', () => {
    navigation.pathname = '/static/'
    renderIntl(<TopNav />)
    expect(screen.getByRole('button', { name: '切换到动态版' })).toBeInTheDocument()
  })

  it('switches from dynamic to static', () => {
    navigation.pathname = '/'
    renderIntl(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: '切换到静态版' }))
    expect(navigation.push).toHaveBeenCalledWith('/static')
  })

  it('keeps the page switch in the experiment build while hiding the language switch', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    renderIntl(<TopNav />)
    expect(screen.queryByRole('button', { name: '切换到英文' })).toBeNull()
    expect(screen.getByRole('button', { name: '切换到动态版' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
