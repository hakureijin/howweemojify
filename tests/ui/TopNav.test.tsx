import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderIntl } from '../helpers/intl'

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/static',
  useRouter: () => ({ replace: vi.fn() }),
}))

import { TopNav } from '@/components/TopNav'

afterEach(() => { vi.unstubAllEnvs() })

describe('<TopNav>', () => {
  it('offers the language switch in the public build', () => {
    renderIntl(<TopNav />)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('drops the language switch in the experiment build, keeping chapter anchors', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPERIMENT', '1')
    renderIntl(<TopNav />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
