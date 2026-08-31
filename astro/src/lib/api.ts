// Thin client for the Worker API (landingpagebuild-worker-staging). Used by
// the React islands (ChatWidget, LeadForm) which call the Worker directly
// from the browser — the Worker's CORS config already allows localhost:3000
// and the staging/production site origins (see worker/src/lib/utils.ts).

interface WorkerOk<T> {
  success: true
  data: T
}
interface WorkerErr {
  success: false
  error: string
}
type WorkerResponse<T> = WorkerOk<T> | WorkerErr

async function parseWorkerResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as WorkerResponse<T>
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error : `Request failed (${res.status})`)
  }
  return json.data
}

// ── Leads ────────────────────────────────────────────────────────────────

export interface LeadPayload {
  name?: string
  email?: string
  message?: string
  page_id?: string
  metadata?: Record<string, unknown>
}

export async function submitLead(apiUrl: string, websiteId: string, payload: LeadPayload) {
  const res = await fetch(`${apiUrl}/websites/${websiteId}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseWorkerResponse<{ id: string; received: boolean }>(res)
}

// ── AI chat ──────────────────────────────────────────────────────────────
//
// NOTE: /websites/:id/ai/chat requires an owner JWT (worker/src/routes/ai.ts
// -> requireAuth). There is no public/visitor-scoped chat endpoint yet, so
// this widget only works when `authToken` is supplied — e.g. from the
// authenticated builder UI (Phase 3). On a publicly published page it will
// currently surface the 401 from the Worker; wiring a visitor-safe chat
// endpoint is follow-up work, not something this scaffold invents.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChatMessage(
  apiUrl: string,
  websiteId: string,
  opts: {
    message: string
    pageId?: string
    history?: ChatMessage[]
    authToken?: string
  }
) {
  const res = await fetch(`${apiUrl}/websites/${websiteId}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
    },
    body: JSON.stringify({
      message: opts.message,
      page_id: opts.pageId,
      history: opts.history,
    }),
  })
  return parseWorkerResponse<{
    message: string
    updated_content: unknown
    usage: { used: number; limit: number }
  }>(res)
}
