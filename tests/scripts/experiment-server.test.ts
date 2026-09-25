// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createExperimentServer } from '../../scripts/experiment-server.mjs'

let base = ''
let tmp = ''
let root = ''
let logDir = ''
let server: ReturnType<typeof createExperimentServer>

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'exp-'))
  root = join(tmp, 'out')
  logDir = join(tmp, 'logs')
  mkdirSync(join(root, 'zh/static'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<p>root</p>')
  writeFileSync(join(root, 'zh/static/index.html'), '<p>static zh</p>')
  writeFileSync(join(root, '404.html'), '<p>missing</p>')
  writeFileSync(join(root, 'app.js'), 'console.log(1)')
  writeFileSync(join(tmp, 'secret.txt'), 'do not serve')
  server = createExperimentServer({ root, logDir })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
  rmSync(tmp, { recursive: true, force: true })
})
beforeEach(() => { rmSync(logDir, { recursive: true, force: true }) })

const post = (body: string) => fetch(`${base}/api/log`, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
const logLines = () => {
  let files: string[] = []
  try { files = readdirSync(logDir) } catch { return [] }
  return files.flatMap(f => readFileSync(join(logDir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)))
}

describe('experiment server', () => {
  it('health check', async () => {
    const r = await fetch(`${base}/api/health`)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('ok')
  })

  it('appends valid events to a dated JSONL file with server time and ip', async () => {
    const r = await post(JSON.stringify([{ type: 'session_start', pid: 'P1' }, { type: 'scroll', pid: 'P1' }]))
    expect(r.status).toBe(204)
    expect(readdirSync(logDir)[0]).toMatch(/^events-\d{4}-\d{2}-\d{2}\.jsonl$/)
    const lines = logLines()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ type: 'session_start', pid: 'P1' })
    expect(typeof lines[0].serverTime).toBe('string')
    expect(lines[0].ip).toContain('127.0.0.1')
  })

  it.each([
    ['invalid JSON', '{nope'],
    ['not an array', '{"type":"x"}'],
    ['empty array', '[]'],
    ['non-object items', '[1,2]'],
    ['too many events', JSON.stringify(Array.from({ length: 101 }, () => ({ type: 'e' })))],
    ['too large', JSON.stringify([{ type: 'e', pad: 'x'.repeat(70 * 1024) }])],
  ])('rejects %s with 400 and writes nothing', async (_, body) => {
    const r = await post(body)
    expect(r.status).toBe(400)
    expect(logLines()).toHaveLength(0)
  })

  it('only accepts POST on /api/log', async () => {
    expect((await fetch(`${base}/api/log`)).status).toBe(405)
  })

  it('serves directory indexes and assets', async () => {
    const r = await fetch(`${base}/zh/static/?pid=P1`)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/html')
    expect(await r.text()).toContain('static zh')
    expect((await fetch(`${base}/app.js`)).headers.get('content-type')).toContain('javascript')
  })

  it('redirects a directory without trailing slash, keeping the query', async () => {
    const r = await fetch(`${base}/zh/static?pid=P1`, { redirect: 'manual' })
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe('/zh/static/?pid=P1')
  })

  it('404s with the exported 404 page', async () => {
    const r = await fetch(`${base}/nope`)
    expect(r.status).toBe(404)
    expect(await r.text()).toContain('missing')
  })

  it('refuses paths that escape the export directory', async () => {
    const r = await fetch(`${base}/zh%2F..%2F..%2Fsecret.txt`)
    expect(r.status).toBe(403)
  })

  it('answers malformed percent-encoding with 400 instead of crashing', async () => {
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400)
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })
})
