import type { JwtPayload } from '../types'

// Think of JWT like a sealed envelope — anyone can read the address (payload)
// but only the post office (server with the secret) can verify the seal is real.

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' }
const EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days

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
  secret: string
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
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
