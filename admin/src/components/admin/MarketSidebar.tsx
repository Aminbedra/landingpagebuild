import { useEffect, useState, type ReactNode } from 'react'
import { adminFetch } from '../../lib/adminAuth'
import CloneMarketModal from './CloneMarketModal'

// 'users', 'media', 'analytics', and 'presets' are account-scoped, not
// market-scoped — see AdminLayout, which renders those nav items itself
// rather than inside this component.
export type AdminView = 'copy' | 'leads' | 'users' | 'media' | 'analytics' | 'presets'

interface MarketSidebarProps {
  selectedMarket: string | null
  view: AdminView
  dirtyMarket: string | null
  leadCounts: Record<string, number>
  onNavigate: (market: string | null, view: AdminView) => void
  onMarketsLoaded: (markets: string[]) => void
  onCloneSuccess: (newMarket: string) => void
}

export default function MarketSidebar({
  selectedMarket,
  view,
  dirtyMarket,
  leadCounts,
  onNavigate,
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
        <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Markets</p>

        {loading && <p className="px-2 text-sm text-gray-500">Loading…</p>}
        {error && <p className="px-2 text-sm text-red-400">{error}</p>}
        {!loading && !error && markets.length === 0 && (
          <p className="px-2 text-sm text-gray-500">No markets yet.</p>
        )}

        <ul className="space-y-3">
          {markets.map((market) => {
            const isSelected = market === selectedMarket
            const count = leadCounts[market]
            return (
              <li key={market} className="group relative">
                <div className="flex items-center justify-between px-2 pr-7">
                  <span className={`text-sm font-medium ${isSelected ? 'text-gray-100' : 'text-gray-400'}`}>
                    {market.toUpperCase()}
                  </span>
                  {dirtyMarket === market && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCloneSource(market)}
                  title={`Clone ${market.toUpperCase()}`}
                  aria-label={`Clone ${market.toUpperCase()}`}
                  className="absolute top-0 right-1.5 rounded p-1 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-200"
                >
                  <CloneIcon />
                </button>

                <div className="mt-1 space-y-0.5">
                  <SubNavLink
                    active={isSelected && view === 'copy'}
                    onClick={() => onNavigate(market, 'copy')}
                  >
                    Copy
                  </SubNavLink>
                  <SubNavLink
                    active={isSelected && view === 'leads'}
                    onClick={() => onNavigate(market, 'leads')}
                  >
                    Leads{count !== undefined ? ` (${count})` : ''}
                  </SubNavLink>
                </div>
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

function SubNavLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-r border-l-2 px-3 py-1 text-left text-xs transition-colors ${
        active ? 'border-indigo-500 bg-indigo-600/10 text-indigo-300' : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
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
