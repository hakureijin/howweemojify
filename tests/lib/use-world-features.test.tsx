import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useWorldFeatures } from '@/lib/use-world-features'

const atlas = JSON.parse(readFileSync(resolve(__dirname, '../../public/world-atlas/countries-110m.json'), 'utf8'))

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('useWorldFeatures', () => {
  it('fetches the atlas through withBasePath and returns country features', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/howweemojify')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(atlas), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useWorldFeatures())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/howweemojify/world-atlas/countries-110m.json')
    expect(result.current!.features.length).toBe(177)
  })
})
