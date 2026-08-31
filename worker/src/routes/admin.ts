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
}

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

  const versions = list.keys
    .map((k) => ({ key: k.name, timestamp: Number(k.name.slice(prefix.length)) }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)

  return c.json({ versions })
})

export default admin
