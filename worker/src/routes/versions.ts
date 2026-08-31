import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import type { AppContext } from '../middleware/requireAuth'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now } from '../lib/utils'

const versions = new Hono<AppContext>()

versions.use('*', requireAuth)

export async function createSnapshot(db: D1Database, websiteId: string, label?: string): Promise<string> {
  const website = await db.prepare('SELECT * FROM websites WHERE id = ?').bind(websiteId).first()
  const { results: pages } = await db.prepare('SELECT * FROM pages WHERE website_id = ?').bind(websiteId).all()

  const snapshot = JSON.stringify({ website, pages, snapshotAt: now() })
  const id = generateId()

  await db.prepare(
    `INSERT INTO versions (id, website_id, page_id, snapshot, label, created_at)
     VALUES (?, ?, null, ?, ?, ?)`
  ).bind(id, websiteId, snapshot, label ?? null, now()).run()

  return id
}

async function ownedWebsite(env: Env, user: JwtPayload, websiteId: string) {
  const website = await env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(websiteId)
    .first<{ user_id: string }>()
  if (!website) return null
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return null
  return website
}

// GET /websites/:websiteId/versions
versions.get('/', async (c) => {
  const websiteId = c.req.param('websiteId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const { results } = await c.env.DB.prepare(
    'SELECT id, website_id, label, created_at FROM versions WHERE website_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(websiteId).all()

  return ok(results)
})

// POST /websites/:websiteId/versions
versions.post('/', async (c) => {
  const websiteId = c.req.param('websiteId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const body = await c.req.json<{ label?: string }>()
  const id = await createSnapshot(c.env.DB, websiteId, body.label)
  return ok({ id, saved: true }, 201)
})

// GET /websites/:websiteId/versions/:versionId
versions.get('/:versionId', async (c) => {
  const websiteId = c.req.param('websiteId') as string; const versionId = c.req.param('versionId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const version = await c.env.DB.prepare(
    'SELECT * FROM versions WHERE id = ? AND website_id = ?'
  ).bind(versionId, websiteId).first<{ snapshot: string }>()

  if (!version) return err('Version not found', 404)
  return ok({ ...version, snapshot: JSON.parse(version.snapshot) })
})

// POST /websites/:websiteId/versions/:versionId/rollback
versions.post('/:versionId/rollback', async (c) => {
  const websiteId = c.req.param('websiteId') as string; const versionId = c.req.param('versionId') as string
  const user = c.get('jwtPayload')
  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const version = await c.env.DB.prepare(
    'SELECT * FROM versions WHERE id = ? AND website_id = ?'
  ).bind(versionId, websiteId).first<{ snapshot: string }>()

  if (!version) return err('Version not found', 404)

  // Auto-save current state before rolling back
  await createSnapshot(c.env.DB, websiteId, 'Auto-save before rollback')

  const { pages } = JSON.parse(version.snapshot) as {
    pages: Array<{ id: string; name: string; slug: string; content: string; is_published: number; sort_order: number }>
  }

  const timestamp = now()
  await c.env.DB.prepare('DELETE FROM pages WHERE website_id = ?').bind(websiteId).run()

  for (const page of pages) {
    await c.env.DB.prepare(
      `INSERT INTO pages (id, website_id, name, slug, content, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(page.id, websiteId, page.name, page.slug, page.content, page.is_published, page.sort_order, timestamp, timestamp).run()
  }

  await c.env.DB.prepare("UPDATE websites SET updated_at = ? WHERE id = ?").bind(timestamp, websiteId).run()
  return ok({ rolled_back_to: versionId, timestamp })
})

export default versions
