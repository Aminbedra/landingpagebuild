import { useState, type SyntheticEvent } from 'react'
import { submitLead } from '../lib/api'

interface LeadFormProps {
  websiteId: string
  apiUrl: string
  pageId?: string
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function LeadForm({ websiteId, apiUrl, pageId }: LeadFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    if (!name.trim() && !email.trim()) {
      setError('Please share your name or email.')
      return
    }

    setStatus('sending')
    setError(null)
    try {
      await submitLead(apiUrl, websiteId, { name, email, message, page_id: pageId })
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        Thanks! We received your message and will be in touch shortly.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="lead-name">
          Name
        </label>
        <input
          id="lead-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="lead-email">
          Email
        </label>
        <input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="lead-message">
          Message
        </label>
        <textarea
          id="lead-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  )
}
