import { useState, type SyntheticEvent } from 'react'

// ── Phase 2 (Priority 1) — visitor-facing AI pitch widget ────────────────────
//
// Lives under components/market/ deliberately separate from the top-level
// ChatWidget.tsx, which belongs to the retired multi-tenant builder
// surface (see ARCHITECTURE.md "What Is Retired") and needs a websiteId
// this page doesn't have. This component calls the new public
// POST /api/ai/:market (worker/src/routes/publicAi.ts) instead — no auth,
// gated server-side by the market's aiEnabled flag.
//
// Hands its result to LeadForm.tsx (a separate React island — Astro
// hydrates each `client:*` component independently, so there's no shared
// React tree to pass props through) via sessionStorage + a same-tab
// CustomEvent. See LeadForm.tsx for the consuming side.

interface AIPitchWidgetProps {
  market: string
  aiEnabled: boolean
  apiUrl: string
}

export interface PitchDetail {
  challenge: string
  pitch: string
}

const MAX_CHALLENGE_LENGTH = 500
export const AI_PITCH_EVENT = 'lpb:ai-pitch'
export const pitchStorageKey = (market: string) => `lpb:aiPitch:${market}`

type Status = 'idle' | 'sending' | 'error'

export default function AIPitchWidget({ market, aiEnabled, apiUrl }: AIPitchWidgetProps) {
  const [challenge, setChallenge] = useState('')
  const [pitch, setPitch] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  // index.astro only renders this island at all when aiEnabled is true —
  // this is a second, defensive guard in case that ever changes, so the
  // widget can never call a market whose AI is actually off.
  if (!aiEnabled) return null

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    const trimmed = challenge.trim()
    if (!trimmed || status === 'sending') return

    setStatus('sending')
    setError(null)
    setPitch(null)

    try {
      const res = await fetch(`${apiUrl}/api/ai/${encodeURIComponent(market)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: trimmed }),
      })
      const json = (await res.json()) as { pitch?: string; error?: string }
      if (!res.ok || !json.pitch) {
        throw new Error(json.error ?? 'Something went wrong. Please try again.')
      }

      setPitch(json.pitch)
      setStatus('idle')

      const detail: PitchDetail = { challenge: trimmed, pitch: json.pitch }
      try {
        sessionStorage.setItem(pitchStorageKey(market), JSON.stringify(detail))
      } catch {
        // Private browsing / storage disabled — the widget still works,
        // LeadForm just won't auto-populate from it.
      }
      window.dispatchEvent(new CustomEvent<PitchDetail>(AI_PITCH_EVENT, { detail }))
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="ai-pitch-widget">
      <h2 className="ai-pitch-widget__title">Get a tailored pitch</h2>
      <p className="ai-pitch-widget__subtitle">Describe your biggest marketing challenge</p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={challenge}
          onChange={(e) => setChallenge(e.target.value.slice(0, MAX_CHALLENGE_LENGTH))}
          rows={4}
          maxLength={MAX_CHALLENGE_LENGTH}
          placeholder="e.g. We're launching in a new market and don't know how to stand out..."
          className="ai-pitch-widget__textarea"
          aria-label="Describe your biggest marketing challenge"
        />
        <div className="ai-pitch-widget__footer">
          <span className="ai-pitch-widget__count">
            {challenge.length}/{MAX_CHALLENGE_LENGTH}
          </span>
          <button
            type="submit"
            disabled={status === 'sending' || !challenge.trim()}
            className="ai-pitch-widget__submit"
          >
            {status === 'sending' ? 'Thinking…' : 'Get my pitch'}
          </button>
        </div>
      </form>

      {error && (
        <p className="ai-pitch-widget__error" role="alert">
          {error}
        </p>
      )}

      {pitch && (
        <div className="ai-pitch-widget__response">
          <p>{pitch}</p>
        </div>
      )}

      <style>{`
        .ai-pitch-widget {
          max-width: 40rem;
          margin: 3rem auto 0;
          padding: 1.5rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--border-radius, 8px);
          background: var(--color-surface, #f9fafb);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .ai-pitch-widget__title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-heading, #111827);
          font-family: var(--font-heading, inherit);
        }
        .ai-pitch-widget__subtitle {
          margin: 0.25rem 0 1rem;
          font-size: 0.875rem;
          color: var(--color-muted, #6b7280);
        }
        .ai-pitch-widget__textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 6px;
          font: inherit;
          resize: vertical;
        }
        .ai-pitch-widget__footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }
        .ai-pitch-widget__count {
          font-size: 0.75rem;
          color: var(--color-muted, #9ca3af);
        }
        .ai-pitch-widget__submit {
          padding: 0.6rem 1.25rem;
          border: none;
          border-radius: var(--border-radius, 6px);
          background: var(--color-primary, #4f46e5);
          color: var(--color-primary-text, #fff);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }
        .ai-pitch-widget__submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ai-pitch-widget__error {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #dc2626;
        }
        .ai-pitch-widget__response {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 6px;
          background: #fff;
          border: 1px solid var(--color-border, #e5e7eb);
          font-size: 0.9375rem;
          line-height: 1.5;
          color: var(--color-body, #374151);
        }
      `}</style>
    </div>
  )
}
