import { Hono } from 'hono'

import type { AppContext } from '../middleware/requireAuth'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now, parsePagination } from '../lib/utils'

const leads = new Hono<AppContext>()

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
  }>()

  if (!body.email && !body.name) return err('At least a name or email is required', 400)

  const id = generateId()
  const timestamp = now()
  const sourceUrl = c.req.header('Referer') ?? null

  await c.env.DB.prepare(
    `INSERT INTO leads (id, website_id, page_id, name, email, message, source_url, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, websiteId,
    body.page_id ?? null,
    body.name ?? null,
    body.email ?? null,
    body.message ?? null,
    sourceUrl,
    body.metadata ? JSON.stringify(body.metadata) : null,
    timestamp
  ).run()

  await c.env.KV.put(
    `lead:${websiteId}:${id}`,
    JSON.stringify({ id, name: body.name, email: body.email, created_at: timestamp }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  )

  // Phase 5: Resend email notification goes here

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
