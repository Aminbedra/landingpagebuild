// Session + fetch helper for the admin panel.
//
// The admin panel's Phase 3 brief originally called for Cloudflare Access
// JWT auth, but no Access application is provisioned for this repo. Instead
// this uses the Worker's internal JWT auth, but with its own short-lived
// token: POST /api/admin/login (worker/src/routes/adminAuth.ts) issues a
// 30-minute token and rejects non-super_admin accounts outright, rather
// than the general app's 7-day /auth/login token. useIdleSessionRefresh.ts
// calls POST /api/admin/refresh to slide that 30 minutes forward while the
// panel is actively used, and lets it lapse — session cleared, back to
// LoginGate — if left idle.

const TOKEN_KEY = 'lpb_admin_token'
const USER_KEY = 'lpb_admin_user'

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
}

type SessionListener = () => void
const listeners = new Set<SessionListener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch {
    return null
  }
}

function setSession(token: string, user: AdminUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Storage unavailable (private mode etc) — session just won't persist
    // across reloads; the in-memory listeners still update this tab.
  }
  notify()
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // ignore
  }
  notify()
}

function getApiUrl(): string {
  return import.meta.env.PUBLIC_WORKER_API_URL
}

// POST /api/admin/login — throws if credentials are wrong or the account
// isn't a super_admin (the Worker itself now enforces that; see
// routes/adminAuth.ts). On success, stores the 30-minute session.
export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${getApiUrl()}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = (await res.json()) as { token: string; user: AdminUser } | { error: string }

  if (!res.ok || !('token' in json)) {
    throw new Error('error' in json ? json.error : `Login failed (${res.status})`)
  }

  setSession(json.token, json.user)
  return json.user
}

// POST /api/admin/refresh — slides the current session's expiry forward by
// another 30 minutes without the user re-entering credentials. Called only
// while useIdleSessionRefresh.ts considers the panel actively in use.
// Returns false (and, on an outright 401, clears the session) rather than
// throwing — a transient failure here shouldn't interrupt whatever the user
// is doing; the next tick just tries again.
export async function refreshSession(): Promise<boolean> {
  const token = getToken()
  const user = getStoredUser()
  if (!token || !user) return false

  const res = await fetch(`${getApiUrl()}/api/admin/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearSession()
    return false
  }
  if (!res.ok) return false

  const json = (await res.json()) as { token: string }
  setSession(json.token, user)
  return true
}

// Fetch wrapper for /api/admin/* — attaches the Bearer token and clears the
// session on a 401 so the route guard (AdminApp) falls back to LoginGate.
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401) clearSession()
  return res
}
