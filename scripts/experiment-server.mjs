// Serves the static export (out/) and collects behaviour logs for the user
// study. Node built-ins only, so it runs unchanged on a lab PC or a cloud VM:
//   npm run experiment            (build with NEXT_PUBLIC_EXPERIMENT=1, then serve)
//   node scripts/experiment-server.mjs   (serve an existing out/)
// Env: PORT (7777), OUT_DIR (out), LOG_DIR (logs).
import { createServer } from 'node:http'
import { createReadStream, existsSync, promises as fs } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MAX_EVENTS = 100
export const MAX_BYTES = 64 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} [body]
 * @param {Record<string, string | number>} [headers]
 */
function send(res, status, body = '', headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

/** Reads the whole body; returns null if it exceeds `limit` bytes. Keeps
 *  draining past the limit so the response can still be written.
 *  @param {import('node:http').IncomingMessage} req
 *  @param {number} limit
 *  @returns {Promise<string | null>} */
async function readBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size <= limit) chunks.push(chunk)
  }
  return size > limit ? null : Buffer.concat(chunks).toString('utf8')
}

/** Parsed events, or null unless the body is a non-empty array of at most
 *  MAX_EVENTS plain objects.
 *  @param {string} text
 *  @returns {object[] | null} */
export function validateEvents(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_EVENTS) return null
  if (!data.every(e => e !== null && typeof e === 'object' && !Array.isArray(e))) return null
  return data
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} logDir
 */
async function handleLog(req, res, logDir) {
  if (req.method !== 'POST') return send(res, 405, 'method not allowed', { allow: 'POST' })
  const text = await readBody(req, MAX_BYTES)
  const events = text === null ? null : validateEvents(text)
  if (!events) return send(res, 400, 'bad request')
  const serverTime = new Date().toISOString()
  const ip = req.socket.remoteAddress ?? ''
  const lines = events.map(e => JSON.stringify({ ...e, serverTime, ip })).join('\n') + '\n'
  await fs.mkdir(logDir, { recursive: true })
  // One appendFile per request writes whole lines, so concurrent requests never interleave mid-line.
  await fs.appendFile(join(logDir, `events-${serverTime.slice(0, 10)}.jsonl`), lines)
  send(res, 204)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} root
 * @param {URL} url
 */
async function serveStatic(req, res, root, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return send(res, 400, 'bad request')
  }
  if (pathname.includes('\0')) return send(res, 400, 'bad request')
  const target = resolve(root, '.' + pathname)
  if (target !== root && !target.startsWith(root + sep)) return send(res, 403, 'forbidden')

  let file = target
  let stat = await fs.stat(file).catch(() => null)
  if (stat?.isDirectory()) {
    // The export uses trailingSlash; relative asset URLs break without it.
    if (!url.pathname.endsWith('/')) return send(res, 301, '', { location: `${url.pathname}/${url.search}` })
    file = join(file, 'index.html')
    stat = await fs.stat(file).catch(() => null)
  }
  if (!stat?.isFile()) {
    const page = await fs.readFile(join(root, '404.html')).catch(() => null)
    res.writeHead(404, { 'content-type': MIME['.html'] })
    return res.end(page ?? 'not found')
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

/**
 * @param {{ root: string, logDir: string }} options
 * @returns {import('node:http').Server}
 */
export function createExperimentServer({ root, logDir }) {
  const rootAbs = resolve(root)
  const logAbs = resolve(logDir)
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const work =
      url.pathname === '/api/log' ? handleLog(req, res, logAbs)
      : url.pathname === '/api/health' ? Promise.resolve(send(res, 200, 'ok'))
      : serveStatic(req, res, rootAbs, url)
    work.catch(err => {
      console.error('[experiment]', err)
      if (!res.headersSent) send(res, 500, 'internal error')
      else res.end()
    })
  })
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 7777)
  const root = resolve(process.env.OUT_DIR ?? 'out')
  const logDir = resolve(process.env.LOG_DIR ?? 'logs')
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`[experiment] ${root} has no index.html — run \`npm run build:experiment\` first.`)
    process.exit(1)
  }
  createExperimentServer({ root, logDir }).listen(port, '0.0.0.0', () => {
    console.log(`[experiment] serving ${root} on http://0.0.0.0:${port}`)
    console.log(`[experiment] logs → ${logDir}/events-YYYY-MM-DD.jsonl (UTC date)`)
    console.log(`[experiment] interactive: http://<host>:${port}/zh/?pid=P001`)
    console.log(`[experiment] static:      http://<host>:${port}/zh/static/?pid=P001`)
  })
}
