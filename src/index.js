/**
 * Session-colour plugin, Host half.
 *
 * This half owns the durable store for colour marks and the two HTTP routes the
 * browser half talks to.
 *
 * Why routes and a file instead of the `settings` service: DSH only host-backs
 * user settings for loopback pages (`persistence = $host.isLoopback ? "host" :
 * "memory"`), so a page opened over the LAN or a tunnel gets a permanently
 * `unavailable` settings scope. Its own routes are not subject to that rule,
 * which is what makes a mark set on one device visible on another.
 *
 * A mark is only a colour keyed by Session id. This half never touches Session
 * identity, history, membership, ordering or archive records.
 *
 * Everything is defensive: a Host half that throws can take the Host's boot
 * down with it, so every step degrades to "no durable store" instead.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import z from '@deepseek-ai/schemastery'

/** Mount name, kept in sync with package.json and cordis.patch.yml. */
export const name = 'dsh-session-colors'

/** Host services are acquired inside `apply`; nothing must exist beforehand. */
export const inject = []

/** Route prefix owned by this plugin; the browser half uses the same constant. */
export const ROUTE_PREFIX = '/plugins/dsh-session-colors'

/** Request bodies are tiny: a Session id and four numbers. */
const BODY_CAP = 256 * 1024

/** One HSVA colour. Alpha is kept because the picker offers transparency. */
const ColorSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(1),
  v: z.number().min(0).max(1),
  a: z.number().min(0).max(1),
})

/** The durable document: Session id → colour. `dict` because ids are dynamic. */
export const MarksSchema = z.object({
  marks: z.dict(ColorSchema).default({}),
})

/**
 * Plugin config. `dataDir` is supplied by the profile owner, exactly as
 * `dsh-notify` does it: the plugin never guesses a profile directory.
 */
export const Config = z.object({
  dataDir: z.string().description('Absolute path to the profile-owned dsh-session-colors data directory.').required(false),
})

/** JSON response helper, matching the Host's own no-store convention. */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * A write must come from the page that owns this app. The LAN reverse proxy
 * rewrites Origin/Host to loopback before forwarding, so a legitimate remote
 * write still satisfies this check.
 */
function sameOriginRequest(req) {
  const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') return false
  const origin = req.headers?.origin
  if (!origin) return true
  try {
    return new URL(String(origin)).host === req.headers?.host
  } catch {
    return false
  }
}

/** Read a JSON object body, refusing anything oversized or mislabelled. */
async function readJson(req, limit = BODY_CAP) {
  const contentType = String(req.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') throw Object.assign(new Error('content-type must be application/json'), { status: 415 })
  const declared = Number(req.headers?.['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > limit) throw Object.assign(new Error('request body too large'), { status: 413 })
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > limit) throw Object.assign(new Error('request body too large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be an object')
    return value
  } catch (error) {
    throw Object.assign(error, { status: 400 })
  }
}

/** Keep only well-formed entries so one bad record cannot break the layer. */
function cleanMarks(input) {
  const marks = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return marks
  for (const id of Object.keys(input)) {
    const color = input[id]
    if (color === null || typeof color !== 'object') continue
    if (typeof color.h !== 'number' || typeof color.s !== 'number' || typeof color.v !== 'number' || typeof color.a !== 'number') continue
    marks[id] = { h: color.h, s: color.s, v: color.v, a: color.a }
  }
  return marks
}

/**
 * The durable marks store: one JSON document under the profile's data
 * directory, written atomically. Without a usable `dataDir` it still serves the
 * process's own view, so the feature degrades instead of disappearing.
 * @param dataDir - absolute profile-owned directory, or undefined.
 */
export function createMarksFile(dataDir) {
  const file = typeof dataDir === 'string' && isAbsolute(dataDir) ? join(dataDir, 'session-colors.json') : null
  let marks = {}
  if (file !== null) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      marks = cleanMarks(parsed?.marks)
    } catch {
      // First run, or a file we are about to overwrite.
    }
  }
  return {
    get: () => ({ ...marks }),
    /**
     * Apply one change and persist the whole document.
     * @param sessionId - Session the mark belongs to.
     * @param color - the colour, or undefined to clear the mark.
     */
    set(sessionId, color) {
      const next = { ...marks }
      if (color === undefined) delete next[sessionId]
      else next[sessionId] = color
      marks = cleanMarks(next)
      if (file === null) return { ...marks }
      try {
        mkdirSync(dirname(file), { recursive: true })
        const temporary = `${file}.tmp`
        writeFileSync(temporary, `${JSON.stringify({ version: 1, marks }, null, 2)}\n`, 'utf8')
        renameSync(temporary, file)
      } catch {
        // A read-only profile still gets the change for this process.
      }
      return { ...marks }
    },
    /** What `/marks` reports about durability. */
    get status() {
      return { persistence: file === null ? 'session' : 'file' }
    },
  }
}

/**
 * Register the durable store and its routes when the web server is composed.
 * @param ctx - Host context.
 * @param config - plugin config; `dataDir` enables persistence.
 */
export function apply(ctx, config = {}) {
  try {
    if (ctx === undefined || ctx === null || typeof ctx.inject !== 'function') return
    const store = createMarksFile(config === null || config === undefined ? undefined : config.dataDir)
    ctx.inject(['webServer', 'connection'], (hostCtx) => {
      try {
        const webServer = hostCtx === undefined || hostCtx === null ? undefined : hostCtx.webServer
        const connection = hostCtx === undefined || hostCtx === null ? undefined : hostCtx.connection
        if (webServer === undefined || webServer === null || typeof webServer.register !== 'function') return

        const route = (path, handler) => {
          const register = () => webServer.register({
            kind: 'exact',
            path: `${ROUTE_PREFIX}${path}`,
            handler: async (req, res) => {
              // Same fence the shipped authenticated routes use.
              try {
                const rejection = connection === undefined || connection === null ? undefined : connection.requestRejection(req)
                if (rejection !== undefined) {
                  res.statusCode = rejection
                  res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
                  return
                }
              } catch {
                // A fence that cannot answer must not turn into an open door.
                res.statusCode = 403
                res.end('forbidden')
                return
              }
              try {
                await handler(req, res)
              } catch (error) {
                sendJson(res, error?.status ?? 500, { error: error?.status ? error.message : 'internal error' })
              }
            },
          })
          return typeof ctx.effect === 'function' ? ctx.effect(register, `dsh-session-colors: ${path}`) : register()
        }

        route('/marks', async (req, res) => {
          if (req.method === 'GET') {
            sendJson(res, 200, { marks: store.get(), storage: store.status })
            return
          }
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('allow', 'GET, POST')
            res.end()
            return
          }
          if (!sameOriginRequest(req)) {
            res.statusCode = 403
            res.end('forbidden')
            return
          }
          const body = await readJson(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
          if (sessionId === undefined || sessionId === '') {
            sendJson(res, 400, { error: 'sessionId is required' })
            return
          }
          const clearing = body.color === null || body.color === undefined
          const color = clearing ? undefined : cleanMarks({ one: body.color }).one
          if (!clearing && color === undefined) {
            sendJson(res, 400, { error: 'color must be {h,s,v,a}' })
            return
          }
          sendJson(res, 200, { marks: store.set(sessionId, color), storage: store.status })
        })
      } catch {
        // No routes: the browser half keeps marks for the life of the page.
      }
    })
  } catch {
    // Never let this half break the Host boot.
  }
}
