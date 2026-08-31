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

export function corsHeaders(origin: string): HeadersInit {
  const allowed = [
    'https://landingpagebuild.com',
    'https://staging.landingpagebuild.com',
    'http://localhost:3000',
    'http://localhost:8787',
  ]

  // Admin panel (Phase 3) — plain static Vite/React app on its own
  // Cloudflare Pages project (../../admin), separate from the exact-match
  // list above because every `wrangler pages deploy` also gets its own
  // preview subdomain (https://<hash>.landingpagebuild-admin-staging.pages.dev),
  // not just the stable production one.
  const isAdminPanelOrigin =
    origin === 'https://landingpagebuild-admin-staging.pages.dev' ||
    origin.endsWith('.landingpagebuild-admin-staging.pages.dev')

  const allowedOrigin = allowed.includes(origin) || isAdminPanelOrigin ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
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
