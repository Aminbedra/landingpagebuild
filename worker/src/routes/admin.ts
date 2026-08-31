import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'
import { signJwt, ADMIN_TOKEN_TTL_SECONDS } from '../lib/auth'
import { COPY_TEMPLATES } from '../lib/copyTemplates'

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
// Phase 3 Part 3 originally built the leads dashboard below against
// leads:{market}:{timestamp} KV keys — a standalone store, disconnected
// from the real D1 `leads` table that POST /websites/:websiteId/leads
// (routes/leads.ts) already wrote to. A Part 3.5 migration pass
// (worker/migrations/0002_leads_market_schema.sql) consolidated both onto
// that one D1 table — see the comment above the leads routes further down
// for what changed. The KV keys from that original build are unread now
// and left to expire naturally; nothing writes them anymore either.

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
  // Phase 6 — set via the Media Library's "Set as hero" action, which just
  // PUTs here like any other field; no separate endpoint for it.
  heroImageUrl?: string
  // Phase 8 — preset id from worker/src/lib/presets.ts. Absent means
  // 'classic'; resolved by astro/src/lib/presets.ts's getPreset() at SSR
  // time, not stored as a default here.
  stylePreset?: string
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
    | 'headline'
    | 'subheadline'
    | 'body'
    | 'ctaText'
    | 'ctaUrl'
    | 'aiEnabled'
    | 'emailNotifications'
    | 'heroImageUrl'
    | 'stylePreset'
  >
>

const MARKETS_INDEX_KEY = 'markets:index'
const configKey = (market: string) => `config:${market}`
const versionPrefix = (market: string) => `versions:${market}:`

// GET /api/admin/copy-templates — static, no D1/KV read at all. Lives
// alongside the config routes rather than its own file: one tiny
// single-purpose GET didn't earn a dedicated route module the way
// users/media/analytics did.
admin.get('/copy-templates', async (c) => {
  return c.json({ templates: COPY_TEMPLATES })
})

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
  if (typeof body.heroImageUrl === 'string') patch.heroImageUrl = body.heroImageUrl
  if (typeof body.stylePreset === 'string') patch.stylePreset = body.stylePreset

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

// ── Phase 3 Part 3/4 — Leads dashboard ────────────────────────────────────────
//
// Migrated off leads:{market}:{timestamp} KV onto the D1 `leads` table (see
// worker/migrations/0002_leads_market_schema.sql) — D1 supports the
// email_sent/hubspot_synced flags Phase 5 needs and the aggregate queries
// Phase 7 needs without a full-prefix KV scan. The one real lead-capture
// path, POST /websites/:websiteId/leads (routes/leads.ts), now writes here
// directly. Pagination switched from KV cursors to plain LIMIT/OFFSET,
// which changes this endpoint's response shape (cursor -> offset/hasMore) —
// see admin/src/components/admin/useLeads.ts for the matching client update.

interface LeadRow {
  id: string
  market: string | null
  subdomain: string | null
  name: string | null
  email: string | null
  message: string | null
  ai_summary: string | null
  submitted_at: string | null
  created_at: string
}

export interface Lead {
  id: string
  market: string
  subdomain: string
  name: string
  email: string
  message: string
  submittedAt: string
  aiSummary?: string
}

const LEAD_CSV_HEADERS = ['id', 'name', 'email', 'message', 'market', 'subdomain', 'submitted_at', 'ai_summary'] as const

// D1 columns are snake_case; the rest of this API (MarketConfig etc.) is
// camelCase throughout, so map here rather than let snake_case leak into
// the response — keeps the frontend Lead shape from Part 3 unchanged.
function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    market: row.market ?? '',
    subdomain: row.subdomain ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
    message: row.message ?? '',
    submittedAt: row.submitted_at ?? row.created_at,
    aiSummary: row.ai_summary ?? undefined,
  }
}

// GET /api/admin/leads/:market
admin.get('/leads/:market', async (c) => {
  const market = c.req.param('market')
  const url = new URL(c.req.url)

  const limitParam = parseInt(url.searchParams.get('limit') ?? '25', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 25, 1), 100)
  const offsetParam = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const offset = Math.max(Number.isFinite(offsetParam) ? offsetParam : 0, 0)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM leads WHERE market = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?')
      .bind(market, limit, offset)
      .all<LeadRow>(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM leads WHERE market = ?')
      .bind(market)
      .first<{ total: number }>(),
  ])

  const leads = rows.results.map(toLead)
  const total = countRow?.total ?? 0

  return c.json({
    leads,
    total,
    offset,
    limit,
    hasMore: offset + leads.length < total,
  })
})

// GET /api/admin/leads/:market/export
admin.get('/leads/:market/export', async (c) => {
  const market = c.req.param('market')

  const rows = await c.env.DB.prepare('SELECT * FROM leads WHERE market = ? ORDER BY submitted_at DESC')
    .bind(market)
    .all<LeadRow>()

  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csvRows = rows.results.map((row) =>
    LEAD_CSV_HEADERS.map((h) => escapeCsv((row as unknown as Record<string, unknown>)[h])).join(',')
  )
  const csv = [LEAD_CSV_HEADERS.join(','), ...csvRows].join('\r\n')

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
