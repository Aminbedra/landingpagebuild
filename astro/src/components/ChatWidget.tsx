import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { sendChatMessage, type ChatMessage } from '../lib/api'

interface ChatWidgetProps {
  // Optional: a market landing page (see astro/src/pages/index.astro) has
  // no associated website record, so there's nothing to chat against —
  // the widget renders nothing rather than a chat bubble that can't
  // actually send anything. Real market-scoped AI chat is separate,
  // undone work.
  websiteId?: string
  apiUrl: string
  pageId?: string
  /** Owner JWT — required until a visitor-safe chat endpoint exists. See lib/api.ts. */
  authToken?: string
}

export default function ChatWidget({ websiteId, apiUrl, pageId, authToken }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  if (!websiteId) return null
  // Same reason as LeadForm.tsx: TS doesn't narrow `websiteId` inside a
  // hoisted function declaration captured after the guard above.
  const chatWebsiteId = websiteId

  async function handleSend(e: SyntheticEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const history = messages
    const nextMessages: ChatMessage[] = [...history, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError(null)

    try {
      const data = await sendChatMessage(apiUrl, chatWebsiteId, {
        message: text,
        pageId,
        history,
        authToken,
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.message }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold">Ask us anything</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Hi! Ask a question about this business and we&rsquo;ll do our best to help.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && <div className="text-xs text-slate-400">Thinking…</div>}
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white shadow-lg transition hover:scale-105"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
