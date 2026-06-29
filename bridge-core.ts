export const DEFAULT_ORIGINS = [
  'https://www.job4talents.at',
  'https://job4talents.at',
  'https://www.job4talents.com',
  'https://job4talents.com',
  'https://www.job4talents.de',
  'https://job4talents.de',
  'https://www.job4talents.ch',
  'https://job4talents.ch',
]

export function isLocalhostTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

export function parseAllowlist(env: string | undefined): string[] {
  const extra = (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...DEFAULT_ORIGINS, ...extra]
}

export function isOriginAllowed(
  origin: string | null,
  allowlist: string[],
): boolean {
  if (!origin) return false
  if (allowlist.includes(origin)) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function buildCorsHeaders(
  origin: string | null,
  allowlist: string[],
  requestHeaders?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      requestHeaders && requestHeaders.length > 0 ? requestHeaders : '*',
    'Access-Control-Max-Age': '600',
    'Access-Control-Expose-Headers': '*',
    Vary: 'Origin',
  }
  // Grant CORS *and* Private Network Access only to allowlisted origins. Sending
  // Access-Control-Allow-Private-Network for every origin let any public website
  // clear the browser's PNA preflight and probe/reach the local bridge; a denied
  // origin must receive neither header so its preflight fails.
  if (origin && isOriginAllowed(origin, allowlist)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Private-Network'] = 'true'
  }
  return headers
}
