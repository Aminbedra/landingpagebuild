import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'
import { signJwt, ADMIN_TOKEN_TTL_SECONDS } from '../lib/auth'

// ── Phase 3 Part 1 — Admin panel: market copy config ─────────────────────────
//
// This is a flat, KV-backed store keyed by market slug (uk/de/fr/...) — it is
// intentionally independent of the D1 website/page/user model used by
// /websites elsewhere in this Worker. See README "KV Data Architecture" for
// the key schema. Auth: reuses the existing internal JWT (requireSuperAdmin),
// not Cloudflare Access — no Access application is provisioned for this repo.
// Login itself lives in routes/adminAuth.ts, a separate unprotected router —
// everything in *this* file, refresh included, requires an already-valid
// admin token.
//
// Phase 4 (not this session): add a `marketSlug` column to `websites` in D1
// so a market can resolve to an owning website, and the Worker can derive
// these KV keys from that instead of a bare slug. Until then, markets are
// standalone KV entries with no D1 relation.
//
// Phase 3 Part 3 — leads:{market}:{timestamp} below is a SEPARATE KV store
// from the real, already-working lead-capture pipeline: POST
// /websites/:websiteId/leads (routes/leads.ts) writes to D1's `leads` table
// (keyed by website_id, with its own GET/export endpoints), and stashes an
// unrelated denormalized copy at `lead:{websiteId}:{id}` (singular, 30-day
// TTL) for something else entirely. Nothing in this codebase writes
// `leads:{market}:{timestamp}` — the Part 3 brief's claim that Phase 2
// already does is incorrect. Built here exactly as specified anyway,
// consistent with how `config`/`versions` above are their own standalone
// KV universe: seeded directly (scripts/seed-admin-kv.sh), read-only from
// the Worker's side, no capture endpoint. Reconcile with the D1 leads
// table only if/when Phase 4's marketSlug work above actually happens.

const admin = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

admin.use('*', requireSuperAdmin)

// POST /api/admin/refresh — reissues a fresh 30-minute token for the
// caller's own identity, sliding the session forward. Requires an
// already-valid token (this route sits behind requireSuperAdmin above like
// everything else here): it extends a live session, it can't resurrect an
// expired one — that's the point, see useIdleSessionRefresh.ts.
admin.post('/refresh', async (c) => {
  const jwt = c.get('jwtPayload')
  const token = await signJwt(
    { sub: jwt.sub, email: jwt.email, role: jwt.role },
    c.env.JWT_SECRET,
    ADMIN_TOKEN_TTL_SECONDS
  )
  return c.json({ token })
})

export interface MarketConfig {
  market: string
  headline: string
  subheadline: string
  body: string
  ctaText: string
  ctaUrl: string
  aiEnabled: boolean
  emailNotifications: boolean
  updatedAt: string
  updatedBy: string
  // Set only by POST /config/:market/rollback (Phase 3 Part 2) — the
  // timestamp of the version it was restored from. Not one of the
  // PUT-editable fields, so a normal save just carries it forward unchanged.
  restoredFrom?: string
}

const MARKET_SLUG_RE = /^[a-z0-9-]+$/

type MarketConfigPatch = Partial<
  Pick<
    MarketConfig,
    'headline' | 'subheadline' | 'body' | 'ctaText' | 'ctaUrl' | 'aiEnabled' | 'emailNotifications'
  >
>

const MARKETS_INDEX_KEY = 'markets:index'
const configKey = (market: string) => `config:${market}`
const versionPrefix = (market: string) => `versions:${market}:`

// GET /api/admin/markets
admin.get('/markets', async (c) => {
  const markets = (await c.env.KV.get<string[]>(MARKETS_INDEX_KEY, 'json')) ?? []
  return c.json({ markets })
})

// GET /api/admin/config/:market
admin.get('/config/:market', async (c) => {
  const market = c.req.param('market')
  const config = await c.env.KV.get<MarketConfig>(configKey(market), 'json')
  if (!config) return c.json({ error: 'Market not found' }, 404)
  return c.json(config)
})

