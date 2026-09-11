import type { Context, Next } from 'hono'
import type { Env, JwtPayload } from '../types'
import { verifyJwt, extractToken } from '../lib/auth'
import { err } from '../lib/utils'

// RETIRED — 2026-09
// AppContext and requireAuth below are part of the multi-tenant website
// builder surface which has been superseded by the market-routing model.
// Do not extend or build on them. Scheduled for deletion in a future
// cleanup pass. See ARCHITECTURE.md for context.
//
// requireSuperAdmin (further down this file) is NOT retired — it gates
// every live /api/admin/* route and stays in active use.
export type AppContext = { Bindings: Env; Variables: { jwtPayload: JwtPayload } }

export async function requireAuth(c: Context<AppContext>, next: Next): Promise<Response | void> {
  const token = extractToken(c.req.raw)
  if (!token) return err('Missing authorization token', 401)

  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return err('Invalid or expired token', 401)

  c.set('jwtPayload', payload)
  await next()
}

export async function requireSuperAdmin(c: Context<AppContext>, next: Next): Promise<Response | void> {
  const token = extractToken(c.req.raw)
  if (!token) return err('Missing authorization token', 401)

  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return err('Invalid or expired token', 401)
  if (payload.role !== 'super_admin') return err('Forbidden', 403)

  c.set('jwtPayload', payload)
  await next()
}
