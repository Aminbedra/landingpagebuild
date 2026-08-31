// Session + fetch helper for the admin panel (src/pages/admin).
//
// The admin panel's Phase 3 brief originally called for Cloudflare Access
// JWT auth, but no Access application is provisioned for this repo. Instead
// this reuses the Worker's existing internal auth (POST /auth/login →
// Bearer JWT, see worker/src/routes/auth.ts) and gates the panel on
// role === 'super_admin' (worker/src/middleware/requireAuth.ts ->
// requireSuperAdmin, which every /api/admin/* route requires).

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

interface WorkerOk<T> {
  success: true
  data: T
}
interface WorkerErr {
  success: false
  error: string
}
type WorkerResponse<T> = WorkerOk<T> | WorkerErr

// POST /auth/login — throws if credentials are wrong or the account isn't
// a super_admin. On success, stores the session and returns the user.
export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = (await res.json()) as WorkerResponse<{ token: string; user: AdminUser }>

  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error : `Login failed (${res.status})`)
  }
  if (json.data.user.role !== 'super_admin') {
    throw new Error('This account does not have admin access.')
  }

  setSession(json.data.token, json.data.user)
  return json.data.user
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
