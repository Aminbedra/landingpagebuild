import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now, parsePagination } from '../lib/utils'

const websites = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

websites.use('*', requireAuth)

// GET /websites — list all websites for current user
websites.get('/', async (c) => {
  const user = c.get('jwtPayload')
  const { limit, offset } = parsePagination(new URL(c.req.url))

  const query = user.role === 'super_admin'
    ? c.env.DB.prepare('SELECT * FROM websites ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset)
    : c.env.DB.prepare('SELECT * FROM websites WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.sub, limit, offset)

  const { results } = await query.all()
  return ok(results)
})

// POST /websites — create a new website
websites.post('/', async (c) => {
  const user = c.get('jwtPayload')
  const body = await c.req.json<{ name: string; description?: string }>()

  if (!body.name?.trim()) return err('Website name is required', 400)

  const id = generateId()
  const timestamp = now()
  // Subdomain: slugify the name + short unique suffix
  const subdomain = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + '-' + id.slice(0, 6)

  await c.env.DB.prepare(
    `INSERT INTO websites (id, user_id, name, description, status, plan, subdomain, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', 'free', ?, ?, ?)`
  ).bind(id, user.sub, body.name.trim(), body.description ?? null, subdomain, timestamp, timestamp).run()

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first()
  return ok(website, 201)
})

// GET /websites/:id
websites.get('/:id', async (c) => {
  const user = c.get('jwtPayload')
  const { id } = c.req.param()

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first()
  if (!website) return err('Website not found', 404)

  // Only owner or super_admin can access
  if (user.role !== 'super_admin' && (website as { user_id: string }).user_id !== user.sub) {
    return err('Forbidden', 403)
  }

  return ok(website)
})

// PATCH /websites/:id — update name, description, status
websites.patch('/:id', async (c) => {
  const user = c.get('jwtPayload')
  const { id } = c.req.param()
  const body = await c.req.json<{ name?: string; description?: string; status?: string }>()

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first<{ user_id: string }>()
  if (!website) return err('Website not found', 404)
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return err('Forbidden', 403)

  const fields: string[] = []
  const values: unknown[] = []

  if (body.name) { fields.push('name = ?'); values.push(body.name.trim()) }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description) }
  if (body.status) { fields.push('status = ?'); values.push(body.status) }
  fields.push('updated_at = ?'); values.push(now())
  values.push(id)

  await c.env.DB.prepare(
    `UPDATE websites SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  const updated = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first()
  return ok(updated)
})

// DELETE /websites/:id — soft delete by archiving
websites.delete('/:id', async (c) => {
  const user = c.get('jwtPayload')
  const { id } = c.req.param()

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first<{ user_id: string }>()
  if (!website) return err('Website not found', 404)
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return err('Forbidden', 403)

  await c.env.DB.prepare(
    "UPDATE websites SET status = 'archived', updated_at = ? WHERE id = ?"
  ).bind(now(), id).run()

  return ok({ id, status: 'archived' })
})

// POST /websites/:id/clone — duplicate a website and all its pages
websites.post('/:id/clone', async (c) => {
  const user = c.get('jwtPayload')
  const { id } = c.req.param()

  const website = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(id).first<{
    user_id: string; name: string; description: string | null
  }>()
  if (!website) return err('Website not found', 404)
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return err('Forbidden', 403)

  const newId = generateId()
  const timestamp = now()
  const newSubdomain = website.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40) + '-' + newId.slice(0, 6)

  await c.env.DB.prepare(
    `INSERT INTO websites (id, user_id, name, description, status, plan, subdomain, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', 'free', ?, ?, ?)`
  ).bind(newId, user.sub, `${website.name} (copy)`, website.description, newSubdomain, timestamp, timestamp).run()

  // Clone all pages
  const { results: pages } = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE website_id = ?'
  ).bind(id).all<{ id: string; name: string; slug: string; content: string | null; sort_order: number }>()

  for (const page of pages) {
    await c.env.DB.prepare(
      `INSERT INTO pages (id, website_id, name, slug, content, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(generateId(), newId, page.name, page.slug, page.content, page.sort_order, timestamp, timestamp).run()
  }

  const cloned = await c.env.DB.prepare('SELECT * FROM websites WHERE id = ?').bind(newId).first()
  return ok(cloned, 201)
})

export default websites
