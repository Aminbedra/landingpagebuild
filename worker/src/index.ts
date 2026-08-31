import { Hono } from 'hono'
import type { Env } from './types'
import { corsHeaders, err } from './lib/utils'
import authRoutes from './routes/auth'
import websiteRoutes from './routes/websites'
import pageRoutes from './routes/pages'
import leadRoutes from './routes/leads'
import versionRoutes from './routes/versions'
import aiRoutes from './routes/ai'

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

// ── Routes ────────────────────────────────────────────────────────────────────
app.route('/auth', authRoutes)
app.route('/websites', websiteRoutes)
app.route('/websites/:websiteId/pages', pageRoutes)
app.route('/websites/:websiteId/leads', leadRoutes)
app.route('/websites/:websiteId/versions', versionRoutes)
app.route('/websites/:websiteId/ai', aiRoutes)

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.notFound((c) => new Response(JSON.stringify({ success: false, error: `Route ${c.req.method} ${c.req.path} not found` }), { status: 404, headers: { 'Content-Type': 'application/json' } }))

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((error, _c) => {
  console.error('Unhandled error:', error)
  return err('Internal server error', 500)
})

export default app
