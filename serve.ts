import {
  buildCorsHeaders,
  isLocalhostTarget,
  parseAllowlist,
} from './bridge-core'

const VERSION = '1.0.1'
const PORT = Number(process.env.J4T_BRIDGE_PORT ?? 11435)
const TARGET = process.env.J4T_BRIDGE_TARGET ?? 'http://127.0.0.1:11434'
const ALLOWLIST = parseAllowlist(process.env.J4T_BRIDGE_ORIGINS)

if (!isLocalhostTarget(TARGET)) {
  console.error(`[j4t-bridge] Refusing non-localhost target: ${TARGET}`)
  process.exit(1)
}

Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin')
    const cors = buildCorsHeaders(
      origin,
      ALLOWLIST,
      req.headers.get('Access-Control-Request-Headers'),
    )

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (url.pathname === '/__j4t_bridge') {
      return Response.json(
        {
          ok: true,
          name: 'j4t-ollama-bridge',
          version: VERSION,
          target: TARGET,
        },
        { headers: cors },
      )
    }

    const targetUrl = new URL(url.pathname + url.search, TARGET)
    const headers = new Headers(req.headers)
    headers.delete('host')
    headers.delete('origin')
    headers.delete('connection')

    let upstream: Response
    try {
      upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body:
          req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
        duplex: 'half',
        redirect: 'manual',
      } as RequestInit)
    } catch {
      return Response.json(
        { error: `bridge: cannot reach Ollama at ${TARGET}` },
        { status: 502, headers: cors },
      )
    }

    const respHeaders = new Headers(upstream.headers)
    for (const [key, value] of Object.entries(cors)) respHeaders.set(key, value)
    console.log(
      `[j4t-bridge] ${req.method} ${url.pathname} -> ${upstream.status}`,
    )
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    })
  },
})

console.log(`[j4t-bridge] listening on http://127.0.0.1:${PORT} -> ${TARGET}`)
console.log(
  `[j4t-bridge] allowed origins: ${ALLOWLIST.join(', ')} (+ localhost)`,
)
