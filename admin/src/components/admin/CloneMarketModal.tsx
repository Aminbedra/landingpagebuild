import { useState, type FormEvent } from 'react'
import { adminFetch } from '../../lib/adminAuth'

interface CloneMarketModalProps {
  sourceMarket: string
  isOpen: boolean
  onClose: () => void
  onCloneSuccess: (newMarket: string) => void
}

const SLUG_RE = /^[a-z0-9-]+$/

// This one IS a real modal (dark backdrop, centred card) — unlike
// VersionHistoryPanel, which is deliberately a side drawer so the copy
// editor stays visible behind it. Different UX needs: cloning is a focused
// one-shot action, browsing version history isn't.
export default function CloneMarketModal({ sourceMarket, isOpen, onClose, onCloneSuccess }: CloneMarketModalProps) {
  const [slug, setSlug] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugError = slug.length > 0 && !SLUG_RE.test(slug)
  const canSubmit = slug.length > 0 && !slugError && !submitting

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase())
    setError(null)
  }

  function handleClose() {
    if (submitting) return
    setSlug('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/config/${encodeURIComponent(sourceMarket)}/clone`, {
        method: 'POST',
        body: JSON.stringify({ targetMarket: slug }),
      })

      if (res.status === 409) {
        setError('That market slug already exists. Choose a different one.')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? `Clone failed (${res.status})`)
        return
      }

      const newMarket = slug
      setSlug('')
      onCloneSuccess(newMarket)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clone failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-market-title"
      >
        <h2 id="clone-market-title" className="text-lg font-semibold text-gray-100">
          Clone market variant
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Creates a new market using {sourceMarket.toUpperCase()}&rsquo;s copy as a starting point. You can edit it
          after cloning.
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">New market slug</span>
            <input
              type="text"
              autoFocus
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="es"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
          {slugError && (
            <p className="mt-1 text-sm text-red-400">Only lowercase letters, numbers, and hyphens are allowed.</p>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Cloning…' : 'Clone market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
