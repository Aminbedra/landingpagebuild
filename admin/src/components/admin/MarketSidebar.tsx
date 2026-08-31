import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'
import CloneMarketModal from './CloneMarketModal'

interface MarketSidebarProps {
  selectedMarket: string | null
  dirtyMarket: string | null
  onSelect: (market: string) => void
  onMarketsLoaded: (markets: string[]) => void
  onCloneSuccess: (newMarket: string) => void
}

export default function MarketSidebar({
  selectedMarket,
  dirtyMarket,
  onSelect,
  onMarketsLoaded,
  onCloneSuccess,
}: MarketSidebarProps) {
  const [markets, setMarkets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Also doubles as "which market is the clone source" — set from either a
  // row's clone icon or the bottom "Clone current market" button.
  const [cloneSource, setCloneSource] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await adminFetch('/api/admin/markets')
        if (!res.ok) throw new Error(`Failed to load markets (${res.status})`)
        const json = (await res.json()) as { markets: string[] }
        if (!cancelled) {
          setMarkets(json.markets)
          onMarketsLoaded(json.markets)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load markets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // Fetch once on mount only — a successful clone appends to local state
    // directly (handleCloneSuccess below) rather than re-fetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCloneSuccess(newMarket: string) {
    setMarkets((prev) => (prev.includes(newMarket) ? prev : [...prev, newMarket]))
    setCloneSource(null)
    onCloneSuccess(newMarket)
  }

  return (
    <nav className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Markets</p>

        {loading && <p className="px-2 text-sm text-gray-500">Loading…</p>}
        {error && <p className="px-2 text-sm text-red-400">{error}</p>}
        {!loading && !error && markets.length === 0 && (
          <p className="px-2 text-sm text-gray-500">No markets yet.</p>
        )}

        <ul className="space-y-1">
          {markets.map((market) => {
            const active = market === selectedMarket
            return (
              <li key={market} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(market)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 pr-8 text-left text-sm transition-colors ${
                    active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{market.toUpperCase()}</span>
                  {dirtyMarket === market && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCloneSource(market)}
                  title={`Clone ${market.toUpperCase()}`}
                  aria-label={`Clone ${market.toUpperCase()}`}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-200"
                >
                  <CloneIcon />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-gray-700 p-3">
        <button
          type="button"
          disabled={!selectedMarket}
          onClick={() => selectedMarket && setCloneSource(selectedMarket)}
          title={selectedMarket ? undefined : 'Select a market first'}
          className="w-full rounded border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
        >
          Clone current market
        </button>
      </div>

      <CloneMarketModal
        sourceMarket={cloneSource ?? ''}
        isOpen={cloneSource !== null}
        onClose={() => setCloneSource(null)}
        onCloneSuccess={handleCloneSuccess}
      />
    </nav>
  )
}

function CloneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M21 8v11a2 2 0 0 1-2 2H8" />
    </svg>
  )
}
