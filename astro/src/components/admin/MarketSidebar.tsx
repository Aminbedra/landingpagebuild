import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

interface MarketSidebarProps {
  selectedMarket: string | null
  dirtyMarket: string | null
  onSelect: (market: string) => void
  onMarketsLoaded: (markets: string[]) => void
}

export default function MarketSidebar({
  selectedMarket,
  dirtyMarket,
  onSelect,
  onMarketsLoaded,
}: MarketSidebarProps) {
  const [markets, setMarkets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    // Fetch once on mount only — the market list itself doesn't change from
    // inside this panel in Part 1 (Add Market is Phase 4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              <li key={market}>
                <button
                  type="button"
                  onClick={() => onSelect(market)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
                    active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{market.toUpperCase()}</span>
                  {dirtyMarket === market && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-gray-700 p-3">
        <button
          type="button"
          disabled
          title="Coming in Phase 4"
          className="w-full cursor-not-allowed rounded border border-gray-700 px-3 py-2 text-sm text-gray-500"
        >
          + Add Market
        </button>
      </div>
    </nav>
  )
}
