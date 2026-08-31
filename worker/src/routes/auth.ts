import { Hono } from 'hono'
import type { Env } from '../types'
import { signJwt, verifyJwt, extractToken, verifyCredentials } from '../lib/auth'
import { generateId, ok, err, now } from '../lib/utils'

const auth = new Hono<{ Bindings: Env }>()

// POST /auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json<{ email: string; name?: string; password: string }>()

  if (!body.email || !body.password) {
    return err('Email and password are required', 400)
  }

  // Check existing user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first()

  if (existing) return err('Email already registered', 409)

  // Hash password — using SHA-256 for now, upgrade to bcrypt via external API in prod
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body.password + body.email)
  )
  const passwordHash = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const id = generateId()
  const timestamp = now()

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, 'client_admin', ?, ?)`
  ).bind(id, body.email.toLowerCase(), body.name ?? null, timestamp, timestamp).run()

  // Store password hash in KV (keeps D1 schema clean)
  await c.env.SESSIONS.put(`pw:${id}`, passwordHash)

  const token = await signJwt(
    { sub: id, email: body.email.toLowerCase(), role: 'client_admin' },
    c.env.JWT_SECRET
  )

  return ok({ token, user: { id, email: body.email.toLowerCase(), name: body.name ?? null, role: 'client_admin' } }, 201)
})

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()

  if (!body.email || !body.password) {
    return err('Email and password are required', 400)
  }

  const user = await verifyCredentials(c.env, body.email, body.password)
  if (!user) return err('Invalid credentials', 401)

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role as 'client_admin' | 'super_admin' | 'viewer' },
    c.env.JWT_SECRET
  )

  return ok({ token, user })
})

// GET /auth/me
auth.get('/me', async (c) => {
  const token = extractToken(c.req.raw)
  if (!token) return err('Unauthorized', 401)

  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return err('Invalid or expired token', 401)

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, created_at FROM users WHERE id = ?'
  ).bind(payload.sub).first()

  if (!user) return err('User not found', 404)

  return ok(user)
})

export default auth
