import { Hono } from 'hono'
import type { Env } from './types'
import { corsHeaders, err } from './lib/utils'
import authRoutes from './routes/auth'
import websiteRoutes from './routes/websites'
import pageRoutes from './routes/pages'
import leadRoutes from './routes/leads'
import versionRoutes from './routes/versions'
import aiRoutes from './routes/ai'
import adminRoutes from './routes/admin'
import adminAuthRoutes from './routes/adminAuth'
import adminUsersRoutes from './routes/adminUsers'
import mediaRoutes from './routes/media'
import analyticsRoutes from './routes/analytics'
import publicLeadsRoutes from './routes/publicLeads'
import publicAiRoutes from './routes/publicAi'

const app = new Hono<{ Bindings: Env }>()

// ── CORS preflight ────────────────────────────────────────────────────────────
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(c.req.header('Origin') ?? ''),
  })
})

// ── CORS on all responses ─────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  await next()
  const origin = c.req.header('Origin') ?? ''
  const headers = corsHeaders(origin)
  Object.entries(headers).forEach(([k, v]) => c.res.headers.set(k, v))
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({ status: 'ok', environment: c.env.ENVIRONMENT, timestamp: new Date().toISOString() })
})

// ── Phase 2 (Priority 1) — public market endpoints ────────────────────────────
// Lead capture + AI pitch widget for the live market pages
// (astro/src/pages/index.astro). Own prefixes (/api/leads, /api/ai), no
// overlap with anything below, so mount order relative to the rest of
// this file doesn't matter — grouped here for visibility since they're
// the two genuinely public, unauthenticated, visitor-facing endpoints in
// the whole Worker.
app.route('/api/leads', publicLeadsRoutes)
app.route('/api/ai', publicAiRoutes)

// ── Routes ────────────────────────────────────────────────────────────────────
// RETIRED — 2026-09
// The /auth and /websites* mounts below route to the multi-tenant website
// builder surface, superseded by the market-routing model. Do not extend
// or build on them. Scheduled for deletion in a future cleanup pass (this
// file itself stays — it's the live entrypoint mounting both the retired
// and current routers). See ARCHITECTURE.md for context.
//
// More specific /websites/:websiteId/* mounts must be registered before the
// plain /websites mount: websiteRoutes applies `requireAuth` to '*', and Hono
// runs matched handlers in registration order (not by path specificity) — so
// mounting it first would make that middleware intercept requests meant for
// the sub-routers, including leadRoutes' public POST /websites/:id/leads.
app.route('/auth', authRoutes)
app.route('/websites/:websiteId/pages', pageRoutes)
app.route('/websites/:websiteId/leads', leadRoutes)
app.route('/websites/:websiteId/versions', versionRoutes)
app.route('/websites/:websiteId/ai', aiRoutes)
app.route('/websites', websiteRoutes)
// Same reasoning as above: adminRoutes applies requireSuperAdmin to '*', so
// the unprotected POST /api/admin/login has to be mounted first or that
// middleware would intercept it too.
app.route('/api/admin', adminAuthRoutes)
// adminUsersRoutes must be mounted before adminRoutes for the same reason
// as above: adminRoutes applies requireSuperAdmin to '*' at the broader
// /api/admin prefix, and Hono matches in registration order — mounting it
// first would risk intercepting /api/admin/users/* before this router's
// own (identical) guard ever runs, or 404ing if admin.ts's dispatch
// swallows the request first.
app.route('/api/admin/users', adminUsersRoutes)
// Same ordering reasoning again — GET /api/admin/media/serve/:key must
// stay reachable with zero auth (public landing-page images), so this is
// mounted before admin.ts's blanket-protected /api/admin catch-all too.
app.route('/api/admin/media', mediaRoutes)
// No public sub-route here (unlike media's /serve), but mounted before
// adminRoutes anyway for consistency with the same ordering pattern.
app.route('/api/admin/analytics', analyticsRoutes)
app.route('/api/admin', adminRoutes)

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.notFound((c) => new Response(JSON.stringify({ success: false, error: `Route ${c.req.method} ${c.req.path} not found` }), { status: 404, headers: { 'Content-Type': 'application/json' } }))

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((error, _c) => {
  console.error('Unhandled error:', error)
  return err('Internal server error', 500)
})

export default app
