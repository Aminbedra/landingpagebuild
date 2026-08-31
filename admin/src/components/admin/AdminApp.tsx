import { useCallback, useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import CopyEditor from './CopyEditor'
import LoginGate from './LoginGate'
import { useAdminSession } from './useAdminSession'
import { clearSession } from '../../lib/adminAuth'

function readMarketFromUrl(): string | null {
  // AdminApp is a client:load island — Astro also renders it once on the
  // server to produce the initial HTML, where `window` doesn't exist.
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('market')
}

export default function AdminApp() {
  const { token, user } = useAdminSession()
  const [markets, setMarkets] = useState<string[]>([])
  const [selectedMarket, setSelectedMarket] = useState<string | null>(() => readMarketFromUrl())
  const [dirtyMarket, setDirtyMarket] = useState<string | null>(null)

  // Keep selection in sync with browser back/forward.
  useEffect(() => {
    function handlePopState() {
      setSelectedMarket(readMarketFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // MarketSidebar owns the GET /api/admin/markets fetch; this is how the
  // root learns the list, so it can default ?market= to the first one when
  // the URL doesn't already name a market (or names one that no longer
  // exists).
  const handleMarketsLoaded = useCallback((loaded: string[]) => {
    setMarkets(loaded)
    setSelectedMarket((current) => {
      if (current && loaded.includes(current)) return current
      const fallback = loaded[0] ?? null
      const url = new URL(window.location.href)
      if (fallback) url.searchParams.set('market', fallback)
      else url.searchParams.delete('market')
      window.history.replaceState({}, '', url)
      return fallback
    })
  }, [])

  const handleSelectMarket = useCallback((market: string) => {
    setSelectedMarket(market)
    const url = new URL(window.location.href)
    url.searchParams.set('market', market)
    window.history.pushState({}, '', url)
  }, [])

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setDirtyMarket((current) => {
        if (dirty) return selectedMarket
        return current === selectedMarket ? null : current
      })
    },
    [selectedMarket]
  )

  if (!token) {
    return <LoginGate />
  }

  return (
    <AdminLayout
      selectedMarket={selectedMarket}
      dirtyMarket={dirtyMarket}
      onSelectMarket={handleSelectMarket}
      onMarketsLoaded={handleMarketsLoaded}
      userEmail={user?.email ?? null}
      onLogout={clearSession}
    >
      {selectedMarket ? (
        // key={selectedMarket} remounts CopyEditor (and its useMarketConfig
        // instance) on every market switch instead of trying to reset it
        // in-place — simpler and avoids stale-request races.
        <CopyEditor key={selectedMarket} market={selectedMarket} onDirtyChange={handleDirtyChange} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          {markets.length === 0 ? 'No markets configured yet.' : 'Select a market to begin.'}
        </div>
      )}
    </AdminLayout>
  )
}
