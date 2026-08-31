import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import type { AppContext } from '../middleware/requireAuth'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now } from '../lib/utils'

const pages = new Hono<AppContext>()

pages.use('*', requireAuth)

// Helper — verify website ownership before any page operation
async function ownedWebsite(env: Env, user: JwtPayload, websiteId: string) {
  const website = await env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(websiteId)
    .first<{ user_id: string }>()
  if (!website) return null
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return null
  return website
}

// GET /websites/:websiteId/pages
pages.get('/', async (c) => {
  const websiteId = c.req.param('websiteId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE website_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(websiteId).all()

  return ok(results)
})

// POST /websites/:websiteId/pages
pages.post('/', async (c) => {
  const websiteId = c.req.param('websiteId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const body = await c.req.json<{ name: string; slug?: string; content?: string; sort_order?: number }>()
  if (!body.name?.trim()) return err('Page name is required', 400)

  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = generateId()
  const timestamp = now()

  const last = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM pages WHERE website_id = ?'
  ).bind(websiteId).first<{ max_order: number | null }>()
  const sortOrder = body.sort_order ?? ((last?.max_order ?? -1) + 1)

  await c.env.DB.prepare(
    `INSERT INTO pages (id, website_id, name, slug, content, is_published, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(id, websiteId, body.name.trim(), slug, body.content ?? null, sortOrder, timestamp, timestamp).run()

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first()
  return ok(page, 201)
})

// GET /websites/:websiteId/pages/:pageId
pages.get('/:pageId', async (c) => {
  const websiteId = c.req.param('websiteId') as string; const pageId = c.req.param('pageId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const page = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE id = ? AND website_id = ?'
  ).bind(pageId, websiteId).first()

  if (!page) return err('Page not found', 404)
  return ok(page)
})

// PATCH /websites/:websiteId/pages/:pageId
pages.patch('/:pageId', async (c) => {
  const websiteId = c.req.param('websiteId') as string; const pageId = c.req.param('pageId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const body = await c.req.json<{ name?: string; content?: string; is_published?: boolean; sort_order?: number }>()

  const fields: string[] = []
  const values: unknown[] = []

  if (body.name) { fields.push('name = ?'); values.push(body.name.trim()) }
  if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content) }
  if (body.is_published !== undefined) { fields.push('is_published = ?'); values.push(body.is_published ? 1 : 0) }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order) }

  if (fields.length === 0) return err('No fields to update', 400)

  fields.push('updated_at = ?'); values.push(now())
  values.push(pageId, websiteId)

  await c.env.DB.prepare(
    `UPDATE pages SET ${fields.join(', ')} WHERE id = ? AND website_id = ?`
  ).bind(...values).run()

  const updated = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first()
  return ok(updated)
})

// DELETE /websites/:websiteId/pages/:pageId
pages.delete('/:pageId', async (c) => {
  const websiteId = c.req.param('websiteId') as string; const pageId = c.req.param('pageId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  await c.env.DB.prepare('DELETE FROM pages WHERE id = ? AND website_id = ?').bind(pageId, websiteId).run()
  return ok({ id: pageId, deleted: true })
})

export default pages
