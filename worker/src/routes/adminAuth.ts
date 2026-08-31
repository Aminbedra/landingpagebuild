import { Hono } from 'hono'
import type { Env } from '../types'
import { signJwt, verifyCredentials, ADMIN_TOKEN_TTL_SECONDS } from '../lib/auth'

// Deliberately a separate router from routes/admin.ts, which applies
// requireSuperAdmin to '*' — this one route can't sit behind that (nothing
// would ever be able to log in). Mounted before adminRoutes in index.ts so
// POST /api/admin/login is matched here first; see the routing-order note
// there and the identical existing pattern for leadRoutes/websiteRoutes.
const adminAuth = new Hono<{ Bindings: Env }>()

// POST /api/admin/login — separate from the general /auth/login: issues a
// short-lived (30 min) token scoped to the admin panel instead of the
// general app's 7-day one, and rejects non-super_admin accounts outright
// rather than letting them mint an admin session token at all. The panel
// keeps a live session alive via POST /api/admin/refresh while it's
// actually in use (see admin/src/components/admin/useIdleSessionRefresh.ts)
// and lets it lapse if left idle.
adminAuth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null)
  if (!body?.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = await verifyCredentials(c.env, body.email, body.password)
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)
  if (user.role !== 'super_admin') {
    return c.json({ error: 'This account does not have admin access.' }, 403)
  }

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET,
    ADMIN_TOKEN_TTL_SECONDS
  )
  return c.json({ token, user })
})

export default adminAuth
