import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'
import type { MarketConfig } from './useMarketConfig'

interface VersionEntry {
  key: string
  timestamp: number
  updatedBy: string
}

interface VersionHistoryPanelProps {
  market: string
  isOpen: boolean
  onClose: () => void
  onRestoreSuccess: (config: MarketConfig) => void
}

// A side drawer, not a modal, on purpose — it sits alongside the copy
// editor (no backdrop dimming it) so the version list and the current
// content stay visible at the same time. See CloneMarketModal for the
// contrasting case where a real modal is the right call.
export default function VersionHistoryPanel({ market, isOpen, onClose, onRestoreSuccess }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<number | null>(null)
  const [previewConfig, setPreviewConfig] = useState<MarketConfig | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [confirming, setConfirming] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    setVersions(null)
    setError(null)
    setExpanded(null)
    setConfirming(null)
    setRestoreError(null)
    setLoading(true)
    ;(async () => {
      try {
        const res = await adminFetch(`/api/admin/config/${encodeURIComponent(market)}/versions`)
        if (!res.ok) throw new Error(`Failed to load version history (${res.status})`)
        const json = (await res.json()) as { versions: VersionEntry[] }
        if (!cancelled) setVersions(json.versions)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load version history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, market])

  async function togglePreview(timestamp: number) {
    setConfirming(null)
    if (expanded === timestamp) {
      setExpanded(null)
      return
    }

    setExpanded(timestamp)
    setPreviewConfig(null)
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      const res = await adminFetch(`/api/admin/config/${encodeURIComponent(market)}/versions/${timestamp}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'Version not found' : `Failed to load preview (${res.status})`)
      const config = (await res.json()) as MarketConfig
      setPreviewConfig(config)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleRestore(timestamp: number) {
    setRestoring(true)
    setRestoreError(null)
    try {
      const res = await adminFetch(`/api/admin/config/${encodeURIComponent(market)}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ timestamp: String(timestamp) }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Restore failed (${res.status})`)
      }
      const json = (await res.json()) as { success: true; config: MarketConfig }
      onRestoreSuccess(json.config)
      onClose()
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <aside
      className={`fixed right-0 top-14 bottom-0 z-30 flex w-full flex-col border-l border-gray-700 bg-gray-900 shadow-2xl transition-transform duration-200 md:w-80 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-100">Version history — {market.toUpperCase()}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close version history"
          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {restoreError && (
          <p className="mb-3 rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-400">
            {restoreError}
          </p>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-800" />
            ))}
          </div>
        )}

        {error && !loading && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && versions?.length === 0 && (
          <p className="text-sm text-gray-500">No version history yet. Save a change to create the first snapshot.</p>
        )}

        {!loading && !error && versions && versions.length > 0 && (
          <ul className="space-y-2">
            {versions.map((v, i) => (
              <li key={v.key} className="overflow-hidden rounded-lg border border-gray-700">
                <div className="p-3 hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-100">{formatRelativeTime(v.timestamp)}</span>
                    {i === 0 && (
                      <span className="shrink-0 rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-400">
                        current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{v.updatedBy}</p>
                </div>

                <div className="flex gap-3 border-t border-gray-700 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => togglePreview(v.timestamp)}
                    className="text-xs text-gray-400 underline hover:text-gray-200"
                  >
                    {expanded === v.timestamp ? 'Hide preview' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(v.timestamp)}
                    className="text-xs text-gray-400 underline hover:text-gray-200"
                  >
                    Restore
                  </button>
                </div>

                {expanded === v.timestamp && (
                  <div className="border-t border-gray-700 bg-gray-950 p-3 text-sm">
                    {previewLoading && <p className="text-gray-500">Loading preview…</p>}
                    {previewError && <p className="text-red-400">{previewError}</p>}
                    {previewConfig && !previewLoading && !previewError && (
                      <div className="space-y-2">
                        <PreviewField label="Headline" value={previewConfig.headline} />
                        <PreviewField label="Subheadline" value={previewConfig.subheadline} />
                        <PreviewField label="CTA text" value={previewConfig.ctaText} />
                        <button
                          type="button"
                          onClick={() => setConfirming(v.timestamp)}
                          className="mt-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                        >
                          Restore this version
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {confirming === v.timestamp && (
                  <div className="border-t border-gray-700 p-3">
                    <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3">
                      <p className="text-sm text-amber-200">
                        Restore this version? Your current unsaved changes will be lost.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={() => handleRestore(v.timestamp)}
                          className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
                        >
                          {restoring ? 'Restoring…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={() => setConfirming(null)}
                          className="rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="truncate text-gray-200">{value || <span className="text-gray-600">(empty)</span>}</p>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

// No date library — just enough granularity to match the examples in the
// brief ("2 hours ago", "Yesterday at 14:30").
function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`

  const time = new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (diffDay === 1) return `Yesterday at ${time}`
  if (diffDay < 7) return `${diffDay} days ago`

  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
