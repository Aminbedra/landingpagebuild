import { Hono } from 'hono'

import type { AppContext } from '../middleware/requireAuth'
import type { Env } from '../types'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now, parsePagination } from '../lib/utils'
import { sendEmail } from '../lib/resend'
import { buildLeadEmailHtml } from '../lib/emailTemplates'

const leads = new Hono<AppContext>()

// Phase 3 Part 3/4 migration: derives which market a lead came from off
// the Host header, so every lead capture lands in one D1 table (see
// worker/migrations/0002_leads_market_schema.sql) instead of the two
// parallel schemas (this D1 table + a separate leads:{market}:{timestamp}
// KV log) that existed before this pass.
//
// Whitelisted against the real base domains rather than blacklisting known
// non-market hosting suffixes one at a time — an earlier version excluded
// only *.pages.dev and missed that requests hitting the Worker directly in
// staging arrive on *.workers.dev, which parsed as a bogus "market"
// (caught by testing the actual deployed endpoint, not just the brief's
// example hosts). A bare root domain, a Workers/Pages hosting hostname, or
// anything else that isn't a real "{market}.<base domain>" has no market
// subdomain, hence "default".
//
// landingpagbuild.com (missing the second 'e') is the staging domain the
// Astro site's market pages actually serve on as of Phase 4 (see
// astro/src/lib/marketConfig.ts, which mirrors this list) — added here too
// so a lead submitted from e.g. uk.landingpagbuild.com resolves to market
// "uk" instead of silently falling back to "default".
const BASE_DOMAINS = ['landingpagbuild.com', 'landingpagebuild.com']

function hostFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).host
  } catch {
    return undefined
  }
}

// The real call path this serves is the market landing page's client-side
// JS (LeadForm) fetching THIS Worker's own domain — a cross-origin
// request. On that request, `Host` is this Worker's own hostname, never
// the calling page's; it's `Origin` (and, as a fallback, `Referer`) that
// actually carries the page's domain for a cross-origin browser fetch.
// `Host` is still checked last, for a same-origin or non-browser caller
// with no Origin/Referer at all. Takes candidate hosts in priority order.
function deriveMarketAndSubdomain(candidateHosts: (string | undefined)[]): { market: string; subdomain: string } {
  for (const host of candidateHosts) {
    if (!host) continue
    const base = BASE_DOMAINS.find((b) => host.endsWith(`.${b}`))
    if (!base) continue
    const prefix = host.slice(0, host.length - base.length - 1)
    // A nested prefix (e.g. "staging" is fine, "foo.bar" isn't a market
    // slug) falls back to "default" too, rather than guessing.
    return { market: prefix.includes('.') ? 'default' : prefix, subdomain: host }
  }
  return { market: 'default', subdomain: candidateHosts.find((h) => h) ?? '' }
}

// Phase 5 — fires after the D1 insert via c.executionCtx.waitUntil, so it
// never adds latency to the visitor's response. Reads config:{market} from
// the SAME KV binding the admin panel writes to (`KV`, not a
// STAGING_KV/PROD_KV split that doesn't exist in this codebase — see
// worker/src/routes/admin.ts). Only a minimal local shape is declared
// here rather than importing admin.ts's full MarketConfig, matching how
// other route files don't cross-import each other's KV-read types.
async function sendLeadNotification(
  env: Env,
  leadId: string,
  lead: { name: string; email: string; message: string; aiSummary?: string },
  market: string
): Promise<void> {
  const config = await env.KV.get<{ emailNotifications?: boolean }>(`config:${market}`, 'json')
  if (!config?.emailNotifications) return

  const result = await sendEmail(env.RESEND_API_KEY, {
    to: env.NOTIFICATION_TO_EMAIL,
    replyTo: lead.email || undefined,
    subject: `New lead — ${market.toUpperCase()} market`,
    html: buildLeadEmailHtml(lead, market),
  })

  if (result) {
    await env.DB.prepare('UPDATE leads SET email_sent = 1 WHERE id = ?').bind(leadId).run()
  }
}

// POST /websites/:websiteId/leads — public, no auth required
leads.post('/', async (c) => {
  const websiteId = c.req.param('websiteId') as string

  const website = await c.env.DB.prepare(
    "SELECT id FROM websites WHERE id = ? AND status = 'published'"
  ).bind(websiteId).first()

  if (!website) return err('Website not found', 404)

  const body = await c.req.json<{
    name?: string
    email?: string
    message?: string
    page_id?: string
    metadata?: Record<string, unknown>
    aiSummary?: string
  }>()

  if (!body.email && !body.name) return err('At least a name or email is required', 400)

  const id = generateId()
  const timestamp = now()
  const sourceUrl = c.req.header('Referer') ?? null
  const { market, subdomain } = deriveMarketAndSubdomain([
    hostFromUrl(c.req.header('Origin')),
    hostFromUrl(c.req.header('Referer')),
    c.req.header('Host'),
  ])

  await c.env.DB.prepare(
    `INSERT INTO leads (id, website_id, page_id, market, subdomain, name, email, message, source_url, metadata, ai_summary, submitted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, websiteId,
    body.page_id ?? null,
    market,
    subdomain,
    body.name ?? null,
    body.email ?? null,
    body.message ?? null,
    sourceUrl,
    body.metadata ? JSON.stringify(body.metadata) : null,
    body.aiSummary ?? null,
    timestamp,
    timestamp
  ).run()

  // Respond immediately — the notification runs after, not before.
  c.executionCtx.waitUntil(
    sendLeadNotification(
      c.env,
      id,
      { name: body.name ?? '', email: body.email ?? '', message: body.message ?? '', aiSummary: body.aiSummary },
      market
    )
  )

  return ok({ id, received: true }, 201)
})

// All routes below require auth
leads.use('*', requireAuth)

// GET /websites/:websiteId/leads
leads.get('/', async (c) => {
  const user = c.get('jwtPayload')
  const websiteId = c.req.param('websiteId') as string

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(websiteId)
    .first<{ user_id: string }>()
  if (!website) return err('Website not found', 404)
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return err('Forbidden', 403)

  const { limit, offset } = parsePagination(new URL(c.req.url))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM leads WHERE website_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(websiteId, limit, offset).all()

  return ok(results)
})

// GET /websites/:websiteId/leads/export — CSV download
leads.get('/export', async (c) => {
  const user = c.get('jwtPayload')
  const websiteId = c.req.param('websiteId') as string

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(websiteId)
    .first<{ user_id: string; name: string }>()
  if (!website) return err('Website not found', 404)
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return err('Forbidden', 403)

  const { results } = await c.env.DB.prepare(
    'SELECT id, name, email, message, source_url, created_at FROM leads WHERE website_id = ? ORDER BY created_at DESC'
  ).bind(websiteId).all<{ id: string; name: string; email: string; message: string; source_url: string; created_at: string }>()

  const headers = ['ID', 'Name', 'Email', 'Message', 'Source URL', 'Created At']
  const rows = results.map(r =>
    [r.id, r.name ?? '', r.email ?? '', r.message ?? '', r.source_url ?? '', r.created_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const filename = `leads-${website.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

export default leads
