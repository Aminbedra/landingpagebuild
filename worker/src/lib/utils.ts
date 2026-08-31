import type { ApiResponse } from '../types'

// ── ID generation ─────────────────────────────────────────────────────────────
// Think of this like a stamp machine — every record gets a unique, collision-proof ID

export function generateId(): string {
  return crypto.randomUUID()
}

// ── Response helpers ──────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function err(message: string, status = 400, code?: number): Response {
  const body: ApiResponse<never> = { success: false, error: message, code }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── CORS headers ──────────────────────────────────────────────────────────────

const EXACT_ALLOWED_ORIGINS = [
  'https://landingpagebuild.com',
  'https://staging.landingpagebuild.com',
  'http://localhost:3000',
  'http://localhost:8787',
]

// Market subdomains (Phase 4/5) — staging (landingpagbuild.com, missing
// the second 'e' on purpose, see astro/src/lib/marketConfig.ts) and
// production (landingpagebuild.com). Regex, not a fixed list: uk/de/fr
// today, but any market slug added later needs no CORS change.
const MARKET_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.landingpagbuild\.com$/,
  /^https:\/\/[a-z0-9-]+\.landingpagebuild\.com$/,
]

function isAllowedOrigin(origin: string): boolean {
  if (EXACT_ALLOWED_ORIGINS.includes(origin)) return true

  // Admin panel (Phase 3) — plain static Vite/React app on its own
  // Cloudflare Pages project (../../admin), matched separately from the
  // exact list above because every `wrangler pages deploy` also gets its
  // own preview subdomain (https://<hash>.landingpagebuild-admin-staging.pages.dev),
  // not just the stable production one.
  if (
    origin === 'https://landingpagebuild-admin-staging.pages.dev' ||
    origin.endsWith('.landingpagebuild-admin-staging.pages.dev')
  ) {
    return true
  }

  return MARKET_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

export function corsHeaders(origin: string): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  // The previous version fell back to a fixed origin (the production
  // domain) for any non-matching request instead of omitting the header —
  // harmless in that a browser still rejects the mismatch, but it meant a
  // request from an unlisted origin like evil.com got back an ACAO header
  // at all, which fails a literal "no matching ACAO header" check (and is
  // needlessly informative to a caller that shouldn't get anything). Omit
  // it outright for anything not on the allowlist.
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function parsePagination(url: URL): { limit: number; offset: number } {
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  return { limit: isNaN(limit) ? 20 : limit, offset: isNaN(offset) ? 0 : offset }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString()
}
