import { useCallback, useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import CopyEditor from './CopyEditor'
import LeadsDashboard from './LeadsDashboard'
import UsersPanel from './UsersPanel'
import MediaLibrary from './MediaLibrary'
import LoginGate from './LoginGate'
import type { AdminView } from './MarketSidebar'
import { useAdminSession } from './useAdminSession'
import { useIdleSessionRefresh } from './useIdleSessionRefresh'
import { clearSession } from '../../lib/adminAuth'

function readMarketFromUrl(): string | null {
  // AdminApp is a client:load island — Astro also renders it once on the
  // server to produce the initial HTML, where `window` doesn't exist.
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('market')
}

function readViewFromUrl(): AdminView {
  if (typeof window === 'undefined') return 'copy'
  const v = new URLSearchParams(window.location.search).get('view')
  return v === 'leads' || v === 'users' || v === 'media' ? v : 'copy'
}

export default function AdminApp() {
  const { token, user } = useAdminSession()
  useIdleSessionRefresh(Boolean(token))
  const [markets, setMarkets] = useState<string[]>([])
  const [selectedMarket, setSelectedMarket] = useState<string | null>(() => readMarketFromUrl())
  const [view, setView] = useState<AdminView>(() => readViewFromUrl())
  const [dirtyMarket, setDirtyMarket] = useState<string | null>(null)
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})

  // Keep selection in sync with browser back/forward.
  useEffect(() => {
    function handlePopState() {
      setSelectedMarket(readMarketFromUrl())
      setView(readViewFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // MarketSidebar owns the GET /api/admin/markets fetch; this is how the
  // root learns the list, so it can default ?market= to the first one when
  // the URL doesn't already name a market (or names one that no longer
  // exists). Leaves ?view= alone either way — a bookmarked
  // ?market=uk&view=leads should still land on Leads once uk resolves.
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

  // `market` is nullable because 'users' is account-scoped, not
  // market-scoped — navigating there doesn't require (or change) a market
  // selection. When one was already set, it's preserved in the URL so
  // going back to Copy/Leads lands where the user left off.
  const handleNavigate = useCallback((market: string | null, nextView: AdminView) => {
    setSelectedMarket(market)
    setView(nextView)
    const url = new URL(window.location.href)
    if (market) url.searchParams.set('market', market)
    else url.searchParams.delete('market')
    url.searchParams.set('view', nextView)
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

  const handleLeadsTotalLoaded = useCallback((market: string, total: number) => {
    setLeadCounts((prev) => (prev[market] === total ? prev : { ...prev, [market]: total }))
  }, [])

  if (!token) {
    return <LoginGate />
  }

  return (
    <AdminLayout
      selectedMarket={selectedMarket}
      view={view}
      dirtyMarket={dirtyMarket}
      leadCounts={leadCounts}
      onNavigate={handleNavigate}
      onMarketsLoaded={handleMarketsLoaded}
      // Cloning creates copy content, so land on the copy editor for it —
      // the leads view would just be empty for a brand-new market.
      onCloneSuccess={(newMarket) => handleNavigate(newMarket, 'copy')}
      userEmail={user?.email ?? null}
      onLogout={clearSession}
    >
      {view === 'users' ? (
        // Account-scoped: rendered regardless of whether a market is
        // selected, unlike the copy/leads branches below.
        <UsersPanel />
      ) : view === 'media' ? (
        <MediaLibrary />
      ) : selectedMarket ? (
        view === 'leads' ? (
          // key remounts on market change (and here, matches CopyEditor's
          // pattern) so useLeads' internal state doesn't leak between
          // markets.
          <LeadsDashboard key={`leads-${selectedMarket}`} market={selectedMarket} onTotalLoaded={handleLeadsTotalLoaded} />
        ) : (
          <CopyEditor key={`copy-${selectedMarket}`} market={selectedMarket} onDirtyChange={handleDirtyChange} />
        )
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          {markets.length === 0 ? 'No markets configured yet.' : 'Select a market to begin.'}
        </div>
      )}
    </AdminLayout>
  )
}
