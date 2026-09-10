import { Hono } from 'hono'
import type { Env } from '../types'

// ── Phase 2 (Priority 1) — public, visitor-facing AI pitch widget ────────────
//
// Distinct from POST /websites/:websiteId/ai/chat (routes/ai.ts), which
// belongs to the retired multi-tenant builder surface (see
// ARCHITECTURE.md "What Is Retired") and requires an owner JWT. This is
// what the market page's AIPitchWidget island
// (astro/src/components/market/AIPitchWidget.tsx) actually calls — gated
// by config:{market}'s aiEnabled flag (worker/src/routes/admin.ts's
// MarketConfig), not by auth.
//
// No per-visitor rate limiting beyond the 500-char input cap below — an
// unauthenticated endpoint that calls a paid LLM API is a real abuse
// surface; flagged as necessary follow-up, not built here (out of this
// pass's scope).

const publicAi = new Hono<{ Bindings: Env }>()

const MAX_CHALLENGE_LENGTH = 500

interface MarketConfigFlags {
  aiEnabled?: boolean
}

const SYSTEM_PROMPT =
  "You are a B2B marketing expert. Given a visitor's business challenge, " +
  'return a concise, tailored value proposition pitch in 2-3 sentences. ' +
  'Be specific, confident, and speak directly to the challenge.'

// POST /api/ai/:market — public, no auth
publicAi.post('/:market', async (c) => {
  const market = c.req.param('market')

  const config = await c.env.KV.get<MarketConfigFlags>(`config:${market}`, 'json')
  if (!config?.aiEnabled) {
    return c.json({ error: 'AI not enabled for this market' }, 403)
  }

  let body: { challenge?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const challenge = body.challenge?.trim()
  if (!challenge) {
    return c.json({ error: 'challenge is required' }, 400)
  }
  if (challenge.length > MAX_CHALLENGE_LENGTH) {
    return c.json({ error: `challenge must be ${MAX_CHALLENGE_LENGTH} characters or fewer` }, 400)
  }

  // Same model as the existing (owner-authed) AI routes — routes/ai.ts —
  // for consistency; not a place to also silently change model version.
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: challenge }],
    }),
  })

  if (!response.ok) {
    console.error('Anthropic API error:', await response.text())
    return c.json({ error: 'AI service temporarily unavailable' }, 503)
  }

  const aiResponse = await response.json<{ content: Array<{ type: string; text: string }> }>()
  const pitch = aiResponse.content.find((b) => b.type === 'text')?.text?.trim() ?? ''

  if (!pitch) {
    return c.json({ error: 'AI service returned an empty response' }, 503)
  }

  return c.json({ pitch })
})

export default publicAi