// PUT /api/admin/config/:market
admin.put('/config/:market', async (c) => {
  const market = c.req.param('market')

  let body: MarketConfigPatch
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Whitelist editable fields — the client must never be able to set
  // `market`, `updatedAt`, or `updatedBy` directly via the request body.
  const patch: MarketConfigPatch = {}
  if (typeof body.headline === 'string') patch.headline = body.headline
  if (typeof body.subheadline === 'string') patch.subheadline = body.subheadline
  if (typeof body.body === 'string') patch.body = body.body
  if (typeof body.ctaText === 'string') patch.ctaText = body.ctaText
  if (typeof body.ctaUrl === 'string') patch.ctaUrl = body.ctaUrl
  if (typeof body.aiEnabled === 'boolean') patch.aiEnabled = body.aiEnabled
  if (typeof body.emailNotifications === 'boolean') patch.emailNotifications = body.emailNotifications

  const existing = (await c.env.KV.get<MarketConfig>(configKey(market), 'json')) ?? {}
  const jwt = c.get('jwtPayload')

  const merged: MarketConfig = {
    headline: '',
    subheadline: '',
    body: '',
    ctaText: '',
    ctaUrl: '',
    aiEnabled: false,
    emailNotifications: false,
    ...existing,
    ...patch,
    market,
    updatedAt: new Date().toISOString(),
    updatedBy: jwt.email,
  }

  await c.env.KV.put(configKey(market), JSON.stringify(merged))
  // Auto-snapshot: every save writes a version even when nothing meaningful
  // changed — cheap, and keeps the history trustworthy for Part 4 later.
  await c.env.KV.put(`${versionPrefix(market)}${Date.now()}`, JSON.stringify(merged))

  return c.json({ success: true, config: merged })
})

