import type { Env, JwtPayload, UserRole } from '../types'

// Think of JWT like a sealed envelope — anyone can read the address (payload)
// but only the post office (server with the secret) can verify the seal is real.

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' }
const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days — general app sessions (/auth/login, /auth/register)

// Admin panel tokens (/api/admin/login, /api/admin/refresh) are much
// shorter-lived — the panel keeps a live session alive with a silent
// refresh while it's actually in use, and lets it lapse if left idle.
// See admin/src/components/admin/useIdleSessionRefresh.ts.
export const ADMIN_TOKEN_TTL_SECONDS = 30 * 60 // 30 minutes

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input)
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    '='
  )
  return atob(padded)
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify']
  )
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expirySeconds: number = DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expirySeconds,
    })
  )
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign(
    ALGORITHM,
    key,
    new TextEncoder().encode(`${header}.${body}`)
  )
  return `${header}.${body}.${base64url(sig)}`
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const [header, body, signature] = token.split('.')
    if (!header || !body || !signature) return null

    const key = await importKey(secret)
    const valid = await crypto.subtle.verify(
      ALGORITHM,
      key,
      Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c =>
        c.charCodeAt(0)
      ),
      new TextEncoder().encode(`${header}.${body}`)
    )
    if (!valid) return null

    const payload: JwtPayload = JSON.parse(base64urlDecode(body))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  role: UserRole
}

// Shared by /auth/register, /auth/login, and POST /api/admin/users
// (routes/adminUsers.ts) so there's one password-hashing implementation
// instead of three. Always normalizes the email first — register used to
// hash against the raw (possibly mixed-case) email while login/
// verifyCredentials hashed against the lowercased one, which would have
// silently broken login for any account registered with a mixed-case
// email. Fixed by consolidating here.
export async function hashPassword(password: string, email: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password + email.toLowerCase())
  )
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyCredentials(
  env: Env,
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.toLowerCase()

  const user = await env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE email = ?'
  ).bind(normalizedEmail).first<AuthenticatedUser>()
  if (!user) return null

  const passwordHash = await hashPassword(password, normalizedEmail)
  const storedHash = await env.SESSIONS.get(`pw:${user.id}`)
  if (storedHash !== passwordHash) return null

  return user
}
