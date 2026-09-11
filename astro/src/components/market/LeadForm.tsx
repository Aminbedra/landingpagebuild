import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { AI_PITCH_EVENT, pitchStorageKey, type PitchDetail } from './AIPitchWidget'

// ── Phase 2 (Priority 1) — visitor-facing lead capture ────────────────────────
//
// Lives under components/market/ deliberately separate from the top-level
// LeadForm.tsx, which belongs to the retired multi-tenant builder surface
// (see ARCHITECTURE.md "What Is Retired") and needs a websiteId this page
// doesn't have. This component calls the new public
// POST /api/leads/:market (worker/src/routes/publicLeads.ts) instead — no
// auth.
//
// The brief for this form calls Message optional in the UI while the
// backend endpoint requires it — reconciled by submitting a placeholder
// ("(no message provided)") when the visitor leaves it blank, rather than
// forcing the field or relaxing the backend's validation.

interface MarketLeadFormProps {
  market: string
  apiUrl: string
}

const NO_MESSAGE_PLACEHOLDER = '(no message provided)'

function formatPitchContext({ challenge, pitch }: PitchDetail): string {
  return `Their challenge: ${challenge}\n\nAI-suggested pitch: ${pitch}`
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function LeadForm({ market, apiUrl }: MarketLeadFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  // True once the visitor has typed into Message themselves — guards
  // against an AI pitch response silently overwriting something they
  // already wrote. A ref, not state: read from an event listener
  // registered once on mount, so it needs to see the latest value without
  // re-subscribing on every keystroke.
  const messageEditedByVisitor = useRef(false)

  useEffect(() => {
    function applyPitch(detail: PitchDetail) {
      if (messageEditedByVisitor.current) return
      setMessage(formatPitchContext(detail))
    }

    // AIPitchWidget may already have produced a result before this form
    // mounted — pick that up from sessionStorage on mount...
    try {
      const stored = sessionStorage.getItem(pitchStorageKey(market))
      if (stored) applyPitch(JSON.parse(stored) as PitchDetail)
    } catch {
      // Storage unavailable or content unparseable — no pre-fill, form
      // still works standalone.
    }

    // ...and keep listening in case the widget is used after this form
    // has already mounted.
    function onPitchEvent(e: Event) {
      const detail = (e as CustomEvent<PitchDetail>).detail
      if (detail) applyPitch(detail)
    }
    window.addEventListener(AI_PITCH_EVENT, onPitchEvent)
    return () => window.removeEventListener(AI_PITCH_EVENT, onPitchEvent)
  }, [market])

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }

    setStatus('sending')
    setError(null)

    try {
      const res = await fetch(`${apiUrl}/api/leads/${encodeURIComponent(market)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          message: message.trim() || NO_MESSAGE_PLACEHOLDER,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Could not send. Please try again.')
      }
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="market-lead-form market-lead-form--success">
        Thank you, we will be in touch shortly.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="market-lead-form">
      <h2 className="market-lead-form__title">Get in touch</h2>

      <div className="market-lead-form__row">
        <label className="market-lead-form__field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="market-lead-form__field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>

      <label className="market-lead-form__field">
        <span>
          Company <em className="market-lead-form__optional">(optional)</em>
        </span>
        <input value={company} onChange={(e) => setCompany(e.target.value)} />
      </label>

      <label className="market-lead-form__field">
        <span>
          Message <em className="market-lead-form__optional">(optional)</em>
        </span>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => {
            messageEditedByVisitor.current = true
            setMessage(e.target.value)
          }}
        />
      </label>

      {error && (
        <p className="market-lead-form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={status === 'sending'} className="market-lead-form__submit">
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>

      <style>{`
        .market-lead-form {
          max-width: 40rem;
          margin: 2rem auto 0;
          padding: 1.5rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--border-radius, 8px);
          background: var(--color-surface, #f9fafb);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .market-lead-form--success {
          text-align: center;
          color: var(--color-heading, #111827);
          font-weight: 500;
        }
        .market-lead-form__title {
          margin: 0 0 1rem;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-heading, #111827);
          font-family: var(--font-heading, inherit);
        }
        .market-lead-form__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .market-lead-form__field {
          display: block;
          margin-top: 1rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-body, #374151);
        }
        .market-lead-form__row .market-lead-form__field {
          margin-top: 0;
        }
        .market-lead-form__optional {
          font-style: normal;
          font-weight: 400;
          color: var(--color-muted, #9ca3af);
        }
        .market-lead-form__field input,
        .market-lead-form__field textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-top: 0.35rem;
          padding: 0.6rem 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 6px;
          font: inherit;
        }
        .market-lead-form__error {
          margin: 1rem 0 0;
          font-size: 0.875rem;
          color: #dc2626;
        }
        .market-lead-form__submit {
          margin-top: 1.25rem;
          padding: 0.6rem 1.25rem;
          border: none;
          border-radius: var(--border-radius, 6px);
          background: var(--color-primary, #4f46e5);
          color: var(--color-primary-text, #fff);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }
        .market-lead-form__submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: 480px) {
          .market-lead-form__row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  )
}