// GET /api/admin/config/:market/versions
admin.get('/config/:market/versions', async (c) => {
  const market = c.req.param('market')
  const prefix = versionPrefix(market)
  const list = await c.env.KV.list({ prefix })

  const sorted = list.keys
    .map((k) => ({ key: k.name, timestamp: Number(k.name.slice(prefix.length)) }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)

  // Part 2's VersionHistoryPanel shows "updated by" per row in the
  // collapsed list, not just the expanded preview — that needs each
  // snapshot's body, not just its key. Parallelized, so this stays one
  // round-trip's worth of latency regardless of how many entries there are.
  const versions = await Promise.all(
    sorted.map(async (v) => {
      const snapshot = await c.env.KV.get<MarketConfig>(v.key, 'json')
      return { ...v, updatedBy: snapshot?.updatedBy ?? 'unknown' }
    })
  )

  return c.json({ versions })
})

// GET /api/admin/config/:market/versions/:timestamp
admin.get('/config/:market/versions/:timestamp', async (c) => {
  const market = c.req.param('market')
  const timestamp = c.req.param('timestamp')
  const config = await c.env.KV.get<MarketConfig>(`${versionPrefix(market)}${timestamp}`, 'json')
  if (!config) return c.json({ error: 'Version not found' }, 404)
  return c.json(config)
})

// POST /api/admin/config/:market/clone
admin.post('/config/:market/clone', async (c) => {
  const sourceMarket = c.req.param('market')

  let body: { targetMarket?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const targetMarket = body.targetMarket ?? ''
  if (!MARKET_SLUG_RE.test(targetMarket)) {
    return c.json({ error: 'Invalid market slug. Use lowercase letters, numbers, and hyphens only.' }, 400)
  }

  const sourceConfig = await c.env.KV.get<MarketConfig>(configKey(sourceMarket), 'json')
  if (!sourceConfig) return c.json({ error: 'Market not found' }, 404)

  const index = (await c.env.KV.get<string[]>(MARKETS_INDEX_KEY, 'json')) ?? []
  if (index.includes(targetMarket)) {
    return c.json({ error: `Market '${targetMarket}' already exists.` }, 409)
  }

  const jwt = c.get('jwtPayload')
  const cloned: MarketConfig = {
    ...sourceConfig,
    market: targetMarket,
    updatedAt: new Date().toISOString(),
    updatedBy: jwt.email,
  }

  await c.env.KV.put(configKey(targetMarket), JSON.stringify(cloned))
  await c.env.KV.put(MARKETS_INDEX_KEY, JSON.stringify([...index, targetMarket]))
  // Initial snapshot for the new market, same "every save gets a version"
  // convention the PUT handler follows above.
  await c.env.KV.put(`${versionPrefix(targetMarket)}${Date.now()}`, JSON.stringify(cloned))

  return c.json({ success: true, config: cloned })
})

// POST /api/admin/config/:market/rollback
admin.post('/config/:market/rollback', async (c) => {
  const market = c.req.param('market')

  let body: { timestamp?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  if (!body.timestamp) return c.json({ error: 'timestamp is required' }, 400)

  const versionConfig = await c.env.KV.get<MarketConfig>(
    `${versionPrefix(market)}${body.timestamp}`,
    'json'
  )
  if (!versionConfig) return c.json({ error: 'Version not found' }, 404)

  // Snapshot the pre-rollback state before overwriting it — like an undo
  // stack: rolling back to an old version creates a brand-new version
  // first, so the rollback itself can always be undone by rolling back
  // again. Skipped only if there's no current config at all to preserve
  // (a market with version history but a since-deleted current config —
  // not a reason to fail the rollback).
  const currentConfig = await c.env.KV.get<MarketConfig>(configKey(market), 'json')
  if (currentConfig) {
    await c.env.KV.put(`${versionPrefix(market)}${Date.now()}`, JSON.stringify(currentConfig))
  }

  const jwt = c.get('jwtPayload')
  const restored: MarketConfig = {
    ...versionConfig,
    market,
    updatedAt: new Date().toISOString(),
    updatedBy: jwt.email,
    restoredFrom: body.timestamp,
  }

  await c.env.KV.put(configKey(market), JSON.stringify(restored))

  return c.json({ success: true, config: restored })
})

// ── Phase 3 Part 3 — Leads dashboard ──────────────────────────────────────────

export interface LeadRecord {
  name: string
  email: string
  message: string
  market: string
  subdomain: string
  submittedAt: string
  aiSummary?: string
}

export interface Lead extends LeadRecord {
  id: string
}

const LEAD_CSV_HEADERS = ['id', 'name', 'email', 'message', 'market', 'subdomain', 'submittedAt', 'aiSummary'] as const

const leadPrefix = (market: string) => `leads:${market}:`

function leadTimestamp(id: string, prefix: string): number {
  return Number(id.slice(prefix.length))
}

async function fetchLead(kv: KVNamespace, key: string): Promise<Lead | null> {
  const record = await kv.get<LeadRecord>(key, 'json')
  return record ? { ...record, id: key } : null
}

function sortLeadsNewestFirst(leads: Lead[], prefix: string): Lead[] {
  // Sort by the timestamp embedded in the KV key, not the record's own
  // `submittedAt` — the key is what the Worker actually controlled when
  // the lead was written; trusting a client-suppliable field for ordering
  // would let a malformed/spoofed submittedAt jumble the list.
  return [...leads].sort((a, b) => leadTimestamp(b.id, prefix) - leadTimestamp(a.id, prefix))
}

// KV.list() caps at 1000 keys per call regardless of whether a `limit` is
// passed — "count everything" needs to page through cursors, or a market
// with >1000 leads would silently get a wrong (capped) total instead of
// just a slow one. This is the O(n) full-market walk the brief calls out
// as acceptable-for-now-fix-in-Phase-7: correct now, slow later.
async function countLeads(kv: KVNamespace, prefix: string): Promise<number> {
  let count = 0
  let cursor: string | undefined
  for (;;) {
    const page = await kv.list({ prefix, cursor })
    count += page.keys.length
    if (page.list_complete) break
    cursor = page.cursor
  }
  return count
}

// GET /api/admin/leads/:market
admin.get('/leads/:market', async (c) => {
  const market = c.req.param('market')
  const prefix = leadPrefix(market)

  const url = new URL(c.req.url)
  const cursorParam = url.searchParams.get('cursor') ?? undefined
  const limitParam = parseInt(url.searchParams.get('limit') ?? '25', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 25, 1), 100)

  const page = await c.env.KV.list({ prefix, cursor: cursorParam, limit })

  const leads = (
    await Promise.all(page.keys.map((k) => fetchLead(c.env.KV, k.name)))
  ).filter((l): l is Lead => l !== null)

  const total = await countLeads(c.env.KV, prefix)

  return c.json({
    leads: sortLeadsNewestFirst(leads, prefix),
    cursor: page.list_complete ? null : page.cursor,
    total,
  })
})

// GET /api/admin/leads/:market/export
admin.get('/leads/:market/export', async (c) => {
  const market = c.req.param('market')
  const prefix = leadPrefix(market)

  const keys: string[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await c.env.KV.list({ prefix, cursor })
    keys.push(...page.keys.map((k) => k.name))
    if (page.list_complete) break
    cursor = page.cursor
  }

  const leads = sortLeadsNewestFirst(
    (await Promise.all(keys.map((key) => fetchLead(c.env.KV, key)))).filter((l): l is Lead => l !== null),
    prefix
  )

  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = leads.map((lead) =>
    LEAD_CSV_HEADERS.map((h) => escapeCsv((lead as unknown as Record<string, unknown>)[h])).join(',')
  )
  const csv = [LEAD_CSV_HEADERS.join(','), ...rows].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leads-${market}-${date}.csv"`,
    },
  })
})

export default admin
