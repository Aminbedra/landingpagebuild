import { Hono } from 'hono'
import type { Env } from '../types'
import { generateId, now } from '../lib/utils'

// ── Phase 2 (Priority 1) — public, visitor-facing lead capture ───────────────
//
// Distinct from POST /websites/:websiteId/leads (routes/leads.ts), which
// belongs to the retired multi-tenant builder surface (see
// ARCHITECTURE.md "What Is Retired") and requires a real `website_id` row
// that a market page doesn't have. This is what the market page's LeadForm
// island (astro/src/components/market/LeadForm.tsx) actually calls.
//
// :market is a path param, not derived from headers — the calling page
// already knows which market it's rendering (it just read config:{market}
// to render itself), so there's no need to sniff it. `subdomain` is still
// derived from Origin/Referer/Host, same reasoning as
// routes/leads.ts's deriveMarketAndSubdomain: this Worker's own Host
// header is its own domain, not the calling page's — only Origin/Referer
// carry that for a cross-origin browser fetch.

const publicLeads = new Hono<{ Bindings: Env }>()

const MARKET_SLUG_RE = /^[a-z0-9-]+$/

function hostFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).host
  } catch {
    return undefined
  }
}

function visitorSubdomain(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    hostFromUrl(c.req.header('Origin')) ??
    hostFromUrl(c.req.header('Referer')) ??
    c.req.header('Host') ??
    ''
  )
}

// POST /api/leads/:market — public, no auth
publicLeads.post('/:market', async (c) => {
  const market = c.req.param('market')
  if (!MARKET_SLUG_RE.test(market)) {
    return c.json({ success: false, error: 'Invalid market' }, 400)
  }

  let body: { name?: string; email?: string; message?: string; company?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const name = body.name?.trim()
  const email = body.email?.trim()
  const message = body.message?.trim()
  const company = body.company?.trim() || null

  if (!name || !email || !message) {
    return c.json({ success: false, error: 'name, email, and message are required' }, 400)
  }

  const id = generateId()
  const timestamp = now()
  const subdomain = visitorSubdomain(c)

  try {
    await c.env.DB.prepare(
      `INSERT INTO leads (id, website_id, market, subdomain, name, email, message, company, submitted_at, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, market, subdomain, name, email, message, company, timestamp, timestamp).run()
  } catch (e) {
    // Never leak D1's own error text to a visitor — log it for `wrangler
    // tail`/dashboard visibility instead (same pattern as lib/resend.ts).
    console.error('Failed to write lead:', e)
    return c.json({ success: false, error: 'Could not save your message. Please try again.' }, 500)
  }

  return c.json({ success: true, id })
})

export default publicLeads
