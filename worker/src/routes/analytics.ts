import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'

// ── Phase 7 — Native analytics ────────────────────────────────────────────────
//
// Pageviews live in KV under analytics:pageviews:{market}:{date} (written by
// astro/src/pages/index.astro on every non-bot SSR request — see that
// file's comment for why it uses waitUntil() rather than a bare unawaited
// promise). Leads/conversions are already in D1 (worker/migrations/
// 0002_leads_market_schema.sql) — this endpoint just merges the two by
// date, it doesn't store anything new for leads.
//
// Auth: the brief asks for requireAdmin(['super_admin','client_admin'])
// plus per-market scoping "if it exists in the codebase" — it doesn't (see
// worker/src/routes/media.ts's note from Phase 6: no user_markets table,
// no tiering anywhere, client_admin/viewer can't even log into the admin
// panel today). Gated the same way as every other admin endpoint instead:
// requireSuperAdmin.

const analytics = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

analytics.use('*', requireSuperAdmin)

const pageviewKey = (market: string, date: string) => `analytics:pageviews:${market}:${date}`

interface DayEntry {
  date: string
  pageviews: number
  leads: number
  conversionRate: number
}

// GET /api/admin/analytics?market=uk&days=30
analytics.get('/', async (c) => {
  const url = new URL(c.req.url)
  const market = url.searchParams.get('market') ?? 'uk'
  const daysParam = parseInt(url.searchParams.get('days') ?? '30', 10)
  const days = Math.min(Math.max(Number.isFinite(daysParam) ? daysParam : 30, 1), 90)

  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const pageviewEntries = await Promise.all(
    dates.map(async (date) => {
      const val = await c.env.KV.get(pageviewKey(market, date))
      return { date, pageviews: parseInt(val ?? '0', 10) }
    })
  )

  const since = dates[0]
  const leadsResult = await c.env.DB.prepare(
    `SELECT DATE(submitted_at) as date, COUNT(*) as count
     FROM leads
     WHERE market = ? AND DATE(submitted_at) >= ?
     GROUP BY DATE(submitted_at)
     ORDER BY date ASC`
  )
    .bind(market, since)
    .all<{ date: string; count: number }>()

  const leadsMap = new Map<string, number>()
  for (const row of leadsResult.results) {
    leadsMap.set(row.date, row.count)
  }

  const series: DayEntry[] = pageviewEntries.map(({ date, pageviews }) => {
    const leads = leadsMap.get(date) ?? 0
    const conversionRate = pageviews > 0 ? Number(((leads / pageviews) * 100).toFixed(1)) : 0
    return { date, pageviews, leads, conversionRate }
  })

  const totalPageviews = series.reduce((s, r) => s + r.pageviews, 0)
  const totalLeads = series.reduce((s, r) => s + r.leads, 0)
  const overallConversionRate = totalPageviews > 0 ? Number(((totalLeads / totalPageviews) * 100).toFixed(1)) : 0

  return c.json({
    market,
    days,
    series,
    totals: {
      pageviews: totalPageviews,
      leads: totalLeads,
      conversionRate: overallConversionRate,
    },
  })
})

export default analytics
