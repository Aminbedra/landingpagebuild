import type { Context, Next } from 'hono'
import type { Env, JwtPayload } from '../types'
import { verifyJwt, extractToken } from '../lib/auth'
import { err } from '../lib/utils'

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
