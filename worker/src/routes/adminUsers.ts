import { Hono } from 'hono'
import type { Env, JwtPayload, UserRole } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'
import { generateId, now } from '../lib/utils'
import { hashPassword } from '../lib/auth'
import { sendEmail } from '../lib/resend'
import { buildWelcomeEmailHtml } from '../lib/emailTemplates'

// Phase 5's brief describes an invite-token flow (inviteToken/inviteLink,
// user_markets, an "accept invitation" link) that doesn't exist anywhere
// in this codebase — checked (grep for invite_token/inviteLink/
// user_markets: nothing) before writing this. POST /api/admin/users
// creates the account with a password directly, set by the super_admin
// who created it; there's no token to email. Sends a welcome/notice email
// instead, pointing at the admin panel — never the password itself.
const ADMIN_PANEL_URL = 'https://landingpagebuild-admin-staging.pages.dev'

async function sendWelcomeEmail(env: Env, opts: { to: string; role: UserRole }): Promise<void> {
  await sendEmail(env.RESEND_API_KEY, {
    to: opts.to,
    subject: 'You have been added to LandingPageBuild',
    html: buildWelcomeEmailHtml({ role: opts.role, adminPanelUrl: ADMIN_PANEL_URL }),
  })
}

// ── Phase 3 Part 4 — User management ──────────────────────────────────────────
//
// Replaces the manual `wrangler d1 execute ... UPDATE users SET role =
// 'super_admin'` dance that every admin test account up to this point has
// needed — there was no other way to make someone a super_admin. Own file
// rather than more routes bolted onto admin.ts, which already covers
// markets/config/versions/clone/rollback/leads.
//
// Account/role bookkeeping only: this does not change what a role is
// actually authorized to do anywhere else in the app, and there's no
// DELETE here on purpose — websites.user_id (and everything hanging off
// it: pages, versions, leads, collaborators, subscriptions, ai_usage) has
// no ON DELETE behavior in schema/schema.sql, so deleting a user with
// existing websites would orphan real data. That's a soft-delete or
// cascade/reassignment story for a later pass, not this one.

const adminUsers = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

adminUsers.use('*', requireSuperAdmin)

const VALID_ROLES: UserRole[] = ['super_admin', 'client_admin', 'viewer']

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (VALID_ROLES as string[]).includes(role)
}

interface UserRow {
  id: string
  email: string
  name: string | null
  role: UserRole
  created_at: string
}

// GET /api/admin/users
adminUsers.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC'
  ).all<UserRow>()
  return c.json({ users: results })
})

// PATCH /api/admin/users/:id/role
adminUsers.patch('/:id/role', async (c) => {
  const id = c.req.param('id')

  let body: { role?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!isValidRole(body.role)) {
    return c.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, 400)
  }

  const jwt = c.get('jwtPayload')
  if (id === jwt.sub) {
    return c.json({ error: 'You cannot change your own role. Ask another super_admin to do it.' }, 403)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'User not found' }, 404)

  const timestamp = now()
  await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind(body.role, timestamp, id)
    .run()

  const user = await c.env.DB.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>()

  return c.json({ success: true, user })
})

// POST /api/admin/users
adminUsers.post('/', async (c) => {
  let body: { email?: string; password?: string; name?: string; role?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }
  const role: UserRole = body.role !== undefined ? (body.role as UserRole) : 'client_admin'
  if (!isValidRole(role)) {
    return c.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, 400)
  }

  const normalizedEmail = body.email.toLowerCase()
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(normalizedEmail)
    .first()
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const id = generateId()
  const timestamp = now()

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, normalizedEmail, body.name ?? null, role, timestamp, timestamp).run()

  const passwordHash = await hashPassword(body.password, normalizedEmail)
  await c.env.SESSIONS.put(`pw:${id}`, passwordHash)

  // Non-blocking — a Resend outage must not fail account creation.
  c.executionCtx.waitUntil(sendWelcomeEmail(c.env, { to: normalizedEmail, role }))

  const user: UserRow = { id, email: normalizedEmail, name: body.name ?? null, role, created_at: timestamp }
  return c.json({ success: true, user }, 201)
})

export default adminUsers
