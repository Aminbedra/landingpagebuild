import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'

// ── Phase 6 — Media Library (R2) ──────────────────────────────────────────────
//
// Flat bucket, no folders/tagging (explicitly out of scope). Mounted at
// /api/admin/media, before admin.ts's broader /api/admin mount — same
// ordering reasoning as adminUsersRoutes: admin.ts applies requireSuperAdmin
// to '*' at that broader prefix, so a more specific mount needs to come
// first. Doesn't matter for auth here (every protected route below also
// applies requireSuperAdmin itself), but /serve/:key MUST stay reachable
// with zero auth — it's what the public landing page's <img> tags hit —
// and mounting order is what guarantees admin.ts's middleware never gets a
// chance to intercept it.
//
// Auth: the brief asks for tiered access (client_admin: upload/set-hero on
// their own markets, no delete; viewer: read-only) — that doesn't exist
// anywhere in this app to build on. There's no user_markets table (no
// per-market assignment concept at all), and every other admin surface
// (config, leads, versions, users, even POST /api/admin/login itself) is
// already requireSuperAdmin-only — client_admin/viewer accounts cannot
// authenticate into the admin panel at all today. Gating Media the same
// way everything else already is (super_admin-only) is the only option
// that's actually reachable; a "tiered" media API no client_admin/viewer
// could ever call would just be unreachable code pretending to be a
// feature. Real tiering is a bigger, separate change to the admin panel's
// whole access model, not something to bolt on quietly here.

const media = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface MediaObject {
  key: string
  size: number
  uploaded: string
  originalName: string
  contentType: string
  url: string
}

function serveUrl(c: { req: { url: string } }, key: string): string {
  // Same Worker serves the API and the media proxy — build the URL off the
  // actual request origin rather than hardcoding a domain, so this is
  // correct on staging (*.workers.dev today, landingpagbuild.com's Worker
  // origin once that's wired) and production without a code change.
  return `${new URL(c.req.url).origin}/api/admin/media/serve/${key}`
}

// POST /api/admin/media — upload
media.post('/', requireSuperAdmin, async (c) => {
  const formData = await c.req.formData()
  // FormData.get() type-checks as returning only `string | null` here —
  // this project has no DOM lib, and @cloudflare/workers-types doesn't
  // declare FormDataEntryValue/File as a value in its place, even though
  // the Workers runtime genuinely does hand back a File at runtime for a
  // multipart file field. Cast to the minimal shape actually used below
  // rather than fight the type declarations for something the runtime
  // unambiguously supports.
  const entry = formData.get('file')
  const file = entry as unknown as
    | { type: string; size: number; name: string; stream: () => ReadableStream }
    | null

  if (!file || typeof file === 'string' || typeof file.stream !== 'function') {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'File type not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG' }, 400)
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large. Maximum size is 5MB' }, 400)
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined
  const key = ext ? `${crypto.randomUUID()}.${ext}` : crypto.randomUUID()

  await c.env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
  })

  return c.json({ key, url: serveUrl(c, key), name: file.name, size: file.size, type: file.type }, 201)
})

// GET /api/admin/media — list
media.get('/', requireSuperAdmin, async (c) => {
  const listed = await c.env.MEDIA_BUCKET.list()

  const objects: MediaObject[] = await Promise.all(
    listed.objects.map(async (obj) => {
      const head = await c.env.MEDIA_BUCKET.head(obj.key)
      return {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        originalName: head?.customMetadata?.originalName ?? obj.key,
        contentType: head?.httpMetadata?.contentType ?? 'application/octet-stream',
        url: serveUrl(c, obj.key),
      }
    })
  )

  // Newest first — R2 list() doesn't sort by upload time itself.
  objects.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1))

  return c.json({ objects })
})

// DELETE /api/admin/media/:key
media.delete('/:key', requireSuperAdmin, async (c) => {
  const key = c.req.param('key')
  if (!key) return c.json({ error: 'Missing key' }, 400)
  await c.env.MEDIA_BUCKET.delete(key)
  return c.json({ success: true })
})

// GET /api/admin/media/serve/:key — public, no auth. Landing pages load
// images from here directly.
media.get('/serve/:key', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.MEDIA_BUCKET.get(key)

  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
})

export default media
